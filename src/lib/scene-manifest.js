import terrain_index from '../assets/terrain/index.json'
import madinah_grid from '../assets/terrain/madinah.bin?url'
import makkah_grid from '../assets/terrain/makkah.bin?url'
import region_grid from '../assets/terrain/region.bin?url'
import { details } from '../content/details.js'
import shelter_asset from '../../art/thawr/shelter-web-v1.glb?url'

// One continuous relief with finer grids around the towns. Authored camera/set values
// retain their original units; the renderer places them in the shared regional frame.
// Place positions are modern coordinates; routes between them are schematic.
export const worlds = {
    region: {
        ...terrain_index.region,
        grid: region_grid,
        km_per_unit: 20,
        exaggeration: 1.5,
        base: 0,
        sea: true,
        // The border cuts through the African shore here; this corner holds only sea and
        // Africa, never Arabia.
        shore_corner: { north: 23, east: 38.3 },
        mesh_step: 1,
        slope_gain: 5,
        fog: [14, 70],
        zoom: [0.0002, 60],
        label_lift: 0.6,
    },
    makkah: {
        ...terrain_index.makkah,
        grid: makkah_grid,
        km_per_unit: 1,
        mesh_step: 2,
        fog: [6, 28],
        zoom: [0.004, 24],
        label_lift: 0.3,
    },
    madinah: {
        ...terrain_index.madinah,
        grid: madinah_grid,
        km_per_unit: 1,
        mesh_step: 2,
        fog: [6, 28],
        zoom: [0.02, 24],
        label_lift: 0.3,
    },
}

export const places = {
    region_centre: { world: 'region', lat: 22.9, lon: 39.45 },
    region_makkah: { world: 'region', lat: 21.4225, lon: 39.8262 },
    region_madinah: { world: 'region', lat: 24.4672, lon: 39.6111 },
    coast: { world: 'region', lat: 22.75, lon: 39.2 },
    road: { world: 'region', lat: 21.95, lon: 39.28 },
    tent: { world: 'region', lat: 22.3, lon: 39.22 },
    makkah: { world: 'makkah', lat: 21.4225, lon: 39.8262 },
    makkah_valley: { world: 'makkah', lat: 21.401, lon: 39.838 },
    thawr: { world: 'makkah', lat: 21.37718, lon: 39.84971 },
    // The shelter set is placed on the gentlest ground near the summit; see the renderer.
    cave: { world: 'makkah', set: 'cave' },
    madinah: { world: 'madinah', lat: 24.4672, lon: 39.6111 },
    quba: { world: 'madinah', lat: 24.4393, lon: 39.6173 },
}

// `leg` 0 is Makkah → Thawr, `leg` 1 is Thawr → Quba, `leg` 2 is Quba → Madinah. Each
// piece is drawn while the leg's progress moves through [from, to].
export const routes = [
    {
        world: 'makkah',
        leg: 0,
        from: 0,
        to: 1,
        points: [
            [21.4225, 39.8262],
            [21.411, 39.829],
            [21.398, 39.836],
            [21.386, 39.846],
            [21.3795, 39.8495],
        ],
    },
    {
        world: 'makkah',
        leg: 1,
        from: 0,
        to: 0.06,
        points: [
            [21.3795, 39.8495],
            [21.37, 39.835],
            [21.372, 39.8],
            [21.385, 39.76],
            [21.4, 39.722],
        ],
    },
    {
        world: 'region',
        leg: 0,
        from: 0,
        to: 1,
        points: [
            [21.4225, 39.8262],
            [21.377, 39.85],
        ],
    },
    {
        world: 'region',
        leg: 1,
        from: 0,
        to: 1,
        points: [
            [21.377, 39.85],
            [21.5, 39.52],
            [21.85, 39.3],
            [22.3, 39.22],
            [22.75, 39.2],
            [23.2, 39.1],
            [23.65, 39.15],
            [24.05, 39.33],
            [24.3, 39.52],
            [24.4393, 39.6173],
        ],
    },
    {
        world: 'madinah',
        leg: 1,
        from: 0.94,
        to: 1,
        points: [
            [24.332, 39.53],
            [24.37, 39.575],
            [24.41, 39.605],
            [24.4393, 39.6173],
        ],
    },
    {
        world: 'madinah',
        leg: 2,
        from: 0,
        to: 1,
        points: [
            [24.4393, 39.6173],
            [24.449, 39.6185],
            [24.459, 39.614],
            [24.4672, 39.6111],
        ],
    },
]

