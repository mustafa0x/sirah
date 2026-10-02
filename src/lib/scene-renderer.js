// Route-local illustrative scene. Three.js is loaded only when scene mode is used.
// The geometry is a draft visual aid, not a reconstruction and contains no people.
export async function create_scene(host, scene_kind, report) {
    let disposed = false
    let frame = 0
    let resize_observer
    let cleanup_controls = () => {}
    let renderer
    let scene

    try {
        const THREE = await import('three')
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
        camera.position.set(scene_kind === 'thawr' ? 6 : 7, 4.5, 7)
        camera.lookAt(0, 0.5, 0)
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
            for (const [x, z] of [
                [-2.1, 0.3],
                [0, -1.9],
                [2.15, 0.25],
            ]) {
                const marker = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 16, 8),
                    new THREE.MeshBasicMaterial({ color: 0xe6a55b }),
                )
                marker.position.set(x, 0.18, z)
                scene.add(marker)
            }
        }
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
        const render = () => {
            if (disposed) return
            renderer.render(scene, camera)
            frame = window.requestAnimationFrame(render)
        }
        render()

        // A modest pointer orbit keeps the scene explorable while leaving all text controls in HTML.
        let dragging = false
        let last_x = 0
        const pointer_down = (event) => {
            dragging = true
            last_x = event.clientX
            host.setPointerCapture?.(event.pointerId)
        }
        const pointer_move = (event) => {
            if (!dragging) return
            const delta = event.clientX - last_x
            last_x = event.clientX
            camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -delta * 0.006)
            camera.lookAt(0, 0.4, 0)
        }
        const pointer_up = () => {
            dragging = false
        }
        host.addEventListener('pointerdown', pointer_down)
        host.addEventListener('pointermove', pointer_move)
        host.addEventListener('pointerup', pointer_up)
        cleanup_controls = () => {
            host.removeEventListener('pointerdown', pointer_down)
            host.removeEventListener('pointermove', pointer_move)
            host.removeEventListener('pointerup', pointer_up)
        }
    } catch (error) {
        if (!disposed) report('failed', error)
    }

    return () => {
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
        host.replaceChildren()
    }
}
