import { overview_shot, places, route_legs, scene_pois, stone_assets } from './scene-manifest.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const mix = (a, b, t) => a + (b - a) * t
const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

// Deterministic value noise: the relief must look the same on every load.
const hash = (x, z) => {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
    return s - Math.floor(s)
}
const value_noise = (x, z) => {
    const xi = Math.floor(x)
    const zi = Math.floor(z)
    const xf = x - xi
    const zf = z - zi
    const u = xf * xf * (3 - 2 * xf)
    const v = zf * zf * (3 - 2 * zf)
    return mix(
        mix(hash(xi, zi), hash(xi + 1, zi), u),
        mix(hash(xi, zi + 1), hash(xi + 1, zi + 1), u),
        v,
    )
}
const fbm = (x, z) =>
    0.5 * value_noise(x, z) + 0.25 * value_noise(x * 2, z * 2) + 0.125 * value_noise(x * 4, z * 4)
const bump = (x, z, cx, cz, radius, height) =>
    height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / radius ** 2)

const coast_z = (x) => -5.7 + 0.7 * Math.sin(x * 0.4 + 1) + 0.5 * Math.sin(x * 0.13)
const peaks = [
    [-8.3, 2.6, 1.25, 2.35],
    [-5.7, 3.7, 1.1, 1.15],
    [-3.4, 0.8, 1, 1.05],
    [-6.1, -1, 1, 0.95],
    [-3.7, 3.1, 0.9, 0.75],
    [10, -0.4, 1.5, 1.15],
    [6.2, 3.8, 1.1, 0.6],
    [-11.5, 5, 1.6, 1.3],
    [-12.5, -0.5, 1.5, 1],
]

