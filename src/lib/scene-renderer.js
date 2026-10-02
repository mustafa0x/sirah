import { scene_assets, scene_pois } from './scene-manifest.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export async function create_scene(
    host,
    scene_kind,
    report,
    on_poi = () => {},
    register_focus = () => {},
) {
    let disposed = false
    let frame = 0
    let focus_frame = 0
    let resize_observer
    let cleanup_controls = () => {}
    let renderer
    let scene

    try {
        const THREE = await import('three')
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
        if (disposed) return () => {}

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.setClearColor(0x171814)
        host.replaceChildren(renderer.domElement)
        scene = new THREE.Scene()

        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
        const camera_state = {
            azimuth: scene_kind === 'thawr' ? 0 : 0.72,
            elevation: 0.58,
            distance: scene_kind === 'thawr' ? 7.2 : 8.1,
            target: new THREE.Vector3(0, 0.35, 0),
        }
        const focus_target = (position) =>
            new THREE.Vector3(position[0], Math.max(0.2, position[1]), position[2])
        const set_camera = () => {
            const horizontal = camera_state.distance * Math.cos(camera_state.elevation)
            camera.position.set(
                camera_state.target.x + horizontal * Math.sin(camera_state.azimuth),
                camera_state.target.y + camera_state.distance * Math.sin(camera_state.elevation),
                camera_state.target.z + horizontal * Math.cos(camera_state.azimuth),
            )
            camera.lookAt(camera_state.target)
        }
        set_camera()

        scene.add(new THREE.HemisphereLight(0xf4dfbd, 0x1d2426, 2.1))
        const key = new THREE.DirectionalLight(0xffc27d, 2.2)
        key.position.set(-4, 7, 5)
        scene.add(key)

        const ground = new THREE.Mesh(
            new THREE.CylinderGeometry(scene_kind === 'thawr' ? 3.7 : 4.4, 4.8, 0.45, 7),
            new THREE.MeshStandardMaterial({ color: 0x55483b, roughness: 1 }),
        )
        ground.position.y = -0.45
        scene.add(ground)
        const rock_material = new THREE.MeshStandardMaterial({ color: 0x82725c, roughness: 0.94 })
        const dark_material = new THREE.MeshStandardMaterial({ color: 0x252522, roughness: 1 })
        const rock = (x, y, z, scale, material = rock_material) => {
            const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), material)
            mesh.position.set(x, y, z)
            mesh.scale.set(...scale)
            mesh.rotation.set(0.1 * z, 0.2 * x, 0.08 * y)
            scene.add(mesh)
        }

        if (scene_kind === 'thawr') {
            rock(-2.25, 0.3, -0.2, [1.6, 1.8, 1.2])
            rock(2.1, 0.15, -0.4, [1.5, 1.45, 1.2])
            rock(0, 0.55, -0.7, [2.1, 1.9, 0.9], dark_material)
            rock(-0.3, 1.05, -0.8, [1.25, 0.8, 0.6], dark_material)
        } else {
            rock(-2.5, 0.2, -0.5, [1.4, 1, 1.2])
            rock(2.3, 0.1, -0.3, [1.3, 0.9, 1.1])
            const route = new THREE.Mesh(
                new THREE.TorusGeometry(2.15, 0.035, 8, 64, Math.PI * 0.85),
                new THREE.MeshBasicMaterial({ color: 0xd89a56 }),
            )
            route.rotation.x = Math.PI / 2
            route.position.y = 0.02
            scene.add(route)
        }

        const poi_targets = []
        const poi_material = new THREE.MeshBasicMaterial({ color: 0xe6a55b })
        const add_poi = (poi) => {
            const marker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), poi_material)
            marker.position.set(...poi.position)
            marker.userData.poi = poi
            scene.add(marker)
            poi_targets.push(marker)
        }
        ;(scene_pois[scene_kind] ?? []).forEach(add_poi)

        const loader = new GLTFLoader()
        const asset_layout =
            scene_kind === 'thawr'
                ? [
                      [0, -0.4, -0.75, 0.58, 0],
                      [-2.7, -0.35, -0.4, 1.45, 0.1],
                      [2.4, -0.35, -0.5, 1.3, -0.15],
                  ]
                : [
                      [-3.2, -0.35, 1.1, 1.2, 0.2],
                      [2.9, -0.35, 1, 1.15, -0.3],
                      [0.4, -0.35, 1.8, 0.85, 0.1],
                  ]
        await Promise.all(
            (scene_assets[scene_kind] ?? []).slice(0, asset_layout.length).map(
                (asset_url, index) =>
                    new Promise((resolve) => {
                        loader.load(
                            asset_url,
                            (gltf) => {
                                if (!disposed) {
                                    const object = gltf.scene
                                    const [x, y, z, scale, rotation] = asset_layout[index]
                                    object.position.set(x, y, z)
                                    object.scale.setScalar(scale)
                                    object.rotation.y = rotation
                                    if (scene_kind === 'thawr' && index === 0)
                                        object.rotation.x = -Math.PI / 2
                                    object.traverse((child) => {
                                        if (child.isMesh) {
                                            child.castShadow = false
                                            child.receiveShadow = false
                                        }
                                    })
                                    scene.add(object)
                                }
                                resolve()
                            },
                            undefined,
                            () => resolve(),
                        )
                    }),
            ),
        )
        if (disposed) return () => {}
        report('ready')

        const resize = () => {
            if (disposed || !host.clientWidth || !host.clientHeight) return
            renderer.setSize(host.clientWidth, host.clientHeight, true)
            camera.aspect = host.clientWidth / host.clientHeight
            camera.updateProjectionMatrix()
        }
        resize_observer = new ResizeObserver(resize)
        resize_observer.observe(host)
        resize()

        const focus_poi = (poi) => {
            const camera_view = poi.camera
            const start = {
                azimuth: camera_state.azimuth,
                elevation: camera_state.elevation,
                distance: camera_state.distance,
                target: camera_state.target.clone(),
            }
            const end_target = focus_target(poi.position)
            const started = performance.now()
            window.cancelAnimationFrame(focus_frame)
            const animate_focus = (now) => {
                if (disposed) return
                const progress = clamp((now - started) / 460, 0, 1)
                const eased = 1 - (1 - progress) ** 3
                camera_state.azimuth = start.azimuth + (camera_view.azimuth - start.azimuth) * eased
                camera_state.elevation =
                    start.elevation + (camera_view.elevation - start.elevation) * eased
                camera_state.distance =
                    start.distance + (camera_view.distance - start.distance) * eased
                camera_state.target.lerpVectors(start.target, end_target, eased)
                set_camera()
                if (progress < 1) focus_frame = window.requestAnimationFrame(animate_focus)
            }
            focus_frame = window.requestAnimationFrame(animate_focus)
        }

        register_focus(focus_poi)

        const pointer = new THREE.Vector2()
        const raycaster = new THREE.Raycaster()
        let dragging = false
        let moved = false
        let last_x = 0
        let down_x = 0
        const pointer_down = (event) => {
            dragging = true
            moved = false
            last_x = event.clientX
            down_x = event.clientX
            host.setPointerCapture?.(event.pointerId)
        }
        const pointer_move = (event) => {
            if (!dragging) return
            const delta = event.clientX - last_x
            if (Math.abs(event.clientX - down_x) > 4) moved = true
            last_x = event.clientX
            if (!delta) return
            window.cancelAnimationFrame(focus_frame)
            camera_state.azimuth = clamp(camera_state.azimuth - delta * 0.006, -1.5, 1.5)
            set_camera()
        }
        const pointer_up = (event) => {
            if (!dragging) return
            dragging = false
            if (moved || !host.clientWidth || !host.clientHeight) return
            const bounds = host.getBoundingClientRect()
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
            raycaster.setFromCamera(pointer, camera)
            const hit = raycaster.intersectObjects(poi_targets, false)[0]
            if (hit?.object.userData.poi) {
                focus_poi(hit.object.userData.poi)
                on_poi(hit.object.userData.poi)
            }
        }
        host.addEventListener('pointerdown', pointer_down)
        host.addEventListener('pointermove', pointer_move)
        host.addEventListener('pointerup', pointer_up)
        host.addEventListener('pointercancel', pointer_up)
        cleanup_controls = () => {
            host.removeEventListener('pointerdown', pointer_down)
            host.removeEventListener('pointermove', pointer_move)
            host.removeEventListener('pointerup', pointer_up)
            host.removeEventListener('pointercancel', pointer_up)
            window.cancelAnimationFrame(focus_frame)
        }

        const render = () => {
            if (disposed) return
            renderer.render(scene, camera)
            frame = window.requestAnimationFrame(render)
        }
        render()
    } catch (error) {
        if (!disposed) report('failed', error)
    }

    return () => {
        if (disposed) return
        disposed = true
        if (frame) window.cancelAnimationFrame(frame)
        if (focus_frame) window.cancelAnimationFrame(focus_frame)
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
}
