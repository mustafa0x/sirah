// Authored schematic sets; placement, scale and planting are not historical reconstructions.
export const kaaba_landmark = {
    place: 'makkah',
    width: 0.036,
    height: 0.04,
    depth: 0.036,
    clearing: 0.14,
}

export function build_kaaba(THREE, height) {
    const { width, depth } = kaaba_landmark
    const samples = [
        height(0, 0),
        ...[-width / 2, width / 2].flatMap((x) => [-depth / 2, depth / 2].map((z) => height(x, z))),
    ]
    const base = Math.min(...samples)
    const top = Math.max(...samples) + kaaba_landmark.height
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, top - base, depth),
        new THREE.MeshStandardMaterial({
            color: 0x28231f,
            roughness: 1,
            flatShading: true,
            fog: false,
        }),
    )
    mesh.name = 'kaaba-schematic'
    mesh.userData = { illustrative: true }
    mesh.position.y = (top + base) / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}
