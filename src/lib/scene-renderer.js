import {
    overview_shot,
    places,
    routes,
    scene_pois,
    shelter_asset,
    worlds as world_definitions,
} from './scene-manifest.js'
import { build_terrain, fbm, hash, load_grid } from './scene-terrain.js'

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
        sun: 0xa9c0ff,
        sun_power: 1.7,
        sun_at: [5, 7, 8],
        sky_light: 0x6f88d0,
        ground_light: 0x1a2038,
        ambient: 1.25,
        stars: 1,
        exposure: 1.2,
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

export async function create_scene(host, { on_poi = () => {}, report = () => {} } = {}) {
    let disposed = false
    let frame = 0
    let resize_observer
    let cleanup_controls = () => {}
    let renderer
    let scene
    const labels = document.createElement('div')
    labels.className =
        'absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-[0.6s] ease-[ease] group-data-[started=false]/stage:invisible group-data-[started=false]/stage:opacity-0'
    // Covers the cut between two scales of terrain.
    const veil = document.createElement('div')
    veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0'
    const api = {
        set_shot() {},
        set_mood() {},
        set_route() {},
        set_cycle() {},
        set_active() {},
        set_insets() {},
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
        host.replaceChildren(renderer.domElement, veil, labels)
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
        ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping
        ripples.repeat.set(140, 140)
        ripples.generateMipmaps = true
        ripples.minFilter = THREE.LinearMipmapLinearFilter
        ripples.magFilter = THREE.LinearFilter
        ripples.needsUpdate = true
        const sea_material = new THREE.MeshStandardMaterial({
            roughness: 0.22,
            metalness: 0.05,
            normalMap: ripples,
            normalScale: new THREE.Vector2(0.35, 0.35),
        })
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), sea_material)
        sea.rotation.x = -Math.PI / 2
        sea.receiveShadow = true
        scene.add(sea)

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
        const ring_geometry = new THREE.TorusGeometry(1, 0.09, 6, 32)
        ring_geometry.rotateX(Math.PI / 2)
        const dummy = new THREE.Object3D()
        const shadowed = (mesh) => {
            mesh.castShadow = true
            mesh.receiveShadow = true
            return mesh
        }

        // Schematic settlement: plain blocks on the level ground, no claimed architecture.
        const add_blocks = (world, place, count, radius, seed) => {
            const mesh = shadowed(new THREE.InstancedMesh(block_geometry, wall_material, count))
            const [cx, cz] = world.terrain.to_xz(places[place].lat, places[place].lon)
            for (let index = 0; index < count; index += 1) {
                const angle = hash(index, seed) * Math.PI * 2
                const reach = radius * Math.sqrt(hash(index, seed + 1))
                const x = cx + reach * Math.cos(angle)
                const z = cz + reach * Math.sin(angle)
                const tall = 0.016 + 0.024 * hash(index, seed + 4)
                const level = world.terrain.slope(x, z) < 0.22
                dummy.position.set(x, world.terrain.height(x, z) + tall / 2 - 0.002, z)
                dummy.rotation.set(0, hash(index, seed + 5) * 0.7, 0)
                dummy.scale.set(
                    0.03 + 0.035 * hash(index, seed + 2),
                    level ? tall : 0,
                    0.03 + 0.035 * hash(index, seed + 3),
                )
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
                            0.25 * fbm(north * 0.7, east * 0.7 + 3) -
                            5 * smoothstep(52, 70, reach))
                )
            }
            const patch_geometry = new THREE.PlaneGeometry(0.14, 0.14, 128, 128)
            patch_geometry.rotateX(-Math.PI / 2)
            const position = patch_geometry.attributes.position
            const colors = new Float32Array(position.count * 3)
            const rock = new THREE.Color(0xb08a5e)
            const dark = new THREE.Color(0x7d5f44)
            const tint = new THREE.Color()
            for (let index = 0; index < position.count; index += 1) {
                const north = position.getX(index) / METRE
                const east = position.getZ(index) / METRE
                position.setXYZ(index, sx + north * METRE, ground(north, east), sz + east * METRE)
                tint.copy(rock).lerp(dark, fbm(north * 0.35, east * 0.35 + 7) * 1.2)
                colors.set([tint.r, tint.g, tint.b], index * 3)
            }
            patch_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
            patch_geometry.computeVertexNormals()
            const patch = new THREE.Mesh(
                patch_geometry,
                new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
            )
            patch.receiveShadow = true
            world.group.add(patch)

            const boulder = (north, east, radius, squash = 0.75, sink = 0.35) => {
                const mesh = shadowed(new THREE.Mesh(boulder_geometry, stone_material))
                mesh.position.set(
                    sx + north * METRE,
                    ground(north, east) + radius * METRE * (squash - sink),
                    sz + east * METRE,
                )
                mesh.scale.set(radius * METRE, radius * squash * METRE, radius * METRE)
                mesh.rotation.set(north, east, radius)
                world.group.add(mesh)
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
            // A faint fill so the recess reads from inside. Three clamps the falloff of very
            // near lights, so at this scale the intensity is effectively the illuminance / 100.
            const fill = new THREE.PointLight(0xcdd6f0, 0.012, 0.008)
            fill.position.set(sx + 2.6 * METRE, ground(0, 0) + 0.7 * METRE, sz)
            world.group.add(fill)
            new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
                shelter_asset,
                (gltf) => {
                    if (disposed) return
                    const model = gltf.scene
                    const box = new THREE.Box3().setFromObject(model)
                    const size = box.getSize(new THREE.Vector3())
                    const centre = box.getCenter(new THREE.Vector3())
                    model.position.set(-centre.x, -box.min.y, -centre.z)
                    model.traverse((child) => {
                        if (!child.isMesh) return
                        shadowed(child)
                        child.material.normalScale?.setScalar(0.6)
                        child.material.color.setRGB(1, 0.8, 0.6)
                    })
                    // About nine metres across; the model's opening faces +x, which is north.
                    const scale = (9 * METRE) / Math.max(size.x, size.z)
                    const place = (north, east, grow, turn, sink) => {
                        const rock = new THREE.Group()
                        rock.add(north || east ? model.clone() : model)
                        rock.scale.setScalar(scale * grow)
                        rock.rotation.y = turn
                        rock.position.set(
                            sx + north * METRE,
                            ground(north, east) - size.y * scale * grow * sink,
                            sz + east * METRE,
                        )
                        world.group.add(rock)
                    }
                    place(0, 0, 1, 0, 0.04)
                    // The same rock, turned away and half buried, becomes the hillside
                    // behind and beside the shelter, so it sits in the slope, not on it.
                    place(-7.5, -1.5, 1.7, Math.PI * 0.95, 0.3)
                    place(-2.5, -8.5, 1.15, Math.PI * 0.6, 0.35)
                    place(-3, 8, 1.25, -Math.PI * 0.7, 0.35)
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

        // Worlds: one group per scale of terrain, built on first use.
        const route_materials = []
        const worlds = {}
        let active = null
        const leg_target = [0, 0, 0]
        const ensure_world = (name) => {
            if (worlds[name]) return worlds[name].ready
            const definition = world_definitions[name]
            const world = { name, definition, group: new THREE.Group(), routes: [], rings: [] }
            worlds[name] = world
            world.ready = load_grid(definition).then((grid) => {
                if (disposed) return world
                world.terrain = build_terrain(THREE, definition, grid)
                world.group.add(world.terrain.mesh)
                if (name === 'makkah') {
                    add_blocks(world, 'makkah', 260, 0.75, 11)
                    add_cave_set(world)
                }
                if (name === 'madinah') {
                    add_blocks(world, 'madinah', 150, 0.5, 41)
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
                    const count = 200
                    const draped = []
                    const points = plan.getSpacedPoints(count)
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

                world.group.visible = false
                scene.add(world.group)
                return world
            })
            return world.ready
        }
        const activate = (name) => {
            active = worlds[name]
            for (const world of Object.values(worlds)) world.group.visible = world === active
            sea.visible = active.definition.sea
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
        const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.7, 0.9)
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
                // Close shots are framed in metres and must not be pushed back.
                distance: shot.distance * (shot === wide.portrait || shot.distance < 1 ? 1 : fit),
                target,
            }
        }
        const copy_view = (source) => ({ ...source, target: source.target.clone() })
        let view = resolve_shot(overview_shot)
        let flight = null
        let cut = null
        let veil_level = 0
        let shot_request = 0
        const begin_flight = (end, duration) => {
            const scale_change = Math.abs(Math.log10(end.distance / view.distance))
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
            if (reduced_motion || duration === 0) {
                activate(end.world)
                view = copy_view(end)
                flight = null
                cut = null
                return
            }
            if (end.world === view.world) {
                cut = null
                begin_flight(end, duration)
                return
            }
            // Push in behind the veil, swap terrain, then descend into the new view.
            cut = { end, at: performance.now() + 520 }
            flight = {
                start: copy_view(view),
                end: { ...copy_view(view), distance: view.distance * 0.5 },
                started: performance.now(),
                duration: 700,
            }
        }

        // Place labels are real buttons, so the scene is explorable without a pointer.
        let active_id = null
        const label_nodes = scene_pois.map((poi) => {
            const node = document.createElement('button')
            node.type = 'button'
            node.className =
                "group/poi absolute top-0 left-0 grid justify-items-center max-w-[15rem] pt-0 px-0 pb-[26px] bg-transparent border-0 pointer-events-auto [translate:-50%_-100%] [&[hidden]]:hidden after:absolute after:bottom-0 after:left-1/2 after:w-px after:h-6 after:bg-[linear-gradient(rgba(255,240,210,0.9),rgba(255,240,210,0))] after:content-['']"
            const name = document.createElement('span')
            name.className =
                'py-[6px] px-[13px] text-[#fff8ea] bg-[rgba(17,14,10,0.62)] border border-solid border-[rgba(255,236,200,0.4)] rounded-full font-serif text-[1rem] font-medium whitespace-nowrap backdrop-blur-[6px] transition-[background,color,border-color] duration-200 ease-[ease] group-hover/poi:text-gold-ink group-hover/poi:bg-gold group-hover/poi:border-gold-bright group-aria-pressed/poi:text-gold-ink group-aria-pressed/poi:bg-gold group-aria-pressed/poi:border-gold-bright mobile:text-[0.875rem]'
            name.textContent = poi.label
            const note = document.createElement('span')
            note.className =
                'hidden -order-1 mb-2 py-[9px] px-3 text-ink bg-panel-solid border border-solid border-line rounded-[10px] text-[0.8125rem] leading-[1.45] text-left group-aria-pressed/poi:block'
            note.textContent = poi.description
            node.append(name, note)
            node.addEventListener('click', () => on_poi(poi))
            labels.append(node)
            return { poi, node }
        })
        const insets = { left: 0, right: 0, bottom: 0 }
        const inset_target = { left: 0, right: 0, bottom: 0, top: 0 }
        const projected = new THREE.Vector3()
        const place_labels = () => {
            const width = host.clientWidth
            const height = host.clientHeight
            for (const { node, poi } of label_nodes) {
                const anchor = active.anchors.get(poi.id)
                if (!anchor || veil_level > 0.5 || view.distance > (poi.within ?? Infinity)) {
                    node.hidden = true
                    continue
                }
                projected.copy(anchor).project(camera)
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
                node.setAttribute('aria-pressed', String(poi.id === active_id))
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
            if (!dragging || cut) return
            flight = null
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
            if (cut) return
            flight = null
            view.distance = clamp(
                view.distance * (1 + event.deltaY * 0.001),
                ...active.definition.zoom,
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

        const ease_in_out = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
        let previous = performance.now()
        const render = (now) => {
            if (disposed) return
            const delta = Math.min(0.1, (now - previous) / 1000)
            previous = now
            const ease = reduced_motion ? 1 : 1 - Math.exp(-delta * 2.2)

            if (cut && now >= cut.at) {
                const { end } = cut
                cut = null
                activate(end.world)
                view = {
                    ...copy_view(end),
                    distance: end.distance * 2.4,
                    elevation: Math.min(end.elevation + 0.3, 1.2),
                }
                begin_flight(end, 1500)
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
                if (progress === 1) flight = null
            }
            veil_level = mix(veil_level, cut ? 1 : 0, reduced_motion ? 1 : 1 - Math.exp(-delta * 8))
            veil.style.opacity = veil_level < 0.01 ? '0' : veil_level.toFixed(3)
            veil.style.background = `#${mood.horizon.getHexString()}`
            if (cycle === null) blend_mood(ease, mood_target)
            else {
                const phase = (cycle * 3) % 1
                const name = cycle >= 1 ? 'night' : night_phases.find(([until]) => phase < until)[1]
                blend_mood(reduced_motion ? 1 : 1 - Math.exp(-delta * 4), moods[name])
            }
            // The sky turns slowly at all times, and through three nights during the time-lapse.
            stars.rotation.set(0.6, 0, now / 400000 + (cycle ?? 0) * 3.2)

            for (const key of ['left', 'right', 'bottom'])
                insets[key] = mix(insets[key], inset_target[key], reduced_motion ? 1 : ease * 1.6)
            const width = host.clientWidth
            const height = host.clientHeight
            if (width && height) {
                camera.setViewOffset(
                    width,
                    height,
                    -(insets.left - insets.right) / 2,
                    insets.bottom / 2,
                    width,
                    height,
                )
            }

            // Camera, fog and shadows all scale with how close the camera is.
            const distance = view.distance
            const azimuth =
                view.azimuth + (reduced_motion || dragging ? 0 : Math.sin(now / 9000) * 0.035)
            const horizontal = distance * Math.cos(view.elevation)
            camera.position.set(
                view.target.x + horizontal * Math.sin(azimuth),
                view.target.y + distance * Math.sin(view.elevation),
                view.target.z + horizontal * Math.cos(azimuth),
            )
            camera.position.y = Math.max(
                camera.position.y,
                active.terrain.height(camera.position.x, camera.position.z) + distance * 0.02,
            )
            camera.lookAt(view.target)
            camera.near = clamp(distance * 0.02, 0.00005, 0.5)
            camera.fov = view.fov
            camera.updateProjectionMatrix()
            sky.position.copy(camera.position)
            stars.position.copy(camera.position)
            const [fog_near, fog_far] = active.definition.fog
            scene.fog.near = Math.max(fog_near, distance * 0.9)
            scene.fog.far = Math.max(fog_far, distance * 3 + 10)

            const span = clamp(distance * 1.3, 0.03, 24)
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
                    const mapped = distance > 0.3
                    route.line.visible = mapped && route.shown > 0.002
                    route.trace.visible = mapped
                    if (world === active && route.shown > 0.002 && route.shown < 0.998) tip = route
                }
            }
            // The marker shows where the line is still being drawn, not a resting place.
            traveller.visible = Boolean(tip)
            if (tip) {
                traveller.position.copy(tip.points[Math.floor(tip.shown * tip.count)])
                // A following shot keeps the camera on the head of the line.
                if (!flight && !cut && !dragging && view.follow === tip.leg) {
                    follow_point.copy(traveller.position).setY(traveller.position.y + 0.2)
                    view.target.lerp(follow_point, reduced_motion ? 1 : 1 - Math.exp(-delta * 1.6))
                }
                traveller.scale.setScalar(
                    distance * 0.007 * (reduced_motion ? 1 : 1 + 0.18 * Math.sin(now / 320)),
                )
            }
            active.rings.forEach((ring, index) => {
                const pulse = reduced_motion ? 0 : (now / 2600 + index * 0.25) % 1
                ring.scale.setScalar(distance * 0.012 * (1 + pulse * 0.9))
                ring.material.opacity = 0.85 * (1 - pulse)
            })

            ripples.offset.set(now / 90000, now / 140000)
            grade.uniforms.time.value = reduced_motion ? 0 : (now / 1000) % 10
            // Dust hangs in the air close to the camera and catches the light by day.
            dust.position.copy(camera.position)
            dust.scale.setScalar(distance * 0.9)
            dust.rotation.y = reduced_motion ? 0 : now / 60000
            dust_material.opacity = 0.5 * (1 - mood.stars) * smoothstep(8, 0.5, distance)
            dust_material.color.copy(mood.sun)
            composer.render()
            place_labels()
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
        api.set_cycle = (value) => {
            cycle = value
        }
        api.set_active = (id) => {
            active_id = id
        }
        api.set_insets = (next) => Object.assign(inset_target, next)
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