export function terrain_height(x, z) {
    const coast = coast_z(x)
    if (z < coast) return 0.05 - 0.45 * smoothstep(0, 1.6, coast - z)
    const shore = smoothstep(0, 2.4, z - coast)
    let height = 0.05 + shore * (0.16 + 0.75 * fbm(x * 0.32, z * 0.32))
    // The inland range the coastal way goes around.
    const range =
        Math.exp(-(((z + 1.7) / 1.5) ** 2)) *
        smoothstep(-4, -1.5, x) *
        (1 - smoothstep(3.5, 5.5, x))
    height += range * 2.1 * fbm(x * 0.55 + 10, z * 0.55) ** 1.4
    // Open ground around the two towns.
    const settle = Math.max(
        Math.exp(-((x - places.makkah[0]) ** 2 + (z - places.makkah[1]) ** 2) / 1.3 ** 2),
        Math.exp(-((x - places.madinah[0]) ** 2 + (z - places.madinah[1]) ** 2) / 2 ** 2),
    )
    height = mix(height, 0.14, settle * 0.9)
    const rough = 0.72 + 0.6 * fbm(x * 1.4 + 3, z * 1.4)
    for (const [cx, cz, radius, peak] of peaks) height += bump(x, z, cx, cz, radius, peak) * rough
    return height
}

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
    const api = {
        set_shot() {},
        set_mood() {},
        set_route() {},
        set_active() {},
        set_insets() {},
        dispose() {
            disposed = true
        },
    }

    try {
        const THREE = await import('three')
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
        if (disposed) return api
        const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFShadowMap
        renderer.domElement.style.display = 'block'
        host.replaceChildren(renderer.domElement, labels)
        scene = new THREE.Scene()
        scene.fog = new THREE.Fog(0xf6dcb2, 24, 80)

        const ground_at = (x, z, lift = 0) => new THREE.Vector3(x, terrain_height(x, z) + lift, z)
        const place_at = (name, lift = 0) => ground_at(places[name][0], places[name][1], lift)

        // Sky, stars, light.
        const sky_uniforms = {
            top: { value: new THREE.Color() },
            horizon: { value: new THREE.Color() },
        }
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(80, 24, 16),
            new THREE.ShaderMaterial({
                side: THREE.BackSide,
                depthWrite: false,
                fog: false,
                uniforms: sky_uniforms,
                vertexShader:
                    'varying float h; void main() { h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
                fragmentShader:
                    'uniform vec3 top; uniform vec3 horizon; varying float h; void main() { float t = pow(smoothstep(-0.05, 0.75, h), 0.6); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
            }),
        )
        scene.add(sky)

        const star_positions = []
        for (let index = 0; index < 900; index += 1) {
            const azimuth = hash(index, 1) * Math.PI * 2
            const height = 0.06 + hash(index, 2) * 0.94
            const radius = Math.sqrt(1 - height * height)
            star_positions.push(
                70 * radius * Math.cos(azimuth),
                70 * height,
                70 * radius * Math.sin(azimuth),
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
        scene.add(new THREE.Points(star_geometry, star_material))

        const hemisphere = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
        scene.add(hemisphere)
        const sun = new THREE.DirectionalLight(0xffffff, 2)
        sun.castShadow = true
        sun.shadow.mapSize.set(2048, 2048)
        sun.shadow.camera.left = -16
        sun.shadow.camera.right = 16
        sun.shadow.camera.top = 12
        sun.shadow.camera.bottom = -12
        sun.shadow.camera.near = 1
        sun.shadow.camera.far = 60
        sun.shadow.bias = -0.0006
        sun.shadow.normalBias = 0.04
        scene.add(sun, sun.target)

        const sea_material = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0 })
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
        const scratch_color = new THREE.Color()
        const scratch_vector = new THREE.Vector3()
        const blend_mood = (amount) => {
            for (const key of ['top', 'horizon', 'sun', 'sky_light', 'ground_light', 'sea'])
                mood[key].lerp(scratch_color.setHex(mood_target[key]), amount)
            mood.sun_at.lerp(scratch_vector.set(...mood_target.sun_at), amount)
            for (const key of ['sun_power', 'ambient', 'stars', 'exposure'])
                mood[key] = mix(mood[key], mood_target[key], amount)
            sky_uniforms.top.value.copy(mood.top)
            sky_uniforms.horizon.value.copy(mood.horizon)
            scene.fog.color.copy(mood.horizon)
            sun.color.copy(mood.sun)
            sun.intensity = mood.sun_power
            sun.position.copy(mood.sun_at).multiplyScalar(4)
            hemisphere.color.copy(mood.sky_light)
            hemisphere.groundColor.copy(mood.ground_light)
            hemisphere.intensity = mood.ambient
            star_material.opacity = mood.stars
            sea_material.color.copy(mood.sea)
            renderer.toneMappingExposure = mood.exposure
        }
        blend_mood(1)

        // Relief.
        const terrain_geometry = new THREE.PlaneGeometry(76, 52, 228, 156)
        terrain_geometry.rotateX(-Math.PI / 2)
        terrain_geometry.translate(0, 0, 7)
        const position = terrain_geometry.attributes.position
        const colors = new Float32Array(position.count * 3)
        const sand = new THREE.Color(0xcda873)
        const shore = new THREE.Color(0xe2cb9c)
        const rock = new THREE.Color(0x8d6b4b)
        const high_rock = new THREE.Color(0x5e4737)
        const grove = new THREE.Color(0x77834a)
        const tint = new THREE.Color()
        for (let index = 0; index < position.count; index += 1) {
            const x = position.getX(index) + (hash(index, 7) - 0.5) * 0.22
            const z = position.getZ(index) + (hash(index, 8) - 0.5) * 0.22
            const height = terrain_height(x, z)
            position.setXYZ(index, x, height, z)
            tint.copy(sand).lerp(shore, 1 - smoothstep(0, 1.6, z - coast_z(x)))
            tint.lerp(rock, smoothstep(0.35, 1.05, height))
            tint.lerp(high_rock, smoothstep(1.2, 2.3, height))
            tint.lerp(
                grove,
                0.45 *
                    Math.exp(
                        -((x - places.madinah[0]) ** 2 + (z - places.madinah[1]) ** 2) / 1.5 ** 2,
                    ),
            )
            tint.multiplyScalar(0.94 + 0.12 * fbm(x * 0.9, z * 0.9))
            colors.set([tint.r, tint.g, tint.b], index * 3)
        }
        terrain_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        terrain_geometry.computeVertexNormals()
        const terrain = new THREE.Mesh(
            terrain_geometry,
            new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
        )
        terrain.castShadow = true
        terrain.receiveShadow = true
        scene.add(terrain)

        const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), sea_material)
        sea.rotation.x = -Math.PI / 2
        sea.receiveShadow = true
        scene.add(sea)

        // Schematic settlements: plain blocks and palms, no claimed architecture.
        const add = (geometry, material, x, y, z) => {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            mesh.castShadow = true
            mesh.receiveShadow = true
            scene.add(mesh)
            return mesh
        }
        const wall_materials = [0xd8b98c, 0xc9a877, 0xe3c9a0].map(
            (color) =>
                new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }),
        )
        const block_geometry = new THREE.BoxGeometry(1, 1, 1)
        const add_blocks = (cx, cz, count, spread, seed) => {
            for (let index = 0; index < count; index += 1) {
                const angle = hash(index, seed) * Math.PI * 2
                const reach = spread * Math.sqrt(hash(index, seed + 1))
                const x = cx + reach * Math.cos(angle)
                const z = cz + reach * Math.sin(angle)
                const width = 0.2 + 0.18 * hash(index, seed + 2)
                const depth = 0.2 + 0.18 * hash(index, seed + 3)
                const tall = 0.14 + 0.16 * hash(index, seed + 4)
                const block = add(
                    block_geometry,
                    wall_materials[index % wall_materials.length],
                    x,
                    terrain_height(x, z) + tall / 2 - 0.01,
                    z,
                )
                block.scale.set(width, tall, depth)
                block.rotation.y = hash(index, seed + 5) * 0.6
            }
        }
        add_blocks(places.makkah[0], places.makkah[1], 30, 0.95, 11)
        add_blocks(places.madinah[0] - 0.2, places.madinah[1] + 0.1, 12, 0.7, 41)

        const trunk_geometry = new THREE.CylinderGeometry(0.018, 0.032, 1, 5)
        const frond_geometry = new THREE.ConeGeometry(0.035, 0.3, 4)
        frond_geometry.translate(0, 0.15, 0)
        const trunk_material = new THREE.MeshStandardMaterial({ color: 0x6f4d30, roughness: 1 })
        const frond_material = new THREE.MeshStandardMaterial({
            color: 0x5f8040,
            roughness: 0.9,
            flatShading: true,
        })
        for (let index = 0; index < 34; index += 1) {
            const angle = hash(index, 71) * Math.PI * 2
            const reach = 0.35 + 1.25 * Math.sqrt(hash(index, 72))
            const x = places.madinah[0] + reach * Math.cos(angle)
            const z = places.madinah[1] + reach * Math.sin(angle) * 0.85
            const tall = 0.32 + 0.22 * hash(index, 73)
            const base = terrain_height(x, z)
            add(trunk_geometry, trunk_material, x, base + tall / 2, z).scale.y = tall
            for (let leaf = 0; leaf < 7; leaf += 1) {
                const frond = add(frond_geometry, frond_material, x, base + tall, z)
                frond.rotation.set(
                    1.15 + 0.5 * hash(index, leaf),
                    (leaf / 7) * Math.PI * 2,
                    0,
                    'YXZ',
                )
            }
        }

        // The cave: a dark recess framed by boulders on the near face of Thawr.
        const cave = place_at('cave')
        const stone_material = new THREE.MeshStandardMaterial({
            color: 0x8f7052,
            roughness: 1,
            flatShading: true,
        })
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
        const boulder = (x, y, z, scale, turn = 0) => {
            const mesh = add(boulder_geometry, stone_material, cave.x + x, cave.y + y, cave.z + z)
            mesh.scale.set(...scale)
            mesh.rotation.set(turn * 0.7, turn, turn * 0.3)
        }
        boulder(-0.42, 0.08, 0.1, [0.3, 0.42, 0.34], 0.6)
        boulder(0.44, 0.04, 0.08, [0.32, 0.38, 0.36], 2.1)
        boulder(0.02, 0.5, -0.06, [0.62, 0.24, 0.4], 1.2)
        boulder(-0.75, -0.1, 0.3, [0.24, 0.2, 0.24], 3.3)
        boulder(0.8, -0.16, 0.34, [0.2, 0.17, 0.22], 4.4)
        const recess = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0x070504, fog: false }),
        )
        recess.position.set(cave.x, cave.y + 0.1, cave.z - 0.02)
        recess.scale.set(0.34, 0.3, 0.3)
        scene.add(recess)

        // The route: a faint full trace, and a bright line that grows as the chapter moves.
        const route_material = new THREE.MeshBasicMaterial({ color: 0xffc56a, fog: false })
        const trace_material = new THREE.LineDashedMaterial({
            color: 0xfff1d6,
            dashSize: 0.16,
            gapSize: 0.16,
            transparent: true,
            opacity: 0.5,
        })
        const radial = 6
        const legs = route_legs.map((points) => {
            const plan = new THREE.CatmullRomCurve3(
                points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
                false,
                'centripetal',
            )
            const segments = Math.round(plan.getLength() * 10)
            const draped = plan
                .getSpacedPoints(segments)
                .map((point) => ground_at(point.x, point.z, 0.07))
            const curve = new THREE.CatmullRomCurve3(draped)
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(curve, segments, 0.028, radial, false),
                route_material,
            )
            tube.geometry.setDrawRange(0, 0)
            const trace = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(draped),
                trace_material,
            )
            trace.computeLineDistances()
            scene.add(tube, trace)
            return { curve, tube, segments, shown: 0, target: 0 }
        })
        const traveller = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }),
        )
        traveller.visible = false
        scene.add(traveller)

        const ring_geometry = new THREE.TorusGeometry(0.22, 0.02, 6, 32)
        ring_geometry.rotateX(Math.PI / 2)
        const rings = scene_pois
            .filter((poi) => poi.ring !== false)
            .map((poi) => {
                const ring = new THREE.Mesh(
                    ring_geometry,
                    new THREE.MeshBasicMaterial({ color: 0xffd68a, transparent: true, fog: false }),
                )
                ring.position.copy(place_at(poi.place, 0.1))
                scene.add(ring)
                return ring
            })

        // Loose rock, from the promoted CC0 stone kit.
        const scatter = [
            [-7.4, 3.9, 0.5],
            [-9.2, 3.6, 0.6],
            [-8.9, 4.3, 0.42],
            [-7.7, 4.6, 0.36],
            [-6.3, 3.2, 0.5],
            [-4.1, 2.2, 0.42],
            [-6.6, 0.1, 0.48],
            [-9.8, 1.2, 0.55],
            [-2.2, -1.2, 0.6],
            [0.8, -1.9, 0.7],
            [3.6, -1.5, 0.6],
            [5.6, 2.9, 0.42],
            [9.2, 1.1, 0.5],
            [1.5, 2.6, 0.5],
            [-1.2, 3.8, 0.55],
        ]
        const loader = new GLTFLoader()
        stone_assets.forEach((asset_url, asset_index) => {
            loader.load(
                asset_url,
                (gltf) => {
                    if (disposed) return
                    gltf.scene.traverse((child) => {
                        if (!child.isMesh) return
                        child.material = stone_material
                        child.castShadow = true
                        child.receiveShadow = true
                    })
                    scatter.forEach(([x, z, scale], index) => {
                        if (index % stone_assets.length !== asset_index) return
                        const stone = gltf.scene.clone()
                        stone.position.copy(ground_at(x, z, -0.03))
                        stone.scale.setScalar(scale)
                        stone.rotation.y = hash(index, 5) * Math.PI * 2
                        scene.add(stone)
                    })
                },
                undefined,
                () => {},
            )
        })

        // Camera.
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200)
        const resolve_shot = (wide) => {
            // A shot may carry its own framing for tall, narrow viewports.
            const shot = camera.aspect < 0.8 && wide.portrait ? wide.portrait : wide
            return {
                azimuth: shot.azimuth,
                elevation: shot.elevation,
                distance: shot.distance * (shot === wide.portrait ? 1 : fit),
                target: shot.target
                    ? new THREE.Vector3(...shot.target)
                    : place_at(shot.place, shot.height ?? 0.3),
            }
        }
        let flight = null
        let fit = 1
        const insets = { left: 0, right: 0, bottom: 0 }
        const inset_target = { left: 0, right: 0, bottom: 0, top: 0 }
        const set_camera = (sway) => {
            const distance = view.distance
            scene.fog.near = Math.max(14, distance * 0.9)
            scene.fog.far = Math.max(70, distance * 3 + 10)
            const azimuth = view.azimuth + sway
            const horizontal = distance * Math.cos(view.elevation)
            camera.position.set(
                view.target.x + horizontal * Math.sin(azimuth),
                view.target.y + distance * Math.sin(view.elevation),
                view.target.z + horizontal * Math.cos(azimuth),
            )
            camera.position.y = Math.max(
                camera.position.y,
                terrain_height(camera.position.x, camera.position.z) + 0.35,
            )
            camera.lookAt(view.target)
        }
        const fly_to = (shot, duration = 2200) => {
            const end = resolve_shot(shot)
            if (reduced_motion || duration === 0) {
                Object.assign(view, end)
                flight = null
                return
            }
            flight = {
                start: { ...view, target: view.target.clone() },
                end,
                started: performance.now(),
                duration,
            }
        }

        const resize = () => {
            if (disposed || !host.clientWidth || !host.clientHeight) return
            renderer.setSize(host.clientWidth, host.clientHeight, true)
            camera.aspect = host.clientWidth / host.clientHeight
            // Narrow, tall viewports need more distance to keep the same ground in frame.
            fit = clamp(1.25 / camera.aspect, 1, 1.9)
        }
        resize_observer = new ResizeObserver(resize)
        resize_observer.observe(host)
        resize()
        const view = resolve_shot(overview_shot)

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
            return { poi, node, anchor: place_at(poi.place, poi.lift) }
        })
        const projected = new THREE.Vector3()
        const place_labels = () => {
            const width = host.clientWidth
            const height = host.clientHeight
            for (const { node, anchor, poi } of label_nodes) {
                projected.copy(anchor).project(camera)
                const x = ((projected.x + 1) / 2) * width
                // Labels that would sit under the chapter rail or the side sheet are dropped.
                const visible =
                    projected.z < 1 &&
                    projected.y < 1.1 &&
                    x > inset_target.left + 30 &&
                    x < width - inset_target.right - 30 &&
                    ((1 - projected.y) / 2) * height > inset_target.top
                node.hidden = !visible
                if (!visible) continue
                node.style.transform = `translate(${x}px, ${((1 - projected.y) / 2) * height}px)`
                node.setAttribute('aria-pressed', String(poi.id === active_id))
            }
        }

        // Drag to look around.
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
            view.azimuth = clamp(view.azimuth - (event.clientX - last_x) * 0.005, -1.7, 1.7)
            view.elevation = clamp(view.elevation + (event.clientY - last_y) * 0.004, 0.08, 1.25)
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
            view.distance = clamp(view.distance * (1 + event.deltaY * 0.001), 4, 60)
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

        let previous = performance.now()
        const render = (now) => {
            if (disposed) return
            const delta = Math.min(0.1, (now - previous) / 1000)
            previous = now
            const ease = reduced_motion ? 1 : 1 - Math.exp(-delta * 2.2)

            if (flight) {
                const progress = clamp((now - flight.started) / flight.duration, 0, 1)
                const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
                view.azimuth = mix(flight.start.azimuth, flight.end.azimuth, eased)
                view.elevation = mix(flight.start.elevation, flight.end.elevation, eased)
                view.distance = mix(flight.start.distance, flight.end.distance, eased)
                view.target.lerpVectors(flight.start.target, flight.end.target, eased)
                if (progress === 1) flight = null
            }
            blend_mood(ease)
            sun.target.position.set(0, 0, 0)

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
            set_camera(reduced_motion || dragging ? 0 : Math.sin(now / 9000) * 0.035)

            let tip = null
            for (const leg of legs) {
                leg.shown = mix(
                    leg.shown,
                    leg.target,
                    reduced_motion ? 1 : 1 - Math.exp(-delta * 1.1),
                )
                if (Math.abs(leg.shown - leg.target) < 0.002) leg.shown = leg.target
                leg.tube.geometry.setDrawRange(0, Math.floor(leg.shown * leg.segments) * radial * 6)
                if (leg.shown > 0.002 && leg.shown < 0.998) tip = leg
            }
            // The marker shows where the line is still being drawn, not a resting place.
            traveller.visible = Boolean(tip)
            if (tip) {
                tip.curve.getPointAt(
                    Math.floor(tip.shown * tip.segments) / tip.segments,
                    traveller.position,
                )
                traveller.scale.setScalar(reduced_motion ? 1 : 1 + 0.18 * Math.sin(now / 320))
            }
            rings.forEach((ring, index) => {
                const pulse = reduced_motion ? 0 : (now / 2600 + index * 0.25) % 1
                ring.scale.setScalar(1 + pulse * 0.9)
                ring.material.opacity = 0.85 * (1 - pulse)
            })

            renderer.render(scene, camera)
            place_labels()
            frame = window.requestAnimationFrame(render)
        }
        frame = window.requestAnimationFrame(render)

        api.set_shot = fly_to
        api.set_mood = (name) => {
            mood_target = moods[name] ?? moods.gold
        }
        api.set_route = (progress) => legs.forEach((leg, index) => (leg.target = progress[index]))
        api.set_active = (id) => {
            active_id = id
        }
        api.set_insets = (next) => Object.assign(inset_target, next)
        report('ready')
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
