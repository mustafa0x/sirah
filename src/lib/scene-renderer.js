import {
    overview_shot,
    places,
    routes,
    scene_pois,
    shelter_asset,
    worlds as world_definitions,
} from './scene-manifest.js'
import { evidence_category, evidence_dot } from './evidence.js'
import { follow_link, journey_href } from './journey-links.js'
import { chapter } from '../content/first-chapter.js'
import { build_terrain, fbm, hash, load_grid, shelter_bank } from './scene-terrain.js'
import { build_kaaba, kaaba_landmark } from './scene-landmarks.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const mix = (a, b, t) => a + (b - a) * t
const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}
const METRE = 0.001

const moods = {
    gold: {
        top: 0x2f5f8a,
        sea: 0x3f9fc0,
        horizon: 0xf6dcb2,
        sun: 0xffd29a,
        sun_power: 2.7,
        sun_at: [-7, 6, 8],
        sky_light: 0xffe6c2,
        ground_light: 0x5a4632,
        ambient: 0.85,
        stars: 0,
        exposure: 1,
    },
    dusk: {
        top: 0x1d2550,
        sea: 0x3a5f86,
        horizon: 0xe58656,
        sun: 0xffa56a,
        sun_power: 2.3,
        sun_at: [-9, 4.5, 7],
        sky_light: 0xe0b9c2,
        ground_light: 0x4a3530,
        ambient: 1.15,
        stars: 0.3,
        exposure: 1.1,
    },
    night: {
        top: 0x050818,
        sea: 0x122640,
        horizon: 0x1b2c52,
        sun: 0x9fb2e6,
        sun_power: 1.15,
        sun_at: [5, 7, 8],
        sky_light: 0x4b5a86,
        ground_light: 0x2a2228,
        ambient: 0.85,
        stars: 1,
        exposure: 1.1,
    },
    haze: {
        top: 0x54799c,
        sea: 0x62a9bf,
        horizon: 0xecd3b4,
        sun: 0xffe3bf,
        sun_power: 2.2,
        sun_at: [7, 4.5, 8],
        sky_light: 0xf1e3cf,
        ground_light: 0x5b4a3a,
        ambient: 0.9,
        stars: 0,
        exposure: 1,
    },
    day: {
        top: 0x3a7cb6,
        sea: 0x3aa2cc,
        horizon: 0xf5e1b8,
        sun: 0xfff0d2,
        sun_power: 3,
        sun_at: [6, 8, 6],
        sky_light: 0xfff3dc,
        ground_light: 0x67533b,
        ambient: 0.95,
        stars: 0,
        exposure: 1,
    },
}

