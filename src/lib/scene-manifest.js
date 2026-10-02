import terrain_index from '../assets/terrain/index.json'
import madinah_grid from '../assets/terrain/madinah.bin?url'
import makkah_grid from '../assets/terrain/makkah.bin?url'
import region_grid from '../assets/terrain/region.bin?url'
import shelter_asset from '../../art/thawr/shelter-web-v1.glb?url'

// Three nested views of real elevation data. Within a world, x runs south → north and
// z runs west → east, in units of `km_per_unit`. Heights are exaggerated for legibility.
// Place positions are modern coordinates; routes between them are schematic.
export const worlds = {
    region: {
        ...terrain_index.region,
        grid: region_grid,
        km_per_unit: 20,
        exaggeration: 8,
        base: 0,
        sea: true,
        mesh_step: 1,
        slope_gain: 5,
        fog: [14, 70],
        zoom: [5, 60],
        label_lift: 0.6,
    },
    makkah: {
        ...terrain_index.makkah,
        grid: makkah_grid,
        km_per_unit: 1,
        exaggeration: 1.5,
        base: 240,
        sea: false,
        mesh_step: 1,
        slope_gain: 1,
        fog: [6, 28],
        zoom: [0.004, 24],
        label_lift: 0.3,
    },
    madinah: {
        ...terrain_index.madinah,
        grid: madinah_grid,
        km_per_unit: 1,
        exaggeration: 1.5,
        base: 590,
        sea: false,
        mesh_step: 1,
        slope_gain: 1,
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
    road: { world: 'region', lat: 23.2, lon: 39.1 },
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
export const scene_pois = [
    {
        id: 'makkah',
        label: 'Makkah',
        description: 'Where the chapter begins, with preparations for departure.',
        place: 'makkah',
        anchors: { region: 'region_makkah', makkah: 'makkah' },
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
        id: 'not_shown',
        label: 'What is not shown',
        description:
            'Popular retellings add a spider’s web and nesting doves at the cave mouth. Those details are not in the accounts this chapter cites, so the scene leaves them out.',
        place: 'cave',
        anchors: { makkah: 'cave' },
        ring: false,
        lift: 0.006,
        within: 0.027,
        camera: { azimuth: 1.17, elevation: 0.13, distance: 0.023, height: 0.0018 },
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
        description: 'Where the chapter closes, with arrival and a new beginning.',
        place: 'madinah',
        anchors: { region: 'region_madinah', madinah: 'madinah' },
        camera: { azimuth: 0.35, elevation: 0.45, distance: 6 },
    },
]

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

export const overview_shot = {
    ...shot('region_centre', 0, 0.6, 26, 0.2),
    // On a tall screen the route runs bottom to top instead of left to right.
    portrait: shot('region_centre', -1.35, 0.95, 44, 0.2),
}

// One camera move per narrative beat. An azimuth of `north` puts the camera north of its
// target, looking south. `follow` keeps the target on the tip of that route leg.
export const beat_shots = {
    N01a: overview_shot,
    N01b: shot('makkah', -0.4, 0.5, 8),
    N02a: shot('makkah', 0.25, 0.42, 3.4, 0.1),
    N02b: shot('makkah_valley', north - 0.25, 0.36, 8.5, 0.1),
    // Outside the shelter, looking at its opening.
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
    N05a: shot('quba', 0.5, 0.45, 5.2, 0.1),
    N07a: shot('quba', south + 0.35, 0.07, 0.3, 0.014),
    N08a: shot('madinah', 0.45, 0.42, 4.6, 0.1),
    N05b: shot('madinah', north - 0.6, 0.2, 0.9, 0.03),
}

// Light and route progress per chapter step. The time of day is art direction only. Each
// route leg runs [from, to] as the step plays, finishing at `span` of the step's length.
export const step_scenes = {
    setting: { mood: 'gold', route: [] },
    preparations: { mood: 'dusk', route: [] },
    thawr: { mood: 'night', route: [[0, 1, 0.12]] },
    onward: {
        mood: 'haze',
        route: [
            [1, 1],
            [0, 0.42],
        ],
    },
    pursuit: {
        mood: 'day',
        route: [
            [1, 1],
            [0.42, 0.68],
        ],
    },
    quba: {
        mood: 'gold',
        route: [
            [1, 1],
            [0.68, 1, 0.35],
        ],
    },
    arrival: {
        mood: 'day',
        route: [
            [1, 1],
            [1, 1],
            [0, 1, 0.45],
        ],
    },
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

export { shelter_asset }
