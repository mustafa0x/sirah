const KM_PER_DEGREE = 111.32

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

// Deterministic noise: scattered detail must look the same on every load.
export const hash = (x, z) => {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
    return s - Math.floor(s)
}
const value_noise = (x, z) => {
    const xi = Math.floor(x)
    const zi = Math.floor(z)
    const u = (x - xi) ** 2 * (3 - 2 * (x - xi))
    const v = (z - zi) ** 2 * (3 - 2 * (z - zi))
    const top = hash(xi, zi) + (hash(xi + 1, zi) - hash(xi, zi)) * u
    const bottom = hash(xi, zi + 1) + (hash(xi + 1, zi + 1) - hash(xi, zi + 1)) * u
    return top + (bottom - top) * v
}
export const fbm = (x, z) =>
    0.5 * value_noise(x, z) + 0.25 * value_noise(x * 2, z * 2) + 0.125 * value_noise(x * 4, z * 4)

// Raised hillside behind the shelter (-north), with a clear approach on +north.
export const shelter_bank = (north, east) =>
    Math.max(
        smoothstep(0, 4.5, -north),
        0.65 * smoothstep(2.3, 4.6, Math.abs(east)) * (1 - smoothstep(-1, 5, north)),
    ) *
    (1 - smoothstep(16, 38, Math.hypot(north, east)))

export async function load_grid(definition) {
    const response = await fetch(definition.grid)
    if (!response.ok) throw new Error(`Elevation grid unavailable: ${response.status}`)
    return new Int16Array(await response.arrayBuffer())
}