export async function create_scene(
    host,
    { on_poi = () => {}, on_source = () => {}, report = () => {} } = {},
) {
    let disposed = false
    let frame = 0
    let resize_observer
    let cleanup_controls = () => {}
    let renderer
    let scene
    const labels = document.createElement('div')
    labels.className =
        'absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-[0.6s] ease-[ease] group-[[data-started=false][data-map=false]]/stage:[&>:not([data-home])]:invisible group-[[data-started=false][data-map=false]]/stage:[&>*]:pointer-events-none'
    const api = {
        set_shot() {},
        set_mood() {},
        set_route() {},
        set_cycle() {},
        set_progress() {},
        set_actor() {},
        set_evidence() {},
        set_active() {},
        set_insets() {},
        set_links() {},
        set_chapters() {},
        dispose() {
            disposed = true
        },
    }

    try {
        const THREE = await import('three')
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
        const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js')
        const { Line2 } = await import('three/addons/lines/Line2.js')
        const { LineGeometry } = await import('three/addons/lines/LineGeometry.js')
        const { LineMaterial } = await import('three/addons/lines/LineMaterial.js')
        const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js')
        const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js')
        const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js')
        const { ShaderPass } = await import('three/addons/postprocessing/ShaderPass.js')
        const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js')
        if (disposed) return api
        const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        // The camera moves between a 400 km overview and a few metres inside the shelter.
        renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFShadowMap
        renderer.domElement.style.display = 'block'
        host.replaceChildren(renderer.domElement, labels)
        scene = new THREE.Scene()
        scene.fog = new THREE.Fog(0xf6dcb2, 24, 80)

        // Sky, stars, light.
        const sky_uniforms = {
            top: { value: new THREE.Color() },
            horizon: { value: new THREE.Color() },
            sun_at: { value: new THREE.Vector3(0, 1, 0) },
            sun: { value: new THREE.Color() },
            // A small hard disc at night, a wide warm glow by day.
            night: { value: 0 },
        }
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(150, 24, 16),
            new THREE.ShaderMaterial({
                side: THREE.BackSide,
                depthWrite: false,
                depthTest: false,
                fog: false,
                uniforms: sky_uniforms,
                vertexShader:
                    'varying vec3 ray; void main() { ray = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
                fragmentShader: `
                    uniform vec3 top; uniform vec3 horizon; uniform vec3 sun_at; uniform vec3 sun;
                    uniform float night;
                    varying vec3 ray;
                    void main() {
                        vec3 dir = normalize(ray);
                        float t = pow(smoothstep(-0.05, 0.75, dir.y), 0.6);
                        vec3 color = mix(horizon, top, t);
                        float facing = max(dot(dir, sun_at), 0.0);
                        // Light scattered towards the viewer, strongest near the horizon.
                        float scatter = pow(facing, 6.0) * (1.0 - 0.6 * t) * mix(0.55, 0.12, night);
                        float halo = pow(facing, mix(90.0, 400.0, night)) * mix(0.9, 0.5, night);
                        float disc = smoothstep(mix(0.9994, 0.99975, night), mix(0.9998, 0.9999, night), facing);
                        color += sun * (scatter + halo + disc * 6.0);
                        gl_FragColor = vec4(color, 1.0);
                    }`,
            }),
        )
        sky.renderOrder = -2
        sky.frustumCulled = false
        scene.add(sky)

        const star_positions = []
        for (let index = 0; index < 1100; index += 1) {
            const azimuth = hash(index, 1) * Math.PI * 2
            const height = 0.04 + hash(index, 2) * 0.96
            const radius = Math.sqrt(1 - height * height)
            star_positions.push(
                140 * radius * Math.cos(azimuth),
                140 * height,
                140 * radius * Math.sin(azimuth),
            )
        }
        const star_geometry = new THREE.BufferGeometry()
        star_geometry.setAttribute('position', new THREE.Float32BufferAttribute(star_positions, 3))
        const star_material = new THREE.PointsMaterial({
            color: 0xe9efff,
            size: 1.7,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            fog: false,
        })
        const stars = new THREE.Points(star_geometry, star_material)
        stars.renderOrder = -1
        stars.frustumCulled = false
        scene.add(stars)

        const hemisphere = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
        scene.add(hemisphere)
        const sun = new THREE.DirectionalLight(0xffffff, 2)
        sun.castShadow = true
        sun.shadow.mapSize.set(2048, 2048)
        sun.shadow.bias = -0.0004
        scene.add(sun, sun.target)

        // Ripples: a tiling normal map built from noise, drifting slowly so the light glints.
        const ripple_size = 128
        const ripple_data = new Uint8Array(ripple_size * ripple_size * 4)
        const swell = (x, y) => {
            // Sample on a torus so the texture tiles without a seam.
            const u = (x / ripple_size) * Math.PI * 2
            const v = (y / ripple_size) * Math.PI * 2
            return (
                Math.sin(u * 3 + Math.cos(v * 2) * 1.7) +
                Math.sin(v * 5 + Math.sin(u * 4) * 1.3) * 0.6 +
                Math.sin((u + v) * 7) * 0.3
            )
        }
        for (let y = 0; y < ripple_size; y += 1) {
            for (let x = 0; x < ripple_size; x += 1) {
                const dx = swell(x + 1, y) - swell(x - 1, y)
                const dy = swell(x, y + 1) - swell(x, y - 1)
                const length = Math.hypot(dx, dy, 1)
                ripple_data.set(
                    [(dx / length) * 127 + 128, (dy / length) * 127 + 128, (1 / length) * 255, 255],
                    (y * ripple_size + x) * 4,
                )
            }
        }
        const ripples = new THREE.DataTexture(ripple_data, ripple_size, ripple_size)
        // How many map widths the sea spans; the ripples repeat with it.
        const sea_reach = 8
        ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping
        ripples.repeat.set(140 * sea_reach, 140 * sea_reach)
        ripples.generateMipmaps = true
        ripples.minFilter = THREE.LinearMipmapLinearFilter
        ripples.magFilter = THREE.LinearFilter
        ripples.needsUpdate = true
        // The sea reaches well past the mapped land and fades into the horizon, so the map
        // never shows a hard edge against the sky.
        // Translucent, so the seabed's colour shows: lighter shallows along the coast.
        const sea_material = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.72,
            roughness: 0.22,
            metalness: 0.05,
            normalMap: ripples,
            normalScale: new THREE.Vector2(0.35, 0.35),
        })
        const grids = await Promise.all(Object.values(world_definitions).map(load_grid))
        if (disposed) return api
        const landscape = build_terrain(THREE, world_definitions.region, grids[0], [
            { definition: world_definitions.makkah, grid: grids[1] },
            { definition: world_definitions.madinah, grid: grids[2] },
        ])
        scene.add(landscape.mesh)
        if (landscape.skirt) scene.add(landscape.skirt)
        const sea = new THREE.Mesh(
            new THREE.PlaneGeometry(landscape.size_x * sea_reach, landscape.size_z * sea_reach),
            sea_material,
        )
        sea.name = 'mapped-water'
        sea.rotation.x = -Math.PI / 2
        sea.receiveShadow = true
        scene.add(sea)
        // Deep water beneath, past the mapped seabed, so open sea stays a uniform deep blue.
        const sea_floor = new THREE.Mesh(
            sea.geometry,
            new THREE.MeshStandardMaterial({ color: 0x0c2a3e, roughness: 1 }),
        )
        sea_floor.name = 'open-water-floor'
        sea_floor.rotation.x = -Math.PI / 2
        sea_floor.position.y = -0.42
        scene.add(sea_floor)

        const mood = {
            top: new THREE.Color(),
            horizon: new THREE.Color(),
            sun: new THREE.Color(),
            sky_light: new THREE.Color(),
            ground_light: new THREE.Color(),
            sea: new THREE.Color(),
            sun_at: new THREE.Vector3(),
            sun_power: 0,
            ambient: 0,
            stars: 0,
            exposure: 1,
        }
        let mood_target = moods.gold
        // null, or 0..1 through three nights.
        let cycle = null
        // Playback reports its position about ten times a second. Between reports a position
        // runs on at the rate it last moved, so motion tied to it stays smooth; a seek or a
        // pause takes effect at once.
        const playback_signal = () => {
            let target = null
            let at = 0
            let rate = 0
            return {
                set(value) {
                    const now = performance.now()
                    const step = value === null || target === null ? null : value - target
                    if (step === null || step < 0 || step > 0.2) rate = 0
                    else if (step === 0) rate = 0
                    else
                        rate = mix(
                            rate || step / ((now - at) / 1000),
                            step / ((now - at) / 1000),
                            0.5,
                        )
                    target = value
                    at = now
                },
                read(now) {
                    if (target === null) return null
                    return Math.min(1, target + rate * Math.min(0.15, (now - at) / 1000))
                },
            }
        }
        const cycle_signal = playback_signal()
        const progress_signal = playback_signal()
        const night_phases = [
            [0.5, 'night'],
            [0.64, 'dusk'],
            [0.8, 'gold'],
            [0.92, 'dusk'],
            [1, 'night'],
        ]
        const scratch_color = new THREE.Color()
        const scratch_vector = new THREE.Vector3()
        const blend_mood = (amount, mood_target) => {
            for (const key of ['top', 'horizon', 'sun', 'sky_light', 'ground_light', 'sea'])
                mood[key].lerp(scratch_color.setHex(mood_target[key]), amount)
            mood.sun_at.lerp(scratch_vector.set(...mood_target.sun_at).normalize(), amount)
            for (const key of ['sun_power', 'ambient', 'stars', 'exposure'])
                mood[key] = mix(mood[key], mood_target[key], amount)
            sky_uniforms.top.value.copy(mood.top)
            sky_uniforms.horizon.value.copy(mood.horizon)
            sky_uniforms.sun_at.value.copy(mood.sun_at).normalize()
            sky_uniforms.sun.value.copy(mood.sun)
            sky_uniforms.night.value = mood.stars
            scene.fog.color.copy(mood.horizon)
            sun.color.copy(mood.sun)
            sun.intensity = mood.sun_power
            hemisphere.color.copy(mood.sky_light)
            hemisphere.groundColor.copy(mood.ground_light)
            hemisphere.intensity = mood.ambient
            star_material.opacity = mood.stars
            sea_material.color.copy(mood.sea)
            renderer.toneMappingExposure = mood.exposure
        }
        blend_mood(1, mood_target)

        // Shared materials and shapes for the hand-built sets.
        const stone_material = new THREE.MeshStandardMaterial({
            color: 0x8f7052,
            roughness: 1,
            flatShading: true,
        })
        const wall_colors = [0xd8b98c, 0xc9a877, 0xe3c9a0].map((color) => new THREE.Color(color))
        const wall_material = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true })
        const block_geometry = new THREE.BoxGeometry(1, 1, 1)
        const boulder_geometry = new THREE.IcosahedronGeometry(1, 1)
        const boulder_position = boulder_geometry.attributes.position
        for (let index = 0; index < boulder_position.count; index += 1) {
            const x = boulder_position.getX(index)
            const y = boulder_position.getY(index)
            const z = boulder_position.getZ(index)
            const swell =
                0.82 + 0.36 * hash(Math.round(x * 40) + Math.round(y * 17), Math.round(z * 40))
            boulder_position.setXYZ(index, x * swell, y * swell, z * swell)
        }
        boulder_geometry.computeVertexNormals()
        const ring_geometry = new THREE.TorusGeometry(1, 0.035, 6, 32)
        ring_geometry.rotateX(Math.PI / 2)
        const dummy = new THREE.Object3D()
        const shadowed = (mesh) => {
            mesh.castShadow = true
            mesh.receiveShadow = true
            return mesh
        }

        // Schematic settlement: plain blocks on the level ground, no claimed architecture.
        const add_blocks = (world, place, count, radius, seed, yard = 0) => {
            const mesh = shadowed(new THREE.InstancedMesh(block_geometry, wall_material, count))
            mesh.name = `${place}-settlement`
            const [cx, cz] = world.terrain.to_xz(places[place].lat, places[place].lon)
            for (let index = 0; index < count; index += 1) {
                const angle = hash(index, seed) * Math.PI * 2
                const reach = radius * Math.sqrt(hash(index, seed + 1))
                const x = cx + reach * Math.cos(angle)
                const z = cz + reach * Math.sin(angle)
                const tall = 0.016 + 0.024 * hash(index, seed + 4)
                const width = 0.03 + 0.035 * hash(index, seed + 2)
                const depth = 0.03 + 0.035 * hash(index, seed + 3)
                // Keep each building's footprint outside the clearing, not just its centre.
                const level =
                    world.terrain.slope(x, z) < 0.22 &&
                    (yard === 0 || reach > yard + Math.hypot(width, depth) / 2)
                dummy.position.set(x, world.terrain.height(x, z) + tall / 2 - 0.002, z)
                dummy.rotation.set(0, hash(index, seed + 5) * 0.7, 0)
                dummy.scale.set(level ? width : 0, level ? tall : 0, level ? depth : 0)
                dummy.updateMatrix()
                mesh.setMatrixAt(index, dummy.matrix)
                mesh.setColorAt(index, wall_colors[index % wall_colors.length])
            }
            world.group.add(mesh)
        }

        const add_palms = (world, groves) => {
            const total = groves.reduce((sum, grove) => sum + grove.count, 0)
            const fronds_each = 7
            const trunk_geometry = new THREE.CylinderGeometry(0.0012, 0.002, 1, 5)
            trunk_geometry.translate(0, 0.5, 0)
            const frond_geometry = new THREE.ConeGeometry(0.0017, 0.013, 4)
            frond_geometry.translate(0, 0.0065, 0)
            const trunks = shadowed(
                new THREE.InstancedMesh(
                    trunk_geometry,
                    new THREE.MeshStandardMaterial({ color: 0x6f4d30, roughness: 1 }),
                    total,
                ),
            )
            const fronds = shadowed(
                new THREE.InstancedMesh(
                    frond_geometry,
                    new THREE.MeshStandardMaterial({
                        color: 0x5f8040,
                        roughness: 0.9,
                        flatShading: true,
                    }),
                    total * fronds_each,
                ),
            )
            let index = 0
            for (const grove of groves) {
                const [cx, cz] = world.terrain.to_xz(
                    places[grove.place].lat,
                    places[grove.place].lon,
                )
                for (let tree = 0; tree < grove.count; tree += 1, index += 1) {
                    const angle = hash(index, 71) * Math.PI * 2
                    const reach =
                        grove.inner + (grove.radius - grove.inner) * Math.sqrt(hash(index, 72))
                    const x = cx + reach * Math.cos(angle)
                    const z = cz + reach * Math.sin(angle)
                    // Groves gather in clumps on level ground.
                    const grows =
                        world.terrain.slope(x, z) < 0.1 && fbm(x * 2.2 + 5, z * 2.2) > 0.36
                    const tall = grows ? 0.018 + 0.016 * hash(index, 73) : 0
                    const base = world.terrain.height(x, z)
                    dummy.position.set(x, base, z)
                    dummy.rotation.set(0, 0, 0)
                    dummy.scale.set(grows ? 1 : 0, tall, grows ? 1 : 0)
                    dummy.updateMatrix()
                    trunks.setMatrixAt(index, dummy.matrix)
                    for (let leaf = 0; leaf < fronds_each; leaf += 1) {
                        dummy.position.set(x, base + tall, z)
                        dummy.rotation.set(
                            1.15 + 0.5 * hash(index, leaf),
                            (leaf / fronds_each) * Math.PI * 2 + hash(index, 9),
                            0,
                            'YXZ',
                        )
                        dummy.scale.setScalar(grows ? 1.1 + 0.7 * hash(index, 74) : 0)
                        dummy.updateMatrix()
                        fronds.setMatrixAt(index * fronds_each + leaf, dummy.matrix)
                    }
                }
            }
            world.group.add(trunks, fronds)
        }

        // The shelter set: a few dozen metres of detailed ground near the summit of Thawr,
        // holding the shelter model at true scale. Illustrative, not a reconstruction.
        const add_cave_set = (world) => {
            const { terrain } = world
            const set = new THREE.Group()
            world.group.add(set)
            const [tx, tz] = terrain.to_xz(places.thawr.lat, places.thawr.lon)
            const summit = terrain.height(tx, tz)
            let best = Infinity
            let sx = tx
            let sz = tz
            for (let dx = -0.3; dx <= 0.3; dx += 0.03) {
                for (let dz = -0.3; dz <= 0.3; dz += 0.03) {
                    const score =
                        terrain.slope(tx + dx, tz + dz) +
                        (summit - terrain.height(tx + dx, tz + dz)) * 0.6
                    if (score < best) {
                        best = score
                        sx = tx + dx
                        sz = tz + dz
                    }
                }
            }
            // Local ground, in metres north and east of the site.
            const ground = (north, east) => {
                const reach = Math.hypot(north, east)
                const shelf = mix(0.2, 1, smoothstep(6, 18, reach))
                return (
                    terrain.height(sx + north * METRE, sz + east * METRE) +
                    METRE *
                        (0.6 +
                            2.2 * shelf * fbm(north * 0.09 + 20, east * 0.09) +
                            0.25 * fbm(north * 0.7, east * 0.7 + 3) +
                            shelter_bank(north, east) *
                                (8 + 2 * fbm(north * 0.3, east * 0.3 + 40)) -
                            5 * smoothstep(52, 70, reach))
                )
            }
            const patch_geometry = new THREE.PlaneGeometry(0.14, 0.14, 192, 192)
            patch_geometry.rotateX(-Math.PI / 2)
            const position = patch_geometry.attributes.position
            const colors = new Float32Array(position.count * 3)
            const rock = new THREE.Color(0xb08a5e)
            const dark = new THREE.Color(0x7d5f44)
            const granite = new THREE.Color(0xa39585)
            const tint = new THREE.Color()
            for (let index = 0; index < position.count; index += 1) {
                const north = position.getX(index) / METRE
                const east = position.getZ(index) / METRE
                position.setXYZ(index, sx + north * METRE, ground(north, east), sz + east * METRE)
                tint.copy(rock).lerp(dark, fbm(north * 0.35, east * 0.35 + 7) * 1.2)
                tint.lerp(granite, Math.min(1, shelter_bank(north, east) * 2))
                tint.multiplyScalar(0.8 + 0.4 * fbm(north * 1.3, east * 1.3))
                colors.set([tint.r, tint.g, tint.b], index * 3)
            }
            patch_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
            patch_geometry.computeVertexNormals()
            const patch = new THREE.Mesh(
                patch_geometry,
                new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
            )
            patch.castShadow = true
            patch.receiveShadow = true
            set.add(patch)
            // The landscape mesh is coarser than this ground, and in hollows of the summit its
            // faces pass over the set: from below they are invisible, from above they bury it.
            // Its points under the set are lowered to just beneath the set's ground.
            const landscape_position = landscape.mesh.geometry.attributes.position
            for (let index = 0; index < landscape_position.count; index += 1) {
                const north = (landscape_position.getX(index) / world.scale - sx) / METRE
                const east = (landscape_position.getZ(index) / world.scale - sz) / METRE
                if (Math.hypot(north, east) > 60) continue
                landscape_position.setY(
                    index,
                    Math.min(
                        landscape_position.getY(index),
                        (ground(north, east) - 0.8 * METRE) * world.scale,
                    ),
                )
            }
            // The authored normals are kept: the lowered faces lie under the set.
            landscape_position.needsUpdate = true

            const boulder = (north, east, radius, squash = 0.75, sink = 0.35) => {
                const mesh = shadowed(new THREE.Mesh(boulder_geometry, stone_material))
                mesh.position.set(
                    sx + north * METRE,
                    ground(north, east) + radius * METRE * (squash - sink),
                    sz + east * METRE,
                )
                mesh.scale.set(radius * METRE, radius * squash * METRE, radius * METRE)
                mesh.rotation.set(north, east, radius)
                set.add(mesh)
            }
            // Loose stone on the slope around the shelter.
            for (let index = 0; index < 34; index += 1) {
                const angle = hash(index, 31) * Math.PI * 2
                const reach = 8 + 40 * hash(index, 32)
                boulder(
                    reach * Math.cos(angle),
                    reach * Math.sin(angle),
                    0.25 + 1.1 * hash(index, 33) ** 2,
                    0.65,
                    0.2,
                )
            }

            world.cave_site = new THREE.Vector3(sx, ground(0, 0), sz)
            world.cave_ground = ground
            // A faint fill so the recess reads from inside. Three clamps the falloff of very
            // near lights, so at this scale the intensity is effectively the illuminance / 100.
            const fill = new THREE.PointLight(0xcdd6f0, 0.012, 0.008)
            fill.position.set(sx + 2.6 * METRE, ground(0, 0) + 0.7 * METRE, sz)
            set.add(fill)
            new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
                shelter_asset,
                (gltf) => {
                    if (disposed) return
                    const model = gltf.scene
                    model.rotation.y = Math.PI
                    const box = new THREE.Box3().setFromObject(model)
                    const size = box.getSize(new THREE.Vector3())
                    const centre = box.getCenter(new THREE.Vector3())
                    model.position.set(-centre.x, -box.min.y, -centre.z)
                    model.traverse((child) => {
                        if (!child.isMesh) return
                        shadowed(child)
                        child.material.normalScale?.setScalar(0.6)
                        // Night leaves the camera-facing rock unlit; a little of the texture's own
                        // colour keeps the stone legible, warmed towards Thawr's granite.
                        child.material.color.setRGB(1, 0.86, 0.72)
                        child.material.emissive.setRGB(0.32, 0.27, 0.22)
                        child.material.emissiveMap = child.material.map
                    })
                    // About nine metres across; rotate the TRELLIS aperture towards +x (north).
                    const scale = (9 * METRE) / Math.max(size.x, size.z)
                    const shelter = new THREE.Group()
                    shelter.name = 'thawr-shelter'
                    shelter.userData = { asset: 'trellis', illustrative: true }
                    shelter.add(model)
                    shelter.scale.setScalar(scale)
                    shelter.position.set(sx, ground(0, 0) - size.y * scale * 0.02, sz)
                    set.add(shelter)
                    world.cave_shelter = shelter
                },
                undefined,
                () => {
                    // Without the model, a plain recess still marks the place.
                    boulder(0.5, -3.2, 2.6, 0.9)
                    boulder(0.5, 3.2, 2.4, 0.9)
                    boulder(0, 0, 3.6, 0.55, -0.5)
                },
            )
        }

        // Local sets share one relief and projection, with their authored units retained.
        const route_materials = []
        const worlds = {}
        let active = null
        const leg_target = [0, 0, 0]
        const ensure_world = (name) => {
            if (worlds[name]) return worlds[name].ready
            const definition = world_definitions[name]
            const world = { name, definition, group: new THREE.Group(), routes: [], rings: [] }
            worlds[name] = world
            world.ready = Promise.resolve().then(() => {
                if (disposed) return world
                world.terrain = landscape.in_units(definition.km_per_unit)
                world.scale = world.terrain.scale
                world.group.scale.setScalar(world.scale)
                world.bounds = [
                    ...landscape.to_xz(definition.south, definition.west),
                    ...landscape.to_xz(definition.north, definition.east),
                ]
                if (name === 'makkah') {
                    add_blocks(world, 'makkah', 260, 0.75, 11, kaaba_landmark.clearing)
                    const place = places[kaaba_landmark.place]
                    const [x, z] = world.terrain.to_xz(place.lat, place.lon)
                    const kaaba = build_kaaba(THREE, (dx, dz) =>
                        world.terrain.height(x + dx, z + dz),
                    )
                    kaaba.position.x = x
                    kaaba.position.z = z
                    world.group.add(kaaba)
                    add_cave_set(world)
                }
                if (name === 'madinah') {
                    add_blocks(world, 'madinah', 150, 0.5, 41, 0.13)
                    add_palms(world, [
                        { place: 'madinah', count: 1500, inner: 0.3, radius: 1.7 },
                        { place: 'quba', count: 1300, inner: 0, radius: 1.1 },
                    ])
                }

                const regional = definition.km_per_unit > 1
                for (const route of routes.filter((item) => item.world === name)) {
                    const plan = new THREE.CatmullRomCurve3(
                        route.points.map(([lat, lon]) => {
                            const [x, z] = world.terrain.to_xz(lat, lon)
                            return new THREE.Vector3(x, 0, z)
                        }),
                        false,
                        'centripetal',
                    )
                    const points = plan.getSpacedPoints(200)
                    if (name === 'makkah') {
                        const [x, z] = world.terrain.to_xz(
                            places[kaaba_landmark.place].lat,
                            places[kaaba_landmark.place].lon,
                        )
                        // A town-level route starts in open ground, not inside the symbol.
                        while (
                            points.length > 2 &&
                            Math.hypot(points[0].x - x, points[0].z - z) < kaaba_landmark.clearing
                        )
                            points.shift()
                    }
                    const count = points.length - 1
                    const draped = []
                    for (const point of points) {
                        point.y = world.terrain.height(point.x, point.z) + (regional ? 0.05 : 0.012)
                        draped.push(point.x, point.y, point.z)
                    }
                    const trace_material = new LineMaterial({
                        color: 0xfff1d6,
                        linewidth: 1.5,
                        dashed: true,
                        dashSize: regional ? 0.16 : 0.07,
                        gapSize: regional ? 0.16 : 0.07,
                        transparent: true,
                        opacity: 0.55,
                    })
                    const line_material = new LineMaterial({ color: 0xffc56a, linewidth: 4 })
                    route_materials.push(trace_material, line_material)
                    const trace = new Line2(new LineGeometry().setPositions(draped), trace_material)
                    trace.computeLineDistances()
                    const line = new Line2(new LineGeometry().setPositions(draped), line_material)
                    trace.name = `${name}-route-${route.leg}-trace`
                    line.name = `${name}-route-${route.leg}-line`
                    line.geometry.instanceCount = 0
                    world.group.add(trace, line)
                    world.routes.push({ ...route, line, trace, points, count, shown: 0 })
                }

                world.anchors = new Map()
                for (const poi of scene_pois) {
                    const place = places[poi.anchors[name]]
                    if (!place) continue
                    const ground = place.set ? world.cave_site.clone() : new THREE.Vector3()
                    if (!place.set) {
                        const [x, z] = world.terrain.to_xz(place.lat, place.lon)
                        ground.set(x, world.terrain.height(x, z), z)
                    }
                    world.anchors.set(
                        poi.id,
                        ground.clone().setY(ground.y + (poi.lift ?? definition.label_lift)),
                    )
                    if (poi.ring === false) continue
                    const ring = new THREE.Mesh(
                        ring_geometry,
                        new THREE.MeshBasicMaterial({
                            color: 0xffd68a,
                            transparent: true,
                            fog: false,
                        }),
                    )
                    ring.position.copy(ground).setY(ground.y + (regional ? 0.06 : 0.02))
                    world.group.add(ring)
                    world.rings.push(ring)
                }

                // Passages from the local views are gathered at their town on the overview.
                world.evidence = new Map()
                for (const source of chapter.sources) {
                    let place = places[source.place]
                    if (!place) continue
                    if (place.world !== name) {
                        if (name !== 'region') continue
                        place =
                            places[place.world === 'madinah' ? 'region_madinah' : 'region_makkah']
                    }
                    const ground = place.set ? world.cave_site.clone() : new THREE.Vector3()
                    if (!place.set) {
                        const [x, z] = world.terrain.to_xz(place.lat, place.lon)
                        ground.set(x, world.terrain.height(x, z), z)
                    }
                    const lift = place.set ? 0.0034 : regional ? 0.12 : 0.04
                    const key = `${ground.x.toFixed(4)},${ground.z.toFixed(4)}`
                    if (!world.evidence.has(key))
                        world.evidence.set(key, { at: ground.setY(ground.y + lift), groups: [] })
                    // Excerpts of one work at one place are one passage, and one marker.
                    const groups = world.evidence.get(key).groups
                    let group = groups.find((item) => item.reference === source.reference)
                    if (!group) {
                        group = {
                            id: `${name}:${key}:${source.reference}`,
                            reference: source.reference,
                            kind: evidence_category(source.kind),
                            ids: [],
                        }
                        groups.push(group)
                    }
                    group.ids.push(source.id)
                }

                scene.add(world.group)
                return world
            })
            return world.ready
        }
        const activate = (name) => {
            active = worlds[name]
        }
        const locate = (name) => {
            const place = places[name]
            const world = worlds[place.world]
            if (place.set === 'cave') return world.cave_site.clone()
            const [x, z] = world.terrain.to_xz(place.lat, place.lon)
            return new THREE.Vector3(x, world.terrain.height(x, z), z)
        }

        await ensure_world('region')
        if (disposed) return api
        activate('region')

        // Camera.
        const camera = new THREE.PerspectiveCamera(36, 1, 0.001, 500)
        let fit = 1
        let composer = null
        const resize = () => {
            if (disposed || !host.clientWidth || !host.clientHeight) return
            renderer.setSize(host.clientWidth, host.clientHeight, true)
            composer?.setPixelRatio(renderer.getPixelRatio())
            composer?.setSize(host.clientWidth, host.clientHeight)
            camera.aspect = host.clientWidth / host.clientHeight
            // Narrow, tall viewports need more distance to keep the same ground in frame.
            fit = clamp(1.25 / camera.aspect, 1, 1.9)
            for (const material of route_materials)
                material.resolution.set(host.clientWidth, host.clientHeight)
        }
        // Finishing: a soft bloom on the brightest light, then a gentle grade, vignette and grain.
        composer = new EffectComposer(
            renderer,
            new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
        )
        composer.addPass(new RenderPass(scene, camera))
        const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.7, 0.9)
        composer.addPass(bloom)
        const grade = new ShaderPass({
            uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.022 } },
            vertexShader:
                'varying vec2 uv_; void main() { uv_ = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `
                uniform sampler2D tDiffuse; uniform float time; uniform float grain;
                varying vec2 uv_;
                void main() {
                    vec3 color = texture2D(tDiffuse, uv_).rgb;
                    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
                    // Slightly richer colour, with warmth in the highlights and cool shadows.
                    color = mix(vec3(luma), color, 1.08);
                    color *= mix(vec3(0.96, 0.99, 1.05), vec3(1.04, 1.0, 0.95), smoothstep(0.0, 0.6, luma));
                    vec2 centre = uv_ - 0.5;
                    color *= 1.0 - 0.35 * smoothstep(0.25, 0.85, dot(centre, centre) * 2.0);
                    float noise = fract(sin(dot(uv_ * 1000.0 + time, vec2(12.9898, 78.233))) * 43758.5453);
                    color += (noise - 0.5) * grain * (0.4 + luma);
                    gl_FragColor = vec4(color, 1.0);
                }`,
        })
        composer.addPass(grade)
        composer.addPass(new OutputPass())

        resize_observer = new ResizeObserver(resize)
        resize_observer.observe(host)
        resize()

        const resolve_shot = (wide) => {
            // A shot may carry its own framing for tall, narrow viewports.
            const shot = camera.aspect < 0.8 && wide.portrait ? wide.portrait : wide
            const target = locate(shot.place)
            target.y += shot.height ?? 0.3
            if (shot.offset) {
                target.x += shot.offset[0]
                target.y += shot.offset[1]
                target.z += shot.offset[2]
            }
            return {
                world: places[shot.place].world,
                follow: shot.follow ?? null,
                fov: shot.fov ?? 36,
                azimuth: shot.azimuth,
                elevation: shot.elevation,
                // Close shots retain metre-scale framing in the common regional frame.
                distance:
                    shot.distance *
                    worlds[places[shot.place].world].scale *
                    (shot === wide.portrait || shot.distance < 1 ? 1 : fit),
                target: target.multiplyScalar(worlds[places[shot.place].world].scale),
            }
        }
        const copy_view = (source) => ({ ...source, target: source.target.clone() })
        let view = resolve_shot(overview_shot)
        let flight = null
        // A shot with `push` moves from its own framing to the pushed one as the paragraph
        // plays, until the reader takes the camera.
        let push = null
        let beat_progress = null
        let shot_request = 0
        const begin_flight = (end, duration) => {
            const scale_change = Math.abs(Math.log10(end.distance / view.distance))
            view.world = end.world
            flight = {
                start: copy_view(view),
                end,
                started: performance.now(),
                duration: duration * (1 + 0.3 * scale_change),
            }
        }
        const fly_to = async (shot, duration = 2200) => {
            const request = ++shot_request
            await ensure_world(places[shot.place].world)
            if (disposed || request !== shot_request) return
            const end = resolve_shot(shot)
            push = shot.push
                ? { from: end, to: resolve_shot(shot.push), until: shot.push_until ?? 0.6 }
                : null
            if (reduced_motion || duration === 0) {
                activate(end.world)
                view = copy_view(end)
                flight = null
                return
            }
            begin_flight(end, duration)
        }

        // Real links allow keyboard navigation, copying and opening places in another tab.
        let active_id = null
        const label_nodes = scene_pois.map((poi) => {
            const node = document.createElement('a')
            // Before the journey starts only these are shown, as names rather than links.
            if (poi.home) node.dataset.home = ''
            node.addEventListener('click', (event) => follow_link(event, () => on_poi(poi)))
            if (poi.detail) {
                // A small diamond; its name appears on hover, focus, or when it is open.
                node.className =
                    'group/poi absolute top-0 left-0 grid justify-items-center gap-[6px] p-[6px] bg-transparent border-0 pointer-events-auto [translate:-50%_-50%] [&[hidden]]:hidden'
                node.setAttribute('aria-label', poi.label)
                const mark = document.createElement('span')
                mark.className =
                    'size-[13px] rotate-45 rounded-[2px] bg-gold border border-solid border-gold-bright shadow-[0_0_0_4px_rgba(232,178,87,0.25),0_0_14px_rgba(255,214,138,0.7)] transition-transform duration-200 ease-[ease] group-hover/poi:scale-125 group-data-[active=true]/poi:scale-125'
                const name = document.createElement('span')
                name.className =
                    'absolute top-full py-[4px] px-[10px] text-[#fff8ea] bg-[rgba(17,14,10,0.78)] border border-solid border-[rgba(255,236,200,0.4)] rounded-full font-serif text-[0.875rem] whitespace-nowrap opacity-0 transition-opacity duration-200 ease-[ease] group-hover/poi:opacity-100 group-focus-visible/poi:opacity-100 group-data-[active=true]/poi:opacity-100'
                name.textContent = poi.label
                node.append(mark, name)
                labels.append(node)
                return { poi, node }
            }
            node.className =
                "group/poi absolute top-0 left-0 grid justify-items-center max-w-[15rem] pt-0 px-0 pb-[26px] bg-transparent border-0 pointer-events-auto [translate:-50%_-100%] [&[hidden]]:hidden after:absolute after:bottom-0 after:left-1/2 after:w-px after:h-6 after:bg-[linear-gradient(rgba(255,240,210,0.9),rgba(255,240,210,0))] after:content-['']"
            const name = document.createElement('span')
            name.className =
                'py-[6px] px-[13px] text-[#fff8ea] bg-[rgba(17,14,10,0.62)] border border-solid border-[rgba(255,236,200,0.4)] rounded-full font-serif text-[1rem] font-medium whitespace-nowrap backdrop-blur-[6px] transition-[background,color,border-color] duration-200 ease-[ease] group-hover/poi:text-gold-ink group-hover/poi:bg-gold group-hover/poi:border-gold-bright group-data-[active=true]/poi:text-gold-ink group-data-[active=true]/poi:bg-gold group-data-[active=true]/poi:border-gold-bright mobile:text-[0.875rem]'
            name.textContent = poi.label
            const note = document.createElement('span')
            note.className =
                'hidden -order-1 mb-2 py-[9px] px-3 text-ink bg-panel-solid border border-solid border-line rounded-[10px] text-[0.8125rem] leading-[1.45] text-left group-data-[active=true]/poi:block group-data-[place-card=true]/stage:hidden!'
            note.textContent = poi.description
            node.append(name, note)
            labels.append(node)
            return { poi, node }
        })
        // Evidence: one point of light per cited passage (excerpts of one work at one place
        // share it), clustered where passages share a place. The current stage's passages
        // stay bright; the rest dim but can still be opened.
        let evidence_on = false
        let evidence_focus = new Set()
        // Passages cited by the paragraph being narrated, and the one open in the panel.
        let evidence_cue = new Set()
        let evidence_open = null
        // A kind chosen in the legend: only that kind's markers show.
        let evidence_kind = null
        // A newly opened source whose marker is out of sight gets one pan to bring it in.
        let evidence_reveal = null
        let evidence_link = null
        const evidence_nodes = new Map()
        // One preview card, shown above whichever marker is hovered or focused.
        const preview = document.createElement('div')
        preview.className =
            'absolute top-0 left-0 z-10 grid w-[22rem] gap-[6px] rounded-xl border border-solid border-line-strong bg-popover px-4 py-3 text-popover-foreground mobile:w-64 mobile:gap-1 mobile:rounded-lg mobile:px-3 mobile:py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] pointer-events-none [translate:-50%_calc(-100%-14px)] data-[below=true]:[translate:-50%_14px] [&[hidden]]:hidden'
        preview.hidden = true
        const preview_title = document.createElement('p')
        preview_title.className = 'text-[0.9375rem] font-semibold mobile:text-xs'
        const preview_text = document.createElement('p')
        preview_text.className =
            'line-clamp-4 font-arabic text-[1.1875rem] leading-[1.8] text-ink-soft mobile:line-clamp-3 mobile:text-[0.9375rem] mobile:leading-[1.7]'
        preview_text.lang = 'ar'
        preview_text.dir = 'rtl'
        preview.append(preview_title, preview_text)
        labels.append(preview)
        let previewed = null
        const show_preview = (entry) => {
            previewed = entry
            const id =
                entry.group.ids.find((item) => evidence_focus.has(item)) ?? entry.group.ids[0]
            const source = chapter.sources.find((item) => item.id === id)
            preview_title.textContent = entry.group.reference
            preview_text.textContent = source?.excerpt ?? ''
            preview_text.hidden = !source?.excerpt
            place_preview()
            preview.hidden = false
        }
        // Above the marker, or below it in the upper part of the view, where panels sit.
        const place_preview = () => {
            preview.style.left = previewed.node.style.left
            preview.style.top = previewed.node.style.top
            preview.dataset.below = String(
                parseFloat(previewed.node.style.top) < host.clientHeight * 0.45,
            )
        }
        const hide_preview = (entry) => {
            if (entry && previewed !== entry) return
            previewed = null
            preview.hidden = true
        }
        const evidence_node = (group) => {
            if (evidence_nodes.has(group.id)) return evidence_nodes.get(group.id)
            const node = document.createElement('a')
            // A ring pings around passages the narration is citing; the open one is enlarged.
            node.className = `absolute top-0 left-0 size-[11px] p-0 rounded-full border border-solid border-[rgba(255,255,255,0.7)] pointer-events-auto [translate:-50%_-50%] transition-[transform,opacity] duration-200 ease-[ease] hover:scale-150 focus-visible:scale-150 data-[dim=true]:scale-75 data-[dim=true]:opacity-40 data-[dim=true]:hover:scale-125 data-[dim=true]:hover:opacity-100 data-[open=true]:scale-150 data-[open=true]:opacity-100 after:absolute after:-inset-[5px] after:rounded-full after:border-2 after:border-solid after:border-[rgba(255,248,234,0.85)] after:opacity-0 after:content-[''] data-[cue=true]:after:opacity-100 data-[cue=true]:after:animate-ping motion-reduce:data-[cue=true]:after:animate-none data-[open=true]:after:opacity-100 data-[open=true]:after:animate-none [&[hidden]]:hidden ${evidence_dot[group.kind]}`
            node.setAttribute('aria-label', group.reference)
            node.hidden = true
            // Open the excerpt the current stage cites, when it cites one.
            const opened = () => group.ids.find((id) => evidence_focus.has(id)) ?? group.ids[0]
            node.addEventListener('click', (event) => {
                hide_preview()
                follow_link(event, () => on_source(opened()))
            })
            if (evidence_link)
                node.href = journey_href(
                    `/journey/hijrah/sources/${group.ids[0]}`,
                    ...evidence_link,
                )
            labels.append(node)
            const entry = { node, group }
            node.addEventListener('pointerenter', () => show_preview(entry))
            node.addEventListener('focus', () => show_preview(entry))
            node.addEventListener('pointerleave', () => hide_preview(entry))
            node.addEventListener('blur', () => hide_preview(entry))
            evidence_nodes.set(group.id, entry)
            return entry
        }
        api.set_links = (context, at) => {
            for (const { poi, node } of label_nodes)
                node.href = journey_href(`/places/${poi.id}`, context, at)
            evidence_link = [context, at]
            for (const { node, group } of evidence_nodes.values())
                node.href = journey_href(`/journey/hijrah/sources/${group.ids[0]}`, context, at)
        }
        const chapter_nodes = new Map()
        api.set_chapters = (items) => {
            for (const [id, { node, line }] of chapter_nodes) {
                if (items.some((item) => item.id === id)) continue
                node.remove()
                line.remove()
                chapter_nodes.delete(id)
            }
            for (const item of items) {
                let entry = chapter_nodes.get(item.id)
                if (!entry) {
                    const point = places[item.place]
                    const [x, z] = landscape.to_xz(point.lat, point.lon)
                    const node = document.createElement('a')
                    node.id = `map-chapter-${item.id}`
                    node.dataset.chapter = item.id
                    node.className =
                        'group/book absolute left-0 top-0 grid justify-items-center pb-4 pointer-events-auto [translate:-50%_-100%] [&[hidden]]:hidden'
                    const mark = document.createElement('span')
                    mark.className =
                        'relative grid size-10 place-items-center rounded-full border border-gold-bright bg-gold text-gold-ink group-hover/book:bg-gold-bright'
                    mark.innerHTML =
                        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5v12.5c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5zM12 7v12.5"/></svg>'
                    const number = document.createElement('span')
                    number.className =
                        'absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border border-gold bg-panel-solid text-ink text-[11px]'
                    number.textContent = item.number
                    mark.append(number)
                    const name = document.createElement('span')
                    name.className =
                        'absolute bottom-full mb-2 w-max max-w-[220px] rounded-lg border border-line-strong bg-panel-solid px-3 py-2 text-center font-serif text-sm text-ink opacity-0 pointer-events-none group-hover/book:opacity-100 group-focus-visible/book:opacity-100'
                    name.dir = 'auto'
                    node.append(mark, name)
                    const line = document.createElement('span')
                    line.className =
                        'absolute left-0 top-0 h-px bg-gold pointer-events-none origin-left [&[hidden]]:hidden'
                    labels.append(line, node)
                    entry = {
                        line,
                        node,
                        name,
                        at: new THREE.Vector3(x, landscape.height(x, z) + 0.06, z),
                    }
                    chapter_nodes.set(item.id, entry)
                }
                entry.node.href = item.href
                entry.node.setAttribute('aria-label', item.title)
                entry.name.textContent = item.title
            }
        }
        const place_chapters = () => {
            const occupied = label_nodes
                .filter(({ poi, node }) => !poi.detail && !node.hidden)
                .map(({ node }) => node.getBoundingClientRect())
            for (const { node, line, at } of chapter_nodes.values()) {
                projected.copy(at).project(camera)
                const x = ((projected.x + 1) / 2) * host.clientWidth
                const y = ((1 - projected.y) / 2) * host.clientHeight
                node.hidden =
                    projected.z > 1 ||
                    projected.z < -1 ||
                    x < inset_target.left + 24 ||
                    x > host.clientWidth - inset_target.right - 24 ||
                    y < inset_target.top + 56 ||
                    y > host.clientHeight - inset_target.bottom
                line.hidden = node.hidden
                if (node.hidden) continue
                // Below the place first, so the place's own name above stays clear; chapters
                // sharing a place fan out in a row.
                const offsets = [
                    [0, 64],
                    [-52, 64],
                    [52, 64],
                    [-104, 64],
                    [104, 64],
                    [0, 116],
                    [-52, 116],
                    [52, 116],
                    [56, 0],
                    [-56, 0],
                ]
                const [dx, dy] =
                    offsets.find(([dx, dy]) => {
                        const left = x + dx - 24,
                            top = y + dy - 60
                        return (
                            left > inset_target.left &&
                            left + 48 < host.clientWidth - inset_target.right &&
                            top > inset_target.top &&
                            top + 48 < host.clientHeight - inset_target.bottom &&
                            occupied.every(
                                (rect) =>
                                    left + 48 < rect.left ||
                                    left > rect.right ||
                                    top + 48 < rect.top ||
                                    top > rect.bottom,
                            )
                        )
                    }) ?? offsets[0]
                node.style.transform = `translate(${x + dx}px, ${y + dy}px)`
                line.style.width = `${Math.hypot(dx, dy - 16)}px`
                line.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(dy - 16, dx)}rad)`
                occupied.push({
                    left: x + dx - 24,
                    right: x + dx + 24,
                    top: y + dy - 60,
                    bottom: y + dy - 12,
                })
            }
        }
        // Pan, at the same angle and distance, so the opened source's marker sits in the open
        // part of the view rather than off screen or under a panel.
        const reveal_evidence = (width, height) => {
            const id = evidence_reveal
            evidence_reveal = null
            if (!evidence_on || flight) return
            const cluster = [...active.evidence.values()].find(({ groups }) =>
                groups.some((group) => group.ids.includes(id)),
            )
            if (!cluster) return
            const target = cluster.at.clone().multiplyScalar(active.scale)
            projected.copy(target).project(camera)
            const x = ((projected.x + 1) / 2) * width
            const y = ((1 - projected.y) / 2) * height
            const margin = 48
            const in_view =
                projected.z < 1 &&
                x > inset_target.left + margin &&
                x < width - inset_target.right - margin &&
                y > inset_target.top + margin &&
                y < height - inset_target.bottom - margin
            if (in_view) return
            if (reduced_motion) view = { ...copy_view(view), target }
            else begin_flight({ ...copy_view(view), target }, 1400)
        }
        const place_evidence = () => {
            const width = host.clientWidth
            const height = host.clientHeight
            const shown = new Set()
            if (evidence_on) {
                for (const { at, groups } of active.evidence.values()) {
                    projected.copy(at).multiplyScalar(active.scale).project(camera)
                    if (
                        projected.z > 1 ||
                        Math.abs(projected.x) > 1.1 ||
                        Math.abs(projected.y) > 1.1
                    )
                        continue
                    const x = ((projected.x + 1) / 2) * width
                    const y = ((1 - projected.y) / 2) * height
                    // A sunflower spiral keeps a cluster readable at any size, with the
                    // current stage's passages at its centre.
                    const focused = (group) => group.ids.some((id) => evidence_focus.has(id))
                    const kept = groups.filter(
                        (group) => !evidence_kind || group.kind === evidence_kind,
                    )
                    const ordered = [
                        ...kept.filter(focused),
                        ...kept.filter((group) => !focused(group)),
                    ]
                    ordered.forEach((group, index) => {
                        const { node } = evidence_node(group)
                        const radius = 9 * Math.sqrt(index)
                        const angle = index * 2.39996
                        node.style.left = `${x + radius * Math.cos(angle)}px`
                        node.style.top = `${y + radius * Math.sin(angle)}px`
                        node.dataset.dim = String(!focused(group))
                        node.dataset.cue = String(group.ids.some((id) => evidence_cue.has(id)))
                        node.dataset.open = String(group.ids.includes(evidence_open))
                        shown.add(group.id)
                    })
                }
            }
            for (const [key, { node }] of evidence_nodes) node.hidden = !shown.has(key)
            if (evidence_reveal) reveal_evidence(width, height)
            if (previewed && previewed.node.hidden) hide_preview()
            else if (previewed) place_preview()
        }
        const insets = { left: 0, right: 0, bottom: 0, top: 0 }
        const inset_target = { left: 0, right: 0, bottom: 0, top: 0 }
        const projected = new THREE.Vector3()
        const place_labels = () => {
            const width = host.clientWidth
            const height = host.clientHeight
            for (const { node, poi } of label_nodes) {
                const anchor = active.anchors.get(poi.id)
                if (
                    !anchor ||
                    (poi.detail && evidence_on) ||
                    view.distance > (poi.within ?? Infinity) * active.scale ||
                    view.distance < (poi.beyond ?? 0) * active.scale
                ) {
                    node.hidden = true
                    continue
                }
                projected.copy(anchor).multiplyScalar(active.scale).project(camera)
                const x = ((projected.x + 1) / 2) * width
                const y = ((1 - projected.y) / 2) * height
                // Labels that would sit under the chapter rail or the side sheet are dropped.
                const visible =
                    projected.z < 1 &&
                    projected.y < 1.1 &&
                    x > inset_target.left + 30 &&
                    x < width - inset_target.right - 30 &&
                    y > inset_target.top
                node.hidden = !visible
                if (!visible) continue
                node.style.transform = `translate(${x}px, ${y}px)`
                node.dataset.active = String(poi.id === active_id)
                if (poi.id === active_id) node.setAttribute('aria-current', 'location')
                else node.removeAttribute('aria-current')
            }
        }

        // Drag to look around, scroll to move closer.
        let dragging = false
        let last_x = 0
        let last_y = 0
        const pointer_down = (event) => {
            if (event.target !== renderer.domElement) return
            dragging = true
            last_x = event.clientX
            last_y = event.clientY
            host.setPointerCapture?.(event.pointerId)
            host.dataset.dragging = 'true'
        }
        const pointer_move = (event) => {
            if (!dragging) return
            flight = null
            push = null
            view.azimuth -= (event.clientX - last_x) * 0.005
            view.elevation = clamp(view.elevation + (event.clientY - last_y) * 0.004, -0.6, 1.3)
            last_x = event.clientX
            last_y = event.clientY
        }
        const pointer_up = () => {
            dragging = false
            host.dataset.dragging = 'false'
        }
        const wheel = (event) => {
            event.preventDefault()
            flight = null
            push = null
            // A trackpad pinch arrives as ctrl+wheel in small steps; scale it to keep pace
            // with the fingers. Line-based wheels (Firefox) report lines, not pixels.
            const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : 1)
            view.distance = clamp(
                view.distance * Math.exp(pixels * (event.ctrlKey ? 0.01 : 0.001)),
                ...world_definitions.region.zoom,
            )
            // An overview target can sit kilometres above ground; close orbit must not.
            view.target.y = Math.min(
                view.target.y,
                landscape.height(view.target.x, view.target.z) + view.distance * 0.5,
            )
        }
        host.addEventListener('pointerdown', pointer_down)
        host.addEventListener('pointermove', pointer_move)
        host.addEventListener('pointerup', pointer_up)
        host.addEventListener('pointercancel', pointer_up)
        host.addEventListener('wheel', wheel, { passive: false })
        cleanup_controls = () => {
            host.removeEventListener('pointerdown', pointer_down)
            host.removeEventListener('pointermove', pointer_move)
            host.removeEventListener('pointerup', pointer_up)
            host.removeEventListener('pointercancel', pointer_up)
            host.removeEventListener('wheel', wheel)
        }

        const follow_point = new THREE.Vector3()

        // Animals are plain low-poly figures, always riderless. Built one unit tall, facing +x.
        // `points` colours the head and legs apart from the body.
        const build_animal = ({ color, points = color, body, hump, tail, neck, head, legs }) => {
            const material = (value) =>
                new THREE.MeshStandardMaterial({ color: value, roughness: 1, flatShading: true })
            const coat = material(color)
            const markings = points === color ? coat : material(points)
            const part = (size, position, tilt = 0, parent, look = coat) => {
                const mesh = shadowed(new THREE.Mesh(block_geometry, look))
                mesh.scale.set(...size)
                mesh.position.set(...position)
                mesh.rotation.z = tilt
                parent.add(mesh)
                return mesh
            }
            const root = new THREE.Group()
            const torso = new THREE.Group()
            root.add(torso)
            part(body.size, body.at, 0, torso)
            if (hump) part(hump.size, hump.at, 0.5, torso)
            if (tail) part(tail.size, tail.at, 0, torso)
            part(neck.size, neck.at, neck.tilt, torso)
            part(head.size, head.at, head.tilt ?? 0, torso, markings)
            const limbs = legs.at.map(([x, z]) => {
                const hip = new THREE.Group()
                hip.position.set(x, legs.top, z)
                part([legs.width, legs.top, legs.width], [0, -legs.top / 2, 0], 0, hip, markings)
                torso.add(hip)
                return hip
            })
            root.visible = false
            scene.add(root)
            return { root, torso, limbs, top: legs.top }
        }
        const camel = build_animal({
            color: 0xc79a62,
            body: { size: [0.95, 0.36, 0.34], at: [0, 0.74, 0] },
            hump: { size: [0.3, 0.3, 0.28], at: [-0.05, 0.96, 0] },
            neck: { size: [0.15, 0.55, 0.15], at: [0.54, 0.98, 0], tilt: -0.55 },
            head: { size: [0.3, 0.14, 0.15], at: [0.76, 1.22, 0], tilt: -0.1 },
            legs: {
                top: 0.6,
                width: 0.09,
                at: [
                    [0.36, 0.11],
                    [0.36, -0.11],
                    [-0.36, 0.11],
                    [-0.36, -0.11],
                ],
            },
        })
        const horse = build_animal({
            color: 0x5a4030,
            body: { size: [0.9, 0.32, 0.28], at: [0, 0.72, 0] },
            neck: { size: [0.16, 0.48, 0.14], at: [0.48, 0.96, 0], tilt: -0.75 },
            head: { size: [0.32, 0.15, 0.13], at: [0.72, 1.12, 0], tilt: -0.5 },
            legs: {
                top: 0.58,
                width: 0.08,
                at: [
                    [0.36, 0.09],
                    [0.36, -0.09],
                    [-0.36, 0.09],
                    [-0.36, -0.09],
                ],
            },
        })
        // A fat-tailed ewe of the region: pale wool, brown face and legs.
        const ewe = build_animal({
            color: 0xeee4cf,
            points: 0x5e3f2a,
            body: { size: [0.74, 0.44, 0.44], at: [0, 0.58, 0] },
            tail: { size: [0.16, 0.3, 0.3], at: [-0.42, 0.5, 0] },
            neck: { size: [0.14, 0.26, 0.14], at: [0.38, 0.74, 0], tilt: -0.5 },
            head: { size: [0.3, 0.18, 0.17], at: [0.52, 0.84, 0], tilt: -0.45 },
            legs: {
                top: 0.4,
                width: 0.07,
                at: [
                    [0.24, 0.11],
                    [0.24, -0.11],
                    [-0.24, 0.11],
                    [-0.24, -0.11],
                ],
            },
        })
        // A goat-hair tent, 0.85 units tall at the ridge, its open front facing +x. Its ewe and
        // the milking vessel stand in the same frame.
        const tent = new THREE.Group()
        {
            const material = (color) =>
                new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })
            const cloth = material(0x3b302a)
            const band = material(0x8b6a48)
            const wood = material(0x6e5238)
            const part = (mat, size, position, tilt = 0) => {
                const mesh = shadowed(new THREE.Mesh(block_geometry, mat))
                mesh.scale.set(...size)
                mesh.position.set(...position)
                mesh.rotation.z = tilt
                tent.add(mesh)
                return mesh
            }
            // The roof falls steeply to the closed back and lifts as an awning over the front,
            // held out by guy ropes. Pale bands run across the dark goat hair.
            const roof = [
                [0.9, [-0.4, 0.65], 0.46],
                [0.84, [0.4, 0.735], -0.28],
            ]
            for (const [length, [x, y], tilt] of roof) {
                part(cloth, [length, 0.04, 2.4], [x, y, 0], tilt)
                for (const z of [-0.6, 0.6]) part(band, [length, 0.046, 0.14], [x, y, z], tilt)
            }
            part(cloth, [0.04, 0.46, 2.4], [-0.8, 0.23, 0])
            for (const side of [-1.18, 1.18]) part(cloth, [0.82, 0.44, 0.04], [-0.4, 0.22, side])
            for (const z of [-0.8, 0, 0.8]) part(wood, [0.045, 0.85, 0.045], [0, 0.425, z])
            const rope = material(0xcbb58a)
            for (const z of [-1.1, 0, 1.1]) {
                part(wood, [0.04, 0.62, 0.04], [0.8, 0.31, z])
                part(rope, [0.83, 0.012, 0.012], [1.075, 0.31, z], -0.845)
            }
            // A woven mat on the ground under the awning.
            part(material(0x8a3a28), [0.6, 0.012, 1.1], [0.3, 0.006, 0])
            ewe.root.visible = true
            tent.add(ewe.root)
        }
        const vessel = shadowed(
            new THREE.Mesh(
                new THREE.CylinderGeometry(0.13, 0.09, 0.1, 10),
                new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.9 }),
            ),
        )
        tent.add(vessel)
        tent.visible = false
        scene.add(tent)
        let actor = null
        // Video capture can hide the route lines for scenic shots.
        let routes_shown = true
        const heading = new THREE.Vector3()
        // Puts an animal on a route at its drawn head, facing along it.
        const stand_on = (animal, route, size) => {
            const index = Math.min(route.count - 1, Math.floor(route.shown * route.count))
            const here = route.points[index]
            heading.subVectors(route.points[index + 1], here)
            const world = worlds[route.world]
            animal.root.position.copy(here).multiplyScalar(world.scale)
            animal.root.position.y = world.terrain.height(here.x, here.z) * world.scale
            animal.root.rotation.y = Math.atan2(-heading.z, heading.x)
            animal.root.scale.setScalar(size * world.scale)
            animal.root.visible = true
        }
        const dust_points = []
        for (let index = 0; index < 500; index += 1)
            dust_points.push(
                hash(index, 91) - 0.5,
                hash(index, 92) * 0.5 - 0.15,
                hash(index, 93) - 0.5,
            )
        const dust_geometry = new THREE.BufferGeometry()
        dust_geometry.setAttribute('position', new THREE.Float32BufferAttribute(dust_points, 3))
        const dust_material = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            fog: false,
            blending: THREE.AdditiveBlending,
        })
        const dust = new THREE.Points(dust_geometry, dust_material)
        dust.frustumCulled = false
        scene.add(dust)

        const traveller = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }),
        )
        traveller.visible = false
        scene.add(traveller)

        // The night visitors at Thawr are lights with a fading tail, never figures. Each night,
        // in the order of ‘A'ishah's report: ‘Abdullah comes up from Makkah when it is dark,
        // ‘Amir brings the flock up some time after, ‘Abdullah leaves in the last part of the
        // night, and ‘Amir calls the flock away at the dark of dawn.
        const lantern_geometry = new THREE.SphereGeometry(1, 12, 8)
        const make_visitor = (head, tail, glow, schedule) => {
            const group = new THREE.Group()
            for (let index = 0; index < 20; index += 1)
                group.add(
                    new THREE.Mesh(
                        lantern_geometry,
                        new THREE.MeshBasicMaterial({
                            color: index ? tail : head,
                            fog: false,
                            transparent: true,
                            opacity: index ? 0.4 * (1 - index / 20) : 1,
                            depthWrite: false,
                            blending: THREE.AdditiveBlending,
                        }),
                    ),
                )
            // A wide, faint glow lifts the light off the bright route line and the slope.
            const halo = new THREE.Mesh(
                lantern_geometry,
                new THREE.MeshBasicMaterial({
                    color: glow,
                    fog: false,
                    transparent: true,
                    opacity: 0.12,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                }),
            )
            group.visible = halo.visible = false
            scene.add(group, halo)
            return { group, halo, schedule }
        }
        // Night phases: up between the first pair, down between the second.
        const abdullah = make_visitor(0xffc461, 0xff9a2e, 0xffb347, [0.02, 0.2, 0.3, 0.46])
        const amir = make_visitor(0xb9d4ff, 0x7fa6ff, 0x9fbfff, [0.21, 0.29, 0.44, 0.54])
        // ‘Amir's flock: pale specks that graze low on the slope by day and go up with him.
        const flock_material = new THREE.MeshBasicMaterial({ color: 0xeee3c8, fog: false })
        const flock = Array.from({ length: 8 }, () => {
            const sheep = new THREE.Mesh(lantern_geometry, flock_material)
            sheep.visible = false
            scene.add(sheep)
            return sheep
        })
        // ‘Abdullah's climb from the foot of the road to the shelter, in metres [north, east]
        // of the shelter: round the east shoulder of the summit.
        const climb_way = [
            [330, 260],
            [120, 330],
        ]
        // Where the flock grazes, in kilometres [north, east] of the shelter.
        const pasture = [-0.15, 0.25]
        // The searchers at Thawr are dim red lights, never figures. They comb the slopes, close
        // in on the shelter, stand over it while Abu Bakr whispers, then move off. Places are
        // metres [north, east] of the shelter; one stands on the rock above it. They
        // start on the far slopes so the camera, north of the opening, sees them all.
        const searcher_plan = [
            { from: [-42, -30], to: [-0.5, -1.6], roof: true, bend: 10 },
            { from: [-30, 38], to: [-3, 7], bend: -12 },
            { from: [-55, 6], to: [-8, -6], bend: 8 },
            { from: [8, 50], to: [-5, 10], bend: -9 },
        ]
        const searcher_glow = (color, opacity, depthTest) =>
            new THREE.MeshBasicMaterial({
                color,
                fog: false,
                transparent: true,
                opacity,
                depthTest,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })
        const searchers = searcher_plan.map((plan, index) => {
            const core = new THREE.Mesh(lantern_geometry, searcher_glow(0xffa184, 1, true))
            const glow = new THREE.Mesh(lantern_geometry, searcher_glow(0xff2a14, 0.2, false))
            core.visible = glow.visible = false
            scene.add(core, glow)
            const away = Math.atan2(plan.from[1], plan.from[0]) + 0.9 + index * 0.4
            return { ...plan, core, glow, away, height: null }
        })
        const ray = new THREE.Raycaster()
        const down = new THREE.Vector3(0, -1, 0)
        // Height of the ground or rock at a set position, in world units.
        const cave_height = (world, north, east, roof) => {
            const x = world.cave_site.x + north * METRE
            const z = world.cave_site.z + east * METRE
            const reach = Math.hypot(north, east)
            let y =
                reach < 55
                    ? world.cave_ground(north, east)
                    : mix(
                          world.cave_ground(north, east),
                          world.terrain.height(x, z),
                          smoothstep(55, 70, reach),
                      )
            if (roof && world.cave_shelter) {
                world.group.updateMatrixWorld()
                const origin = new THREE.Vector3(x, y + 40 * METRE, z)
                world.group.localToWorld(origin)
                ray.set(origin, down)
                const hit = ray.intersectObject(world.cave_shelter, true)[0]
                if (hit) y = Math.max(y, world.group.worldToLocal(hit.point.clone()).y)
            }
            return y
        }
        const searcher_at = new THREE.Vector3()
        const smooth = (value) => value * value * (3 - 2 * value)
        // How far up a visitor's way it is in one night's phase: 0 below, 1 at the cave.
        const visit_reach = ([up, arrived, down, gone], phase) => {
            if (phase < up || phase >= gone) return 0
            if (phase < arrived) return smooth((phase - up) / (arrived - up))
            if (phase < down) return 1
            return smooth(1 - (phase - down) / (gone - down))
        }
        // ‘Amir's way runs straight up from the pasture to the shelter.
        const pasture_way = (world, reach, target) => {
            const site = world.cave_site
            const north = pasture[0] * (1 - reach)
            const east = pasture[1] * (1 - reach)
            const x = site.x + north
            const z = site.z + east
            const y = mix(world.terrain.height(x, z), site.y, smoothstep(0.85, 1, reach))
            return target.set(x, y, z).multiplyScalar(world.scale)
        }
        const along = (route, reach, target) => {
            const at = clamp(reach, 0, 1) * route.count
            const index = Math.min(route.count - 1, Math.floor(at))
            return target
                .lerpVectors(route.points[index], route.points[index + 1], at - index)
                .multiplyScalar(worlds[route.world].scale)
        }

        const ease_in_out = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
        let previous = performance.now()
        const render = (now) => {
            if (disposed) return
            const delta = clamp((now - previous) / 1000, 0, 0.1)
            previous = now
            const ease = reduced_motion ? 1 : 1 - Math.exp(-delta * 2.2)
            cycle = cycle_signal.read(now)
            beat_progress = progress_signal.read(now)

            // How far into a flight the camera is, for keeping it clear of the ground.
            let lift = 0
            if (push && beat_progress !== null) {
                const t = reduced_motion ? 1 : smoothstep(0, 1, beat_progress / push.until)
                const { from, to } = push
                const turn = Math.atan2(
                    Math.sin(to.azimuth - from.azimuth),
                    Math.cos(to.azimuth - from.azimuth),
                )
                const pushed = {
                    ...from,
                    azimuth: from.azimuth + turn * t,
                    elevation: mix(from.elevation, to.elevation, t),
                    fov: mix(from.fov, to.fov, t),
                    distance: Math.exp(mix(Math.log(from.distance), Math.log(to.distance), t)),
                    target: from.target.clone().lerp(to.target, 1 - (1 - t) ** 3),
                }
                if (flight) flight.end = pushed
                else view = pushed
            }
            if (flight) {
                const progress = clamp((now - flight.started) / flight.duration, 0, 1)
                const eased = ease_in_out(progress)
                const { start, end } = flight
                const turn = Math.atan2(
                    Math.sin(end.azimuth - start.azimuth),
                    Math.cos(end.azimuth - start.azimuth),
                )
                view.azimuth = start.azimuth + turn * eased
                view.elevation = mix(start.elevation, end.elevation, eased)
                view.fov = mix(start.fov, end.fov, eased)
                // Distances span five orders of magnitude, so they are eased on a log scale,
                // and the target arrives early on the way in and leaves late on the way out.
                view.distance = Math.exp(
                    mix(Math.log(start.distance), Math.log(end.distance), eased),
                )
                const reach = end.distance < start.distance ? 1 - (1 - eased) ** 3 : eased ** 3
                view.target.lerpVectors(start.target, end.target, reach)
                // A long zoom climbs to a cruising elevation and descends only within a few
                // lengths of the close end, so it lands and takes off rather than skimming the
                // ground. Both ends keep their authored elevation.
                const [low, high] = start.distance < end.distance ? [start, end] : [end, start]
                const range = Math.log(high.distance / low.distance)
                const out = Math.log(view.distance / low.distance)
                if (range > Math.log(8)) {
                    const cruise = Math.max(high.elevation, 0.45)
                    view.elevation = Math.max(
                        view.elevation,
                        mix(
                            low.elevation,
                            mix(
                                cruise,
                                high.elevation,
                                smoothstep(range - Math.log(3), range, out),
                            ),
                            smoothstep(0, Math.log(3), out),
                        ),
                    )
                }
                lift = Math.min(1, 3 * Math.sin(Math.PI * eased))
                if (progress === 1) flight = null
            }
            if (cycle === null) blend_mood(ease, mood_target)
            else {
                const phase = (cycle * 3) % 1
                const name = cycle >= 1 ? 'night' : night_phases.find(([until]) => phase < until)[1]
                blend_mood(reduced_motion ? 1 : 1 - Math.exp(-delta * 4), moods[name])
            }
            // The sky turns slowly at all times, and through three nights during the time-lapse.
            stars.rotation.set(0.6, 0, now / 400000 + (cycle ?? 0) * 3.2)

            for (const key of ['left', 'right', 'bottom', 'top'])
                insets[key] = mix(insets[key], inset_target[key], reduced_motion ? 1 : ease * 1.6)
            const width = host.clientWidth
            const height = host.clientHeight
            if (width && height) {
                camera.setViewOffset(
                    width,
                    height,
                    -(insets.left - insets.right) / 2,
                    (insets.bottom - insets.top) / 2,
                    width,
                    height,
                )
            }

            // Camera, fog and shadows all scale with how close the camera is.
            const distance = view.distance
            const local = Object.values(worlds).find((world) => {
                if (world.name === 'region' || distance > world.definition.zoom[1] * world.scale)
                    return false
                const [min_x, min_z, max_x, max_z] = world.bounds
                return (
                    view.target.x >= min_x &&
                    view.target.x <= max_x &&
                    view.target.z >= min_z &&
                    view.target.z <= max_z
                )
            })
            activate(local?.name ?? 'region')
            const azimuth =
                view.azimuth + (reduced_motion || dragging ? 0 : Math.sin(now / 9000) * 0.035)
            const horizontal = distance * Math.cos(view.elevation)
            camera.position.set(
                view.target.x + horizontal * Math.sin(azimuth),
                view.target.y + distance * Math.sin(view.elevation),
                view.target.z + horizontal * Math.cos(azimuth),
            )
            // Keep clear of the ground. In flight, keep further clear and rise over any ridge
            // between the camera and what it looks at; authored shots settle as they are.
            const position = camera.position
            let floor = landscape.height(position.x, position.z) + distance * 0.02
            if (lift > 0) {
                let flying = landscape.height(position.x, position.z) + distance * 0.15
                for (let step = 1; step < 8; step++) {
                    const along = step / 12
                    const x = mix(position.x, view.target.x, along)
                    const z = mix(position.z, view.target.z, along)
                    const sight = mix(position.y, view.target.y, along)
                    flying = Math.max(
                        flying,
                        position.y + (landscape.height(x, z) - sight) / (1 - along),
                    )
                }
                floor = Math.max(floor, mix(position.y, flying, lift))
            }
            position.y = Math.max(position.y, floor)
            camera.lookAt(view.target)
            camera.near = clamp(
                distance * 0.02,
                (METRE / world_definitions.region.km_per_unit) * 0.05,
                0.5,
            )
            camera.fov = view.fov
            camera.updateProjectionMatrix()
            sky.position.copy(camera.position)
            stars.position.copy(camera.position)
            const [fog_near, fog_far] = active.definition.fog
            scene.fog.near = Math.max(fog_near * active.scale, distance * 0.9)
            scene.fog.far = Math.max(fog_far * active.scale, distance * 3 + 10 * active.scale)

            const span = clamp(distance * 1.3, 0.03 * active.scale, 24 * active.scale)
            sun.target.position.copy(view.target)
            sun.position.copy(view.target).addScaledVector(mood.sun_at, span * 4)
            sun.shadow.camera.left = -span
            sun.shadow.camera.right = span
            sun.shadow.camera.top = span
            sun.shadow.camera.bottom = -span
            sun.shadow.camera.near = span * 0.5
            sun.shadow.camera.far = span * 9
            sun.shadow.camera.updateProjectionMatrix()
            sun.shadow.normalBias = span * 0.003

            let tip = null
            for (const world of Object.values(worlds)) {
                for (const route of world.routes) {
                    const target = clamp(
                        (leg_target[route.leg] - route.from) / (route.to - route.from),
                        0,
                        1,
                    )
                    route.shown = mix(
                        route.shown,
                        target,
                        reduced_motion ? 1 : 1 - Math.exp(-delta * 2.5),
                    )
                    if (Math.abs(route.shown - target) < 0.002) route.shown = target
                    route.line.geometry.instanceCount = Math.floor(route.shown * route.count)
                    // At human scale the route is a line on a map, not something in the scene.
                    const mapped = world === active && distance > 0.3 * active.scale && routes_shown
                    route.line.visible = mapped && route.shown > 0.002
                    route.trace.visible = mapped
                    if (world === active && route.shown > 0.002 && route.shown < 0.998) tip = route
                }
            }
            // The camel walks the last leg into Madinah and kneels where it ends.
            const last_leg = worlds.madinah?.routes.find((route) => route.leg === 2)
            const walking = active.name === 'madinah' && last_leg?.shown > 0.002
            camel.root.visible = false
            if (walking) {
                stand_on(camel, last_leg, 0.05)
                const arrived = last_leg.shown >= 0.998
                const stride = arrived || reduced_motion ? 0 : Math.sin(now / 170) * 0.45
                camel.limbs.forEach((limb, index) => {
                    limb.rotation.z = index % 3 === 0 ? stride : -stride
                    limb.scale.y = mix(limb.scale.y, arrived ? 0.25 : 1, 1 - Math.exp(-delta * 3))
                })
                camel.torso.position.y = (camel.limbs[0].scale.y - 1) * camel.top
            }
            // The pursuing horse stands at the head of the line, forelegs sunk to the knee.
            const road_leg = worlds.region?.routes.find((route) => route.leg === 1)
            horse.root.visible = false
            if (actor === 'horse' && active.name === 'region' && road_leg) {
                stand_on(horse, road_leg, 0.22)
                horse.limbs[0].scale.y = horse.limbs[1].scale.y = 0.45
                horse.torso.rotation.z = -0.2
                horse.torso.position.y = -0.06
            }
            // At Umm Ma‘bad's tent the ewe first lies dry beside it, then stands before the
            // open front with the vessel at its side.
            tent.visible = (actor === 'tent' || actor === 'ewe') && active.name === 'region'
            if (tent.visible) {
                const milked = actor === 'ewe'
                // Pitched just back from the line of the route, its front towards the camera.
                const ground = locate('tent')
                ground.x -= Math.sin(0.1) * 0.42
                ground.z -= Math.cos(0.1) * 0.42
                ground.y = active.terrain.height(ground.x, ground.z)
                tent.position.copy(ground).multiplyScalar(active.scale)
                tent.rotation.y = 0.1 - Math.PI / 2
                tent.scale.setScalar(0.24 * active.scale)
                ewe.root.scale.setScalar(0.5)
                // Side on to the camera in both beats.
                ewe.root.position.set(1.3, 0, milked ? 0.55 : 0.75)
                ewe.root.rotation.y = milked ? Math.PI / 2 : -Math.PI / 2
                ewe.limbs.forEach((limb) => (limb.scale.y = milked ? 1 : 0.3))
                ewe.torso.position.y = (ewe.limbs[0].scale.y - 1) * ewe.top
                vessel.visible = milked
                vessel.position.set(1.55, 0.05, 0.5)
            }
            const cave_path = worlds.makkah?.routes.find((route) => route.leg === 0)
            const visiting =
                (actor === 'visits_abdullah' || actor === 'visits_amir') &&
                cycle !== null &&
                cycle < 1 &&
                active.name === 'makkah' &&
                Boolean(cave_path && worlds.makkah.cave_site)
            const phase = ((cycle ?? 0) * 3) % 1
            const visitors = [
                [
                    abdullah,
                    actor === 'visits_abdullah',
                    // The path ends at the foot of the summit; the last stretch is to the shelter.
                    // The last stretch of the road from Makkah to the foot of the mountain, then,
                    // for most of the way, the climb up its face to the shelter.
                    (reach, target) => {
                        if (reach <= 0.3) return along(cave_path, 0.8 + (0.2 * reach) / 0.3, target)
                        // Up the mountain on the ground, round its east shoulder, the side the
                        // view faces; the road itself ends on the far, northern side.
                        const world = worlds.makkah
                        const foot = cave_path.points[cave_path.count]
                        const site = world.cave_site
                        const way = [
                            [foot.x, foot.z],
                            ...climb_way.map(([north, east]) => [
                                site.x + north * METRE,
                                site.z + east * METRE,
                            ]),
                            [site.x, site.z],
                        ]
                        const along_way = smooth((reach - 0.3) / 0.7) * (way.length - 1)
                        const leg = Math.min(way.length - 2, Math.floor(along_way))
                        const step = along_way - leg
                        const x = mix(way[leg][0], way[leg + 1][0], step)
                        const z = mix(way[leg][1], way[leg + 1][1], step)
                        const y = mix(
                            world.terrain.height(x, z),
                            site.y,
                            smoothstep(0.92, 1, along_way / (way.length - 1)),
                        )
                        return target.set(x, y, z).multiplyScalar(world.scale)
                    },
                ],
                [
                    amir,
                    actor === 'visits_amir',
                    (reach, target) => pasture_way(worlds.makkah, reach, target),
                ],
            ]
            for (const [visitor, focused, place] of visitors) {
                const reach = visit_reach(visitor.schedule, phase)
                const [, arrived, down] = visitor.schedule
                // A light shows only on the move; at the cave and by day there is nothing.
                visitor.group.visible = visiting && reach > 0 && reach < 1
                visitor.halo.visible = visitor.group.visible && focused
                if (!visitor.group.visible) continue
                const behind = phase < arrived ? -1 : phase >= down ? 1 : 0
                // A steady light that fades in setting out and out at the cave mouth; the
                // other visitor's is quieter while this paragraph is about someone else.
                const strength =
                    clamp(Math.min(reach, 1 - reach) / 0.08, 0, 1) * (focused ? 1 : 0.6)
                visitor.group.children.forEach((light, index) => {
                    place(reach + behind * index * 0.007, light.position)
                    light.position.y += distance * 0.004
                    light.scale.setScalar(distance * 0.0065 * (1 - index / 26) * strength)
                })
                visitor.halo.position.copy(visitor.group.children[0].position)
                visitor.halo.scale.setScalar(distance * 0.018 * strength)
            }
            // The flock grazes on the pasture by day and moves with ‘Amir at night, waiting
            // just below the shelter while the two drink.
            const flock_reach = visit_reach(amir.schedule, phase) * 0.97
            flock.forEach((sheep, index) => {
                sheep.visible = visiting
                if (!visiting) return
                const drift = reduced_motion ? 0 : now / 9000
                const angle = hash(index, 81) * Math.PI * 2 + drift * (0.3 + hash(index, 82))
                const spread = (0.008 + 0.014 * hash(index, 83)) * (1 - flock_reach * 0.5)
                pasture_way(worlds.makkah, flock_reach, sheep.position)
                sheep.position.x += Math.cos(angle) * spread * worlds.makkah.scale
                sheep.position.z += Math.sin(angle) * spread * worlds.makkah.scale
                sheep.position.y += distance * 0.002
                sheep.scale.setScalar(distance * 0.003)
            })
            const thawr = worlds.makkah
            const searching =
                actor === 'searchers' &&
                beat_progress !== null &&
                active.name === 'makkah' &&
                Boolean(thawr?.cave_ground)
            searchers.forEach((searcher, index) => {
                searcher.core.visible = searcher.glow.visible = false
                if (!searching) return
                // Close in over the first 55%, stand still, then leave over the last fifth. On the
                // way in each walks a gentle curve and stops twice, as if looking about.
                const delay = index * 0.03
                const walked = clamp((beat_progress - delay) / (0.55 - delay), 0, 1)
                const closing = walked - Math.sin(walked * Math.PI * 6) / (Math.PI * 6)
                const leaving = smooth(clamp((beat_progress - 0.8) / 0.2, 0, 1))
                const arriving = smooth(clamp((beat_progress - delay) / 0.08, 0, 1))
                if (leaving >= 1) return
                if (searcher.roof && searcher.height === null && thawr.cave_shelter)
                    searcher.height = cave_height(thawr, ...searcher.to, true)
                let [north, east] = searcher.to
                if (leaving > 0) {
                    north += Math.cos(searcher.away) * 50 * leaving
                    east += Math.sin(searcher.away) * 50 * leaving
                } else {
                    const [from_north, from_east] = searcher.from
                    const [to_north, to_east] = searcher.to
                    const length = Math.hypot(from_north - to_north, from_east - to_east)
                    const curve = (2 * closing * (1 - closing) * searcher.bend) / length
                    north = mix(from_north, to_north, closing) - (from_east - to_east) * curve
                    east = mix(from_east, to_east, closing) + (from_north - to_north) * curve
                }
                const ground =
                    searcher.roof && leaving === 0 && closing > 0.97 && searcher.height !== null
                        ? searcher.height
                        : cave_height(thawr, north, east, false)
                searcher_at
                    .set(
                        thawr.cave_site.x + north * METRE,
                        ground + 1.4 * METRE,
                        thawr.cave_site.z + east * METRE,
                    )
                    .multiplyScalar(thawr.scale)
                const fade = arriving * (1 - leaving)
                // Lights grow with distance so they stay visible, up to a metre or so across.
                const size = clamp(
                    distance * 0.0035,
                    0.12 * METRE * thawr.scale,
                    0.9 * METRE * thawr.scale,
                )
                searcher.core.position.copy(searcher_at)
                searcher.glow.position.copy(searcher_at)
                searcher.core.scale.setScalar(size * fade)
                searcher.glow.scale.setScalar(size * 2.6 * fade)
                searcher.core.visible = searcher.glow.visible = true
            })
            // The marker shows where the line is still being drawn, not a resting place.
            traveller.visible =
                Boolean(tip) &&
                !walking &&
                !horse.root.visible &&
                !tent.visible &&
                !abdullah.group.visible &&
                !amir.group.visible
            if (tip) {
                traveller.position
                    .copy(tip.points[Math.floor(tip.shown * tip.count)])
                    .multiplyScalar(worlds[tip.world].scale)
                // A following shot keeps the camera on the head of the line.
                if (!flight && !dragging && view.follow === tip.leg) {
                    follow_point
                        .copy(traveller.position)
                        .setY(traveller.position.y + 0.2 * active.scale)
                    view.target.lerp(follow_point, reduced_motion ? 1 : 1 - Math.exp(-delta * 1.6))
                }
                traveller.scale.setScalar(
                    distance * 0.007 * (reduced_motion ? 1 : 1 + 0.18 * Math.sin(now / 320)),
                )
            }
            for (const world of Object.values(worlds))
                world.rings.forEach((ring, index) => {
                    ring.visible = world === active
                    const pulse = reduced_motion ? 0 : (now / 4800 + index * 0.25) % 1
                    ring.scale.setScalar((distance / world.scale) * 0.009 * (1 + pulse * 0.22))
                    ring.material.opacity = 0.28 * (1 - pulse)
                })

            ripples.offset.set(now / 90000, now / 140000)
            grade.uniforms.time.value = reduced_motion ? 0 : (now / 1000) % 10
            // Dust hangs in the air close to the camera and catches the light by day.
            dust.position.copy(camera.position)
            dust.scale.setScalar(distance * 0.9)
            dust.rotation.y = reduced_motion ? 0 : now / 60000
            dust_material.opacity =
                0.5 * (1 - mood.stars) * smoothstep(8 * active.scale, 0.5 * active.scale, distance)
            dust_material.color.copy(mood.sun)
            composer.render()
            place_labels()
            place_chapters()
            place_evidence()
            frame = window.requestAnimationFrame(render)
        }
        frame = window.requestAnimationFrame(render)

        api.set_shot = fly_to
        api.set_mood = (name) => {
            mood_target = moods[name] ?? moods.gold
        }
        api.set_route = (progress) => {
            for (let leg = 0; leg < leg_target.length; leg += 1)
                leg_target[leg] = progress[leg] ?? 0
        }
        // `focus` lists the current stage's source ids, `cue` those the narration is citing,
        // and `open` the source shown in the panel; null hides the evidence.
        api.set_evidence = (state) => {
            evidence_on = Boolean(state)
            evidence_focus = new Set(state?.focus ?? [])
            evidence_cue = new Set(state?.cue ?? [])
            const open = state?.open ?? null
            if (open && open !== evidence_open) evidence_reveal = open
            evidence_open = open
            evidence_kind = state?.kind ?? null
            if (!evidence_on) hide_preview()
        }
        api.set_actor = (name) => {
            actor = name
        }
        api.set_progress = (value) => {
            progress_signal.set(value ?? null)
        }
        api.set_cycle = (value) => {
            cycle_signal.set(value ?? null)
        }
        api.set_active = (id) => {
            active_id = id
        }
        api.set_insets = (next) => Object.assign(inset_target, next)
        // Video capture only: the capture clock (video/clock.js) is present, and the shot
        // script drives the camera and sky directly. Never set in the app itself.
        api.set_routes_shown = (on) => {
            routes_shown = on
        }
        if (window.__capture) {
            window.__scene = api
            Object.assign(window.__capture, {
                scene,
                camera,
                renderer,
                landscape,
                inspect: () => ({
                    active: active.name,
                    distance: view.distance,
                    target: view.target.toArray(),
                }),
            })
        }
        report('ready')
        // The local terrain is fetched while the learner is still on the opening screen.
        ensure_world('makkah')
            .then(() => ensure_world('madinah'))
            .catch(() => {})
    } catch (error) {
        if (!disposed) report('failed', error)
    }

    api.dispose = () => {
        if (disposed) return
        disposed = true
        if (frame) window.cancelAnimationFrame(frame)
        resize_observer?.disconnect()
        cleanup_controls()
        renderer?.dispose()
        scene?.traverse((object) => {
            object.geometry?.dispose?.()
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            materials.filter(Boolean).forEach((material) => material.dispose?.())
        })
        scene = null
        host.replaceChildren()
    }
    return api
}