// `place` is where selecting the label flies to; `anchors` is where the label sits in
// each world that shows it.
// Representative chapter locations, not surveyed event coordinates.
// Where each chapter sits on the map: the setting it is told in, from its own place links.
// The guide's chapter is about the road after the cave, so it sits on the coastal way.
export const chapter_places = {
    hch_early_migration: 'makkah',
    hch_aqaba: 'makkah',
    hch_preparations: 'makkah',
    hch_departure: 'makkah',
    hch_thawr: 'thawr',
    hch_road: 'coast',
    hch_suraqa: 'road',
    hch_umm_mabad: 'tent',
    hch_quba: 'quba',
    hch_madinah_arrival: 'madinah',
    hch_mosque: 'madinah',
    hch_settlement: 'madinah',
}

export const scene_pois = [
    {
        id: 'makkah',
        label: 'Makkah',
        description: 'Where the journey begins, with preparations for departure.',
        place: 'makkah',
        anchors: { region: 'region_makkah', makkah: 'makkah' },
        // Named on the home page too, at either end of the route.
        home: true,
        camera: { azimuth: -0.35, elevation: 0.5, distance: 6 },
    },
    {
        id: 'thawr',
        label: 'Mount Thawr',
        description: 'The account places a three-night stay in a cave here.',
        place: 'thawr',
        anchors: { makkah: 'thawr' },
        ring: false,
        camera: { azimuth: 0.9, elevation: 0.3, distance: 4.5 },
    },
    {
        id: 'coast',
        label: 'The coastal way',
        description:
            'The guide led them by the coast. This line is schematic, not a measured route.',
        place: 'coast',
        anchors: { region: 'coast' },
        camera: { azimuth: 0.3, elevation: 0.55, distance: 14 },
    },
    {
        id: 'quba',
        label: 'Quba',
        description: 'The first stop on reaching Madinah, among Bani ‘Amr ibn ‘Awf.',
        place: 'quba',
        anchors: { madinah: 'quba' },
        camera: { azimuth: 0.4, elevation: 0.4, distance: 2.4 },
    },
    {
        id: 'madinah',
        label: 'Madinah',
        description: 'Where the journey closes, with arrival and a new beginning.',
        place: 'madinah',
        anchors: { region: 'region_madinah', madinah: 'madinah' },
        home: true,
        camera: { azimuth: 0.35, elevation: 0.45, distance: 6 },
    },
]

// Details are smaller markers, shown only at a middling distance so they neither crowd
// the overview nor float in front of the close views.
const detail_view = {
    region: { within: 16, beyond: 0, camera: { azimuth: 0.25, elevation: 0.5, distance: 6 } },
    makkah: { within: 9, beyond: 0.4, camera: { azimuth: 0.3, elevation: 0.45, distance: 2.4 } },
    madinah: { within: 9, beyond: 0.4, camera: { azimuth: 0.3, elevation: 0.45, distance: 1.8 } },
}
const cave_camera = { azimuth: 1.17, elevation: 0.13, distance: 0.023, height: 0.0018 }
for (const item of details) {
    const key = item.set ?? `detail_${item.id}`
    if (!item.set) places[key] = { world: item.world, lat: item.lat, lon: item.lon }
    scene_pois.push({
        ...detail_view[item.world],
        ...(item.set ? { camera: cave_camera } : {}),
        ...(item.within === undefined ? {} : { within: item.within, beyond: item.beyond }),
        id: `detail_${item.id}`,
        label: item.title,
        detail: item,
        place: key,
        anchors: { [item.world]: key },
        ring: false,
        lift: item.lift ?? (item.world === 'region' ? 0.25 : 0.12),
    })
}

// Distances and heights are in the place's world units (kilometres in the two local
// worlds). `offset` moves the target [north, up, east] from the place.
const shot = (place, azimuth, elevation, distance, height = 0.3, offset = null, fov = 36) => ({
    place,
    azimuth,
    elevation,
    distance,
    height,
    offset,
    fov,
})

const south = -Math.PI / 2
const north = Math.PI / 2

// Looking north-west along the coast: the sea to the upper left, the route rising from
// Makkah towards Madinah across the open middle of the view.
export const overview_shot = {
    ...shot('region_centre', -0.5, 0.68, 34, 0.2),
    // On a tall screen the route runs bottom to top instead of left to right.
    portrait: shot('region_centre', -1.35, 0.95, 60, 0.2, null, 44),
}

// The home page looks north up the coast: the sea lies behind the title and the route runs
// away from the viewer on the right, Makkah to Madinah, with no map edge in frame.
export const home_shot = {
    ...shot('region_centre', -1.4, 1.28, 44, 0.2, [-0.8, 0, -3.5]),
    // On a tall screen the text sits below, so the route fills the top half.
    portrait: shot('region_centre', -1.4, 1.5, 90, 0.2, [-5, 0, -2.5]),
}