// Every grid uses the regional projection. Local grids refine the same height field.
export function build_terrain(THREE, definition, grid, details = []) {
    const { rows, cols, south, north, west, east, km_per_unit } = definition
    const lat0 = (south + north) / 2
    const lon0 = (west + east) / 2
    const km_per_lon = KM_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180)
    const size_x = ((north - south) * KM_PER_DEGREE) / km_per_unit
    const size_z = ((east - west) * km_per_lon) / km_per_unit
    const to_xz = (lat, lon) => [
        ((lat - lat0) * KM_PER_DEGREE) / km_per_unit,
        ((lon - lon0) * km_per_lon) / km_per_unit,
    ]
    const sample_grid = (source, values, stride = 1) => {
        const [min_x, min_z] = to_xz(source.south, source.west)
        const [max_x, max_z] = to_xz(source.north, source.east)
        return {
            min_x,
            min_z,
            max_x,
            max_z,
            sample(x, z) {
                const row = clamp(
                    ((x - min_x) / (max_x - min_x)) * (source.rows - 1),
                    0,
                    source.rows - 1.001,
                )
                const col = clamp(
                    ((z - min_z) / (max_z - min_z)) * (source.cols - 1),
                    0,
                    source.cols - 1.001,
                )
                const r = Math.floor(row / stride) * stride
                const c = Math.floor(col / stride) * stride
                const r1 = Math.min(r + stride, source.rows - 1)
                const c1 = Math.min(c + stride, source.cols - 1)
                const tr = (row - r) / (r1 - r)
                const tc = (col - c) / (c1 - c)
                return (
                    values[r * source.cols + c] * (1 - tr) * (1 - tc) +
                    values[r * source.cols + c1] * (1 - tr) * tc +
                    values[r1 * source.cols + c] * tr * (1 - tc) +
                    values[r1 * source.cols + c1] * tr * tc
                )
            },
        }
    }
    const regional = sample_grid(definition, grid, definition.mesh_step)
    const step = definition.mesh_step
    const cell_x = (size_x / (rows - 1)) * step
    const cell_z = (size_z / (cols - 1)) * step
    const patches = details.map(({ definition: source, grid: values }) => {
        const field = sample_grid(source, values)
        // Patch borders land exactly on coarse cell edges. No overlapping coarse faces.
        const min_r = Math.max(0, Math.floor((field.min_x + size_x / 2) / cell_x))
        const max_r = Math.min(
            Math.ceil((rows - 1) / step),
            Math.ceil((field.max_x + size_x / 2) / cell_x),
        )
        const min_c = Math.max(0, Math.floor((field.min_z + size_z / 2) / cell_z))
        const max_c = Math.min(
            Math.ceil((cols - 1) / step),
            Math.ceil((field.max_z + size_z / 2) / cell_z),
        )
        const min_x = -size_x / 2 + min_r * cell_x
        const max_x = Math.min(size_x / 2, -size_x / 2 + max_r * cell_x)
        const min_z = -size_z / 2 + min_c * cell_z
        const max_z = Math.min(size_z / 2, -size_z / 2 + max_c * cell_z)
        return {
            field,
            min_r,
            max_r,
            min_c,
            max_c,
            min_x,
            max_x,
            min_z,
            max_z,
            mesh_rows:
                (max_r - min_r) *
                    Math.ceil(
                        ((cell_x / (field.max_x - field.min_x)) * (source.rows - 1)) /
                            source.mesh_step,
                    ) +
                1,
            mesh_cols:
                (max_c - min_c) *
                    Math.ceil(
                        ((cell_z / (field.max_z - field.min_z)) * (source.cols - 1)) /
                            source.mesh_step,
                    ) +
                1,
        }
    })
    const metres = (x, z) => {
        let value = regional.sample(x, z)
        for (const { field } of patches) {
            const edge = Math.min(
                (x - field.min_x) / (field.max_x - field.min_x),
                (field.max_x - x) / (field.max_x - field.min_x),
                (z - field.min_z) / (field.max_z - field.min_z),
                (field.max_z - z) / (field.max_z - field.min_z),
            )
            if (edge <= 0) continue
            const weight = smoothstep(0, 0.08, edge)
            value += (field.sample(x, z) - value) * weight
        }
        return value
    }
    const per_metre = definition.exaggeration / 1000 / km_per_unit
    const lift = definition.sea
        ? (value) => (value > 0 ? (value + 15) * per_metre : Math.max(value * per_metre, -0.4))
        : (value) => (value - definition.base) * per_metre
    const sample_distance = Math.min(cell_x, cell_z) / 20
    const slope = (x, z) =>
        Math.hypot(
            metres(x + sample_distance, z) - metres(x - sample_distance, z),
            metres(x, z + sample_distance) - metres(x, z - sample_distance),
        ) /
        (2 * sample_distance * km_per_unit * 1000)

    const positions = []
    const colors = []
    const indices = []
    const tiles = []
    const shore = new THREE.Color(0xe6d2a6)
    const sand = new THREE.Color(0xcfa974)
    const rock = new THREE.Color(0x8d6b4b)
    const high_rock = new THREE.Color(0x5e4737)
    const tint = new THREE.Color()
    const add_patch = (xs, zs, omit = false) => {
        const start = positions.length / 3
        tiles.push({ xs, zs, start })
        for (const x of xs) {
            for (const z of zs) {
                const value = metres(x, z)
                const relief = definition.sea ? value : value - definition.base
                const steep = slope(x, z) * definition.slope_gain
                positions.push(x, lift(value), z)
                tint.copy(sand)
                if (definition.sea) tint.lerp(shore, 1 - smoothstep(0, 160, relief))
                tint.lerp(
                    rock,
                    Math.max(smoothstep(0.12, 0.5, steep), smoothstep(500, 1500, relief)),
                )
                tint.lerp(high_rock, smoothstep(0.5, 1.1, steep) * 0.8)
                tint.multiplyScalar(0.93 + 0.14 * fbm(x * 0.7, z * 0.7))
                colors.push(tint.r, tint.g, tint.b)
            }
        }
        for (let r = 0; r < xs.length - 1; r += 1) {
            for (let c = 0; c < zs.length - 1; c += 1) {
                if (
                    omit &&
                    patches.some(
                        (patch) =>
                            r >= patch.min_r &&
                            r < patch.max_r &&
                            c >= patch.min_c &&
                            c < patch.max_c,
                    )
                )
                    continue
                const a = start + r * zs.length + c
                const b = a + 1
                const d = a + zs.length
                const e = d + 1
                if ((r + c) % 2) indices.push(a, b, d, b, e, d)
                else indices.push(a, b, e, a, e, d)
            }
        }
    }
    add_patch(
        Array.from({ length: Math.ceil((rows - 1) / step) + 1 }, (_, r) =>
            Math.min(size_x / 2, -size_x / 2 + r * cell_x),
        ),
        Array.from({ length: Math.ceil((cols - 1) / step) + 1 }, (_, c) =>
            Math.min(size_z / 2, -size_z / 2 + c * cell_z),
        ),
        true,
    )
    for (const patch of patches) {
        add_patch(
            Array.from(
                { length: patch.mesh_rows },
                (_, r) => patch.min_x + ((patch.max_x - patch.min_x) * r) / (patch.mesh_rows - 1),
            ),
            Array.from(
                { length: patch.mesh_cols },
                (_, c) => patch.min_z + ((patch.max_z - patch.min_z) * c) / (patch.mesh_cols - 1),
            ),
        )
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    const vertex = geometry.attributes.position
    // Ground queries follow the actual rendered triangles, including fine patch seams.
    const height = (x, z) => {
        const tile =
            tiles
                .slice(1)
                .find(
                    ({ xs, zs }) => x >= xs[0] && x <= xs.at(-1) && z >= zs[0] && z <= zs.at(-1),
                ) ?? tiles[0]
        const { xs, zs, start } = tile
        x = clamp(x, xs[0], xs.at(-1))
        z = clamp(z, zs[0], zs.at(-1))
        const r = clamp(Math.floor((x - xs[0]) / (xs[1] - xs[0])), 0, xs.length - 2)
        const c = clamp(Math.floor((z - zs[0]) / (zs[1] - zs[0])), 0, zs.length - 2)
        const a = start + r * zs.length + c
        const b = a + 1
        const d = a + zs.length
        const e = d + 1
        const tr = clamp((x - vertex.getX(a)) / (vertex.getX(d) - vertex.getX(a)), 0, 1)
        const tc = clamp((z - vertex.getZ(a)) / (vertex.getZ(b) - vertex.getZ(a)), 0, 1)
        const ya = vertex.getY(a),
            yb = vertex.getY(b),
            yd = vertex.getY(d),
            ye = vertex.getY(e)
        if ((r + c) % 2) {
            return tr + tc <= 1
                ? ya + (yd - ya) * tr + (yb - ya) * tc
                : ye + (yb - ye) * (1 - tr) + (yd - ye) * (1 - tc)
        }
        return tc >= tr
            ? ya + (yb - ya) * tc + (ye - yb) * tr
            : ya + (yd - ya) * tr + (ye - yd) * tc
    }
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    )
    mesh.name = 'landscape'
    mesh.castShadow = true
    mesh.receiveShadow = true
    return {
        mesh,
        height,
        slope,
        to_xz,
        size_x,
        size_z,
        in_units(units) {
            const scale = units / km_per_unit
            return {
                scale,
                to_xz: (lat, lon) => to_xz(lat, lon).map((value) => value / scale),
                height: (x, z) => height(x * scale, z * scale) / scale,
                slope: (x, z) => slope(x * scale, z * scale),
            }
        },
    }
}
