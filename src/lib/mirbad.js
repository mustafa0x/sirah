import { hash } from './scene-terrain.js'

// Illustration of the yard's use, not recorded drying patches or fruit quantities.
export const drying_patches = [
    [-6, 8, 2.4, 2],
    [-5, 2, 2.8, 2.2],
    [-6, -5, 3, 2.4],
    [4, -7, 2.4, 2.4],
    [6, 1, 2.8, 2.2],
    [6, 8, 2.6, 2],
]

export function build_mirbad(THREE, height) {
    const each = 600
    const fruit = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 5, 3),
        new THREE.MeshStandardMaterial({
            color: 0x794427,
            roughness: 1,
            flatShading: true,
            fog: false,
        }),
        each * drying_patches.length,
    )
    fruit.name = 'mirbad-drying-dates'
    fruit.visible = false
    fruit.userData = {
        illustrative: true,
        fruit_scale: 'enlarged symbols',
        patch_count: drying_patches.length,
    }
    const dummy = new THREE.Object3D()
    let index = 0
    for (const [cx, cz, width, depth] of drying_patches) {
        for (let i = 0; i < each; i += 1, index += 1) {
            const angle = hash(index, 131) * Math.PI * 2
            const reach = Math.sqrt(hash(index, 132))
            const x = (cx + (width / 2) * reach * Math.cos(angle)) * 0.001
            const z = (cz + (depth / 2) * reach * Math.sin(angle)) * 0.001
            dummy.position.set(x, height(x, z) + 0.000009, z)
            dummy.rotation.set(0, hash(index, 133) * Math.PI * 2, 0)
            // Enlarged matte date symbols, laid directly on earth; no invented mats/racks.
            dummy.scale.set(0.00004, 0.00001, 0.00002)
            dummy.updateMatrix()
            fruit.setMatrixAt(index, dummy.matrix)
        }
    }
    fruit.castShadow = true
    fruit.receiveShadow = true
    fruit.computeBoundingSphere()
    return fruit
}