// Opening a chapter on the map flies to its place, keeping the regional scale: places in the
// town views are shown at the town on the regional map.
const regional_place = {
    makkah: 'region_makkah',
    thawr: 'region_makkah',
    quba: 'region_madinah',
    madinah: 'region_madinah',
}
export const chapter_focus_shots = Object.fromEntries(
    Object.entries(chapter_places).map(([id, place]) => [
        id,
        shot(regional_place[place] ?? place, -0.5, 0.72, 10, 0.2),
    ]),
)

// One camera move per narrative beat. An azimuth of `north` puts the camera north of its
// target, looking south. `follow` keeps the target on the tip of that route leg.
export const beat_shots = {
    N01a: overview_shot,
    N01b: shot('makkah', -0.4, 0.5, 8),
    N02a: shot('makkah', 0.25, 0.42, 4.4, 0.1),
    N02b: shot('makkah_valley', north - 0.25, 0.36, 8.5, 0.1),
    // Outside the shelter, looking at its opening.
    N09a: shot('makkah', 0.6, 0.5, 2.6, 0.1),
    N09b: shot('makkah', -0.3, 0.3, 1.3, 0.05),
    N09c: shot('makkah', north - 0.2, 0.42, 4, 0.1),
    N03a: shot('cave', north - 0.4, 0.13, 0.023, 0.0018),
    // From behind Thawr, towards Makkah.
    N03b: shot('makkah_valley', south + 0.3, 0.3, 8.5, 0.1),
    // Three nights pass over the slope.
    N03c: shot('cave', north + 0.9, 0.1, 0.06, 0.006),
    // Inside the shelter, looking out and up past the overhang.
    N03d: shot('cave', south, -0.3, 0.006, 0, [0.00703, 0.00242, 0], 85),
    N03e: shot('cave', north - 0.15, 0.02, 0.028, 0.0045),
    N04a: shot('thawr', 0.5, 0.5, 11, 0.1),
    N04b: { ...shot('coast', 0.2, 0.5, 9, 0.2), follow: 1 },
    N06a: { ...shot('road', -0.5, 0.42, 7, 0.2), follow: 1 },
    N06b: { ...shot('road', south + 0.5, 0.26, 4.2, 0.2), follow: 1 },
    N06c: { ...shot('road', south + 0.15, 0.5, 9, 0.2), follow: 1 },
    N10a: shot('tent', -0.3, 0.42, 5, 0.2),
    N10b: shot('tent', 0.45, 0.3, 3.2, 0.2),
    N05a: shot('quba', 0.5, 0.45, 5.2, 0.1),
    N07a: shot('quba', south + 0.35, 0.07, 0.3, 0.014),
    // Close behind the camel as she walks from Quba into the town.
    N08a: { ...shot('quba', south + 0.3, 0.55, 1.8, 0.03), follow: 2 },
    N05b: shot('madinah', north - 0.6, 0.38, 0.5, 0.02),
}

// Light and route progress per chapter step. The time of day is art direction only. Each
// route leg runs [from, to] as the step plays, finishing at `span` of the step's length.
const one = [1, 1]
export const step_scenes = {
    setting: { mood: 'gold', route: [] },
    preparations: { mood: 'dusk', route: [] },
    departure: { mood: 'night', route: [] },
    thawr: { mood: 'night', route: [[0, 1, 0.12]] },
    onward: { mood: 'haze', route: [one, [0, 0.25]] },
    pursuit: { mood: 'day', route: [one, [0.25, 0.32]] },
    tent: { mood: 'gold', route: [one, [0.32, 0.4, 0.4]] },
    quba: { mood: 'gold', route: [one, [0.4, 1, 0.6]] },
    arrival: { mood: 'day', route: [one, one, [0, 1, 0.5]] },
}

export function route_at(step_id, progress) {
    return [0, 1, 2].map((leg) => {
        const [from, to, span = 1] = step_scenes[step_id].route[leg] ?? [0, 0]
        return from + (to - from) * Math.max(0, Math.min(1, progress / span))
    })
}

// Beats during which the sky runs through three nights, driven by playback position.
export const timelapse_beats = { N03c: true }

// Beats that set a cited passage in the scene itself.
export const beat_passages = { N03e: 'E09' }

// Beats during which an animal stands in the scene. No person is ever shown.
export const beat_actors = { N06b: 'horse' }

export { shelter_asset }
