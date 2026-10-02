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

export async function load_grid(definition) {
    const response = await fetch(definition.grid)
    if (!response.ok) throw new Error(`Elevation grid unavailable: ${response.status}`)
    return new Int16Array(await response.arrayBuffer())
}

// Turns one elevation grid into a relief mesh plus the lookups the scene needs: world
// position for a latitude/longitude, and ground height and slope at a world position.
export function build_terrain(THREE, definition, grid) {
    const { rows, cols, south, north, west, east, km_per_unit } = definition
    const lat0 = (south + north) / 2
    const lon0 = (west + east) / 2
    const km_per_lon = KM_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180)
    const size_x = ((north - south) * KM_PER_DEGREE) / km_per_unit
    const size_z = ((east - west) * km_per_lon) / km_per_unit
    const cell_metres = ((north - south) * KM_PER_DEGREE * 1000) / (rows - 1)
    const per_metre = definition.exaggeration / 1000 / km_per_unit

    const lift = definition.sea
        ? (metres) => (metres > 0 ? (metres + 15) * per_metre : Math.max(metres * per_metre, -0.4))
        : (metres) => (metres - definition.base) * per_metre
    const metres_at = (row, col) => {
        const r = clamp(row, 0, rows - 1.001)
        const c = clamp(col, 0, cols - 1.001)
        const r0 = Math.floor(r)
        const c0 = Math.floor(c)
        const tr = r - r0
        const tc = c - c0
        const index = r0 * cols + c0
        return (
            grid[index] * (1 - tr) * (1 - tc) +
            grid[index + 1] * (1 - tr) * tc +
            grid[index + cols] * tr * (1 - tc) +
            grid[index + cols + 1] * tr * tc
        )
    }
    const row_of = (x) => (x / size_x + 0.5) * (rows - 1)
    const col_of = (z) => (z / size_z + 0.5) * (cols - 1)
    const height = (x, z) => lift(metres_at(row_of(x), col_of(z)))
    const slope_at = (row, col) =>
        Math.hypot(
            metres_at(row + 1, col) - metres_at(row - 1, col),
            metres_at(row, col + 1) - metres_at(row, col - 1),
        ) /
        (2 * cell_metres)
    const slope = (x, z) => slope_at(row_of(x), col_of(z))
    const to_xz = (lat, lon) => [
        ((lat - lat0) * KM_PER_DEGREE) / km_per_unit,
        ((lon - lon0) * km_per_lon) / km_per_unit,
    ]

    const step = definition.mesh_step
    const mesh_rows = Math.floor((rows - 1) / step) + 1
    const mesh_cols = Math.floor((cols - 1) / step) + 1
    const positions = new Float32Array(mesh_rows * mesh_cols * 3)
    const colors = new Float32Array(mesh_rows * mesh_cols * 3)
    const shore = new THREE.Color(0xe6d2a6)
    const sand = new THREE.Color(0xcfa974)
    const rock = new THREE.Color(0x8d6b4b)
    const high_rock = new THREE.Color(0x5e4737)
    const tint = new THREE.Color()
    for (let r = 0; r < mesh_rows; r += 1) {
        for (let c = 0; c < mesh_cols; c += 1) {
            const edge = r === 0 || c === 0 || r === mesh_rows - 1 || c === mesh_cols - 1
            // A little jitter breaks the grid so flat shading reads as carved relief.
            const row = r * step + (edge ? 0 : (hash(r, c) - 0.5) * 0.5 * step)
            const col = c * step + (edge ? 0 : (hash(c, r + 9) - 0.5) * 0.5 * step)
            const metres = metres_at(row, col)
            const index = (r * mesh_cols + c) * 3
            positions[index] = (row / (rows - 1) - 0.5) * size_x
            positions[index + 1] = lift(metres)
            positions[index + 2] = (col / (cols - 1) - 0.5) * size_z
            const relief = definition.sea ? metres : metres - definition.base
            const steep = slope_at(row, col) * definition.slope_gain
            tint.copy(sand)
            if (definition.sea) tint.lerp(shore, 1 - smoothstep(0, 160, relief))
            tint.lerp(rock, Math.max(smoothstep(0.12, 0.5, steep), smoothstep(500, 1500, relief)))
            tint.lerp(high_rock, smoothstep(0.5, 1.1, steep) * 0.8)
            tint.multiplyScalar(0.93 + 0.14 * fbm(row * 0.07, col * 0.07))
            colors[index] = tint.r
            colors[index + 1] = tint.g
            colors[index + 2] = tint.b
        }
    }
    const indices = new Uint32Array((mesh_rows - 1) * (mesh_cols - 1) * 6)
    let cursor = 0
    for (let r = 0; r < mesh_rows - 1; r += 1) {
        for (let c = 0; c < mesh_cols - 1; c += 1) {
            const a = r * mesh_cols + c
            const b = a + 1
            const d = a + mesh_cols
            const e = d + 1
            // Alternate the diagonal so the triangles do not all lean the same way.
            if ((r + c) % 2) indices.set([a, b, d, b, e, d], cursor)
            else indices.set([a, b, e, a, e, d], cursor)
            cursor += 6
        }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    )
    mesh.castShadow = true
    mesh.receiveShadow = true

    return { mesh, height, slope, to_xz, size_x, size_z }
}
