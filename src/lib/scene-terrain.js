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
    const sample_grid = (source, values, stride = 1, triangular = false) => {
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
                const a = values[r * source.cols + c],
                    b = values[r * source.cols + c1],
                    d = values[r1 * source.cols + c],
                    e = values[r1 * source.cols + c1]
                if (triangular) {
                    if ((r / stride + c / stride) % 2) {
                        return tr + tc <= 1
                            ? a + (d - a) * tr + (b - a) * tc
                            : e + (b - e) * (1 - tr) + (d - e) * (1 - tc)
                    }
                    return tc >= tr
                        ? a + (b - a) * tc + (e - b) * tr
                        : a + (d - a) * tr + (e - d) * tc
                }
                return a * (1 - tr) * (1 - tc) + b * (1 - tr) * tc + d * tr * (1 - tc) + e * tr * tc
            },
        }
    }
    const regional = sample_grid(definition, grid, definition.mesh_step, true)
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
    const detail_weight = (field, x, z) =>
        smoothstep(
            0,
            0.35,
            1 -
                Math.hypot(
                    (2 * x - field.min_x - field.max_x) / (field.max_x - field.min_x),
                    (2 * z - field.min_z - field.max_z) / (field.max_z - field.min_z),
                ),
        )
    // Land in a `shore_corner` sinks into the sea towards the map's south and west borders,
    // so the border reads as a coastline rather than a straight cut.
    const corner = definition.shore_corner
    const shore_fade = (x, z) => {
        if (!corner) return 1
        const lat = lat0 + (x * km_per_unit) / KM_PER_DEGREE
        const lon = lon0 + (z * km_per_unit) / km_per_lon
        if (lat > corner.north || lon > corner.east) return 1
        return smoothstep(0.1, 0.7, Math.min(lat - south, lon - west))
    }
    // Sunk to open-sea depth, so the corner matches the water beyond the map.
    const sink = (x, z, value) => {
        const fade = shore_fade(x, z)
        return fade < 1 && value > -1500 ? value + (-1500 - value) * (1 - fade) : value
    }
    const metres = (x, z) => {
        let value = regional.sample(x, z)
        for (const { field } of patches) {
            const weight = detail_weight(field, x, z)
            if (!weight) continue
            value += (field.sample(x, z) - value) * weight
        }
        return sink(x, z, value)
    }
    const per_metre = definition.exaggeration / 1000 / km_per_unit
    // Land stands 15 m proud of the water so the two never flicker. The rise eases in over
    // the last 40 m below sea level, so the shoreline follows the elevation smoothly instead
    // of stepping at every grid cell that crosses zero.
    const lift = definition.sea
        ? (value) => Math.max((value + 15 * smoothstep(-40, 0, value)) * per_metre, -0.4)
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
    const normals = []
    const normal = new THREE.Vector3()
    const macro_normal = new THREE.Vector3()
    const indices = []
    const tiles = []
    const shore = new THREE.Color(0xe6d2a6)
    const sand = new THREE.Color(0xcfa974)
    const rock = new THREE.Color(0x8d6b4b)
    const high_rock = new THREE.Color(0x5e4737)
    // The seabed, seen through the water: pale in the shallows, deep blue offshore.
    const shallows = new THREE.Color(0x8fd0c2)
    const depths = new THREE.Color(0x0c2a3e)
    const tint = new THREE.Color()
    const macro_attribute = (x, z, values) => {
        const { xs, zs } = tiles[0]
        const r = clamp(Math.floor((x - xs[0]) / (xs[1] - xs[0])), 0, xs.length - 2)
        const c = clamp(Math.floor((z - zs[0]) / (zs[1] - zs[0])), 0, zs.length - 2)
        const a = r * zs.length + c,
            b = a + 1,
            d = a + zs.length,
            e = d + 1
        const tr = clamp(
            (x - Math.fround(positions[a * 3])) /
                (Math.fround(positions[d * 3]) - Math.fround(positions[a * 3])),
            0,
            1,
        )
        const tc = clamp(
            (z - Math.fround(positions[a * 3 + 2])) /
                (Math.fround(positions[b * 3 + 2]) - Math.fround(positions[a * 3 + 2])),
            0,
            1,
        )
        return [0, 1, 2].map((channel) => {
            const ya = Math.fround(values[a * 3 + channel]),
                yb = Math.fround(values[b * 3 + channel]),
                yd = Math.fround(values[d * 3 + channel]),
                ye = Math.fround(values[e * 3 + channel])
            if ((r + c) % 2) {
                return tr + tc <= 1
                    ? ya + (yd - ya) * tr + (yb - ya) * tc
                    : ye + (yb - ye) * (1 - tr) + (yd - ye) * (1 - tc)
            }
            return tc >= tr
                ? ya + (yb - ya) * tc + (ye - yb) * tr
                : ya + (yd - ya) * tr + (ye - yd) * tc
        })
    }
    const add_patch = (xs, zs, omit = false) => {
        const start = positions.length / 3
        tiles.push({ xs, zs, start })
        for (const x of xs) {
            for (const z of zs) {
                const value = metres(x, z)
                // One macro colour field prevents resolution changes painting visible tiles.
                const macro = sink(x, z, regional.sample(x, z))
                const relief = definition.sea ? macro : macro - definition.base
                const steep =
                    (Math.hypot(
                        regional.sample(x + sample_distance, z) -
                            regional.sample(x - sample_distance, z),
                        regional.sample(x, z + sample_distance) -
                            regional.sample(x, z - sample_distance),
                    ) /
                        (2 * sample_distance * km_per_unit * 1000)) *
                    definition.slope_gain
                positions.push(x, lift(value), z)
                normal
                    .set(
                        -(
                            lift(metres(x + sample_distance, z)) -
                            lift(metres(x - sample_distance, z))
                        ) /
                            (2 * sample_distance),
                        1,
                        -(
                            lift(metres(x, z + sample_distance)) -
                            lift(metres(x, z - sample_distance))
                        ) /
                            (2 * sample_distance),
                    )
                    .normalize()
                if (!omit) {
                    const weight = Math.max(
                        ...patches.map(({ field }) => detail_weight(field, x, z)),
                    )
                    macro_normal
                        .fromArray(macro_attribute(x, z, normals))
                        .lerp(normal, weight)
                        .normalize()
                    normals.push(macro_normal.x, macro_normal.y, macro_normal.z)
                    colors.push(...macro_attribute(x, z, colors))
                    continue
                }
                normals.push(normal.x, normal.y, normal.z)
                tint.copy(sand)
                if (definition.sea) tint.lerp(shore, 1 - smoothstep(0, 160, relief))
                tint.lerp(
                    rock,
                    Math.max(smoothstep(0.12, 0.5, steep), smoothstep(500, 1500, relief)),
                )
                tint.lerp(high_rock, smoothstep(0.5, 1.1, steep) * 0.8)
                if (definition.sea && relief < 0) {
                    // Towards the map's edges the seabed fades to open water, so it meets the
                    // deep floor beyond without a seam.
                    const lat = lat0 + (x * km_per_unit) / KM_PER_DEGREE
                    const lon = lon0 + (z * km_per_unit) / km_per_lon
                    const edge = Math.min(lat - south, north - lat, lon - west, east - lon)
                    tint.copy(shallows).lerp(
                        depths,
                        Math.max(smoothstep(0, 500, -relief), 1 - smoothstep(0.1, 0.6, edge)),
                    )
                }
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
    // Beyond the mapped area the land and sea carry on, so no view ends at a cut edge. The
    // border's heights are averaged along the edge (wider further out, so nothing streaks),
    // then settle to low, gently varied desert or to open sea. Inside the border the skirt
    // drops below the map, which covers it.
    const build_skirt = () => {
        const reach = 60
        const step = 0.8
        const half_x = size_x / 2
        const half_z = size_z / 2
        const edge_value = (x, z) => {
            const qx = clamp(x, -half_x, half_x)
            const qz = clamp(z, -half_z, half_z)
            const out = Math.hypot(x - qx, z - qz)
            const spread = 0.8 + 0.35 * out
            // Sample along the border near the nearest edge point, a little inside it.
            const along_x = Math.abs(x - qx) < Math.abs(z - qz) || out === 0
            let total = 0
            for (let k = -3; k <= 3; k += 1) {
                const sx = along_x ? clamp(qx + (k * spread) / 3, -half_x, half_x) : qx * 0.995
                const sz = along_x ? qz * 0.995 : clamp(qz + (k * spread) / 3, -half_z, half_z)
                total += metres(sx, sz)
            }
            const average = total / 7
            const settled = average > 0 ? 350 + 160 * (fbm(x * 0.35, z * 0.35) - 0.5) : -1500
            return { value: average + (settled - average) * smoothstep(0, 18, out), out }
        }
        const skirt_positions = []
        const skirt_colors = []
        const skirt_indices = []
        const xs = []
        const zs = []
        for (let x = -half_x - reach; x <= half_x + reach + 1e-6; x += step) xs.push(x)
        for (let z = -half_z - reach; z <= half_z + reach + 1e-6; z += step) zs.push(z)
        for (const x of xs) {
            for (const z of zs) {
                const { value, out } = edge_value(x, z)
                // Tucked 60 m under the map where the two overlap.
                const y = lift(value) - (out === 0 ? 60 * per_metre : 0)
                skirt_positions.push(x, y, z)
                if (value < 0) tint.copy(shallows).lerp(depths, smoothstep(0, 500, -value))
                else {
                    tint.copy(sand).lerp(shore, 1 - smoothstep(0, 160, value))
                    tint.lerp(rock, smoothstep(500, 1500, value) * 0.6)
                }
                tint.multiplyScalar(0.93 + 0.14 * fbm(x * 0.7, z * 0.7))
                skirt_colors.push(tint.r, tint.g, tint.b)
            }
        }
        const inside = (x, z) => Math.abs(x) < half_x - step && Math.abs(z) < half_z - step
        for (let r = 0; r < xs.length - 1; r += 1) {
            for (let c = 0; c < zs.length - 1; c += 1) {
                // Cells well inside the map are never seen; leave them out.
                if (inside(xs[r], zs[c]) && inside(xs[r + 1], zs[c + 1])) continue
                const a = r * zs.length + c
                const b = a + 1
                const d = a + zs.length
                const e = d + 1
                skirt_indices.push(a, b, d, b, e, d)
            }
        }
        const skirt_geometry = new THREE.BufferGeometry()
        skirt_geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(skirt_positions, 3),
        )
        skirt_geometry.setAttribute('color', new THREE.Float32BufferAttribute(skirt_colors, 3))
        skirt_geometry.setIndex(skirt_indices)
        skirt_geometry.computeVertexNormals()
        const skirt = new THREE.Mesh(
            skirt_geometry,
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
        )
        skirt.name = 'landscape-skirt'
        skirt.receiveShadow = true
        return skirt
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
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
        new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: false,
            roughness: 1,
            fog: false,
        }),
    )
    mesh.name = 'landscape'
    mesh.castShadow = true
    mesh.receiveShadow = true
    return {
        mesh,
        // Kept apart from `mesh`, so picking and ground queries only ever see the map.
        skirt: definition.sea ? build_skirt() : null,
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
