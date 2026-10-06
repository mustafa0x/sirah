// The camel's arrival in Madinah and the mosque that rose where she knelt, driven by the
// narration clock so pausing or seeking holds the pose. An illustration linked to its
// sources (E17: the yard for drying dates; E12: the mosque of sun-dried brick), not a
// reconstruction of the route through the town or of the building. No riders, no people.
// Site coordinates are local to the town centre: x north, z east, in scene units (km).
export const arrival_site = {
    // From the south, the way from Quba, to the middle of the yard.
    start: [-0.03, 0.003],
    end: [-0.002, 0],
    camel_size: 0.0018,
    width: 0.024,
    depth: 0.03,
    wall_height: 0.0012,
    wall_thickness: 0.0006,
}

const clamp = (value) => Math.max(0, Math.min(1, value))
const smooth = (value) => {
    const t = clamp(value)
    return t * t * (3 - 2 * t)
}

// N08b: the town comes out and the camel walks in and kneels in the yard.
// N05b: the mosque's walls rise around the place. N08c: it stands, seen from above.
export function arrival_state(beat, progress) {
    const p = clamp(Number.isFinite(progress) ? progress : 0)
    if (beat === 'N08b')
        return {
            phase: 'approach',
            travel: smooth(p / 0.75),
            kneel: smooth((p - 0.75) / 0.15),
            build: 0,
        }
    if (beat === 'N05b')
        return {
            phase: 'build',
            travel: 1,
            kneel: 1,
            build: 0.15 + 0.85 * smooth(p / 0.7),
        }
    if (beat === 'N08c') return { phase: 'built', travel: 1, kneel: 1, build: 1 }
    return null
}

export function camel_pose(state) {
    const { start, end } = arrival_site
    return {
        x: start[0] + (end[0] - start[0]) * state.travel,
        z: start[1] + (end[1] - start[1]) * state.travel,
        heading: Math.atan2(-(end[1] - start[1]), end[0] - start[0]),
        stride: state.travel === 1 ? 0 : Math.sin(state.travel * Math.PI * 30) * 0.35,
        leg_scale: 1 - state.kneel * 0.75,
    }
}

// A roofless course of sun-dried brick around the yard; dimensions are illustrative.
export function build_mosque_outline(THREE, height) {
    const root = new THREE.Group()
    root.name = 'masjid-nabawi-outline'
    root.visible = false
    root.userData = { illustrative: true, source_ids: ['E12'], roofless: true }
    const { width, depth, wall_height, wall_thickness } = arrival_site
    const material = new THREE.MeshStandardMaterial({
        color: 0xb8a181,
        roughness: 1,
        flatShading: true,
        fog: false,
    })
    const segments = [
        { length: width, x: 0, z: -depth / 2, along_x: true },
        { length: width, x: 0, z: depth / 2, along_x: true },
        { length: depth, x: -width / 2, z: 0, along_x: false },
        { length: depth, x: width / 2, z: 0, along_x: false },
    ]
    for (const side of segments) {
        const count = Math.ceil(side.length / 0.003)
        const length = side.length / count
        for (let i = 0; i < count; i += 1) {
            const along = -side.length / 2 + length * (i + 0.5)
            const x = side.x + (side.along_x ? along : 0)
            const z = side.z + (side.along_x ? 0 : along)
            const sx = side.along_x ? length : wall_thickness
            const sz = side.along_x ? wall_thickness : length
            const corners = [-sx / 2, sx / 2].flatMap((dx) =>
                [-sz / 2, sz / 2].map((dz) => height(x + dx, z + dz)),
            )
            const base = Math.min(...corners)
            const top = Math.max(...corners) + wall_height
            const geometry = new THREE.BoxGeometry(sx, top - base, sz)
            geometry.translate(0, (top - base) / 2, 0)
            const wall = new THREE.Mesh(geometry, material)
            wall.name = 'outline-wall-course'
            wall.position.set(x, base, z)
            wall.castShadow = true
            wall.receiveShadow = true
            root.add(wall)
        }
    }
    return root
}
