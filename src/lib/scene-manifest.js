import stone_large_a from '../assets/kenney/stone_largeA.glb?url'
import stone_large_b from '../assets/kenney/stone_largeB.glb?url'
import stone_large_c from '../assets/kenney/stone_largeC.glb?url'
import stone_small_flat_a from '../assets/kenney/stone_smallFlatA.glb?url'

// The world is a schematic relief, not a measured map. x runs south → north (screen
// left → right), z runs west → east (the sea is on the far side of the default view).
export const places = {
    makkah: [-5, 1.2],
    thawr: [-8.3, 2.6],
    cave: [-8.3, 3.3],
    coast: [-1.5, -4.6],
    madinah: [7.4, 0.8],
}

export const route_legs = [
    // Makkah → Thawr
    [
        [-5, 1.2],
        [-5.9, 2.2],
        [-7.1, 3.4],
        [-8.1, 3.75],
    ],
    // Thawr → the coastal way → Madinah
    [
        [-8.1, 3.75],
        [-9.6, 2.6],
        [-9.9, 0.2],
        [-8.6, -3],
        [-6, -4.5],
        [-1.5, -4.6],
        [2.4, -4.4],
        [5.2, -3.3],
        [6.7, -1.2],
        [7.4, 0.8],
    ],
]

export const scene_pois = [
    {
        id: 'makkah',
        label: 'Makkah',
        description: 'Where the chapter begins, with preparations for departure.',
        place: 'makkah',
        lift: 0.75,
        camera: { azimuth: -0.35, elevation: 0.5, distance: 8.5 },
    },
    {
        id: 'thawr',
        label: 'Mount Thawr',
        description: 'The account places a three-night stay in a cave here.',
        place: 'thawr',
        lift: 0.55,
        ring: false,
        camera: { azimuth: -0.3, elevation: 0.36, distance: 8 },
    },
    {
        id: 'coast',
        label: 'The coastal way',
        description:
            'The guide led them by the coast. This line is schematic, not a measured route.',
        place: 'coast',
        lift: 0.5,
        camera: { azimuth: 0.3, elevation: 0.55, distance: 14 },
    },
    {
        id: 'madinah',
        label: 'Madinah',
        description: 'Where the chapter closes, with arrival and a new beginning.',
        place: 'madinah',
        lift: 0.9,
        camera: { azimuth: 0.35, elevation: 0.45, distance: 8.5 },
    },
]

const shot = (place, azimuth, elevation, distance, height = 0.3) => ({
    place,
    azimuth,
    elevation,
    distance,
    height,
})

export const overview_shot = {
    target: [-0.6, 0.2, -0.4],
    azimuth: 0,
    elevation: 0.6,
    distance: 26,
    // On a tall screen the route runs bottom to top instead of left to right.
    portrait: { target: [-0.6, 0.2, -1], azimuth: -1.35, elevation: 0.95, distance: 44 },
}

// One camera move per narrative beat.
export const beat_shots = {
    N01a: overview_shot,
    N01b: shot('makkah', -0.45, 0.5, 9.5),
    N02a: shot('makkah', -0.1, 0.62, 9),
    N02b: { target: [-6.7, 0.6, 2.2], azimuth: -0.5, elevation: 0.5, distance: 10.5 },
    N03a: shot('cave', -0.22, 0.2, 6.4, 0.3),
    N03b: { target: [-6.6, 0.6, 2.2], azimuth: 0.55, elevation: 0.42, distance: 9.5 },
    N03c: shot('cave', -0.85, 0.3, 7, 0),
    N03d: shot('cave', 0.12, 0.72, 5.4, 0),
    N03e: shot('cave', -0.1, 0.07, 6.6, 0.5),
    N04a: { target: [-8.2, 0.3, -0.6], azimuth: 0.55, elevation: 0.52, distance: 13 },
    N04b: { target: [0.5, 0.1, -3.4], azimuth: 0.15, elevation: 0.7, distance: 18 },
    N05a: shot('madinah', 0.45, 0.42, 9),
    N05b: shot('madinah', 0.08, 0.3, 6.2),
}

// Light and route progress per chapter step. The time of day is art direction only.
export const step_scenes = {
    setting: { mood: 'gold', route: [0, 0] },
    preparations: { mood: 'dusk', route: [0, 0] },
    thawr: { mood: 'night', route: [1, 0] },
    onward: { mood: 'haze', route: [1, 0.72] },
    arrival: { mood: 'day', route: [1, 1] },
}

export const stone_assets = [stone_large_a, stone_large_b, stone_large_c, stone_small_flat_a]
