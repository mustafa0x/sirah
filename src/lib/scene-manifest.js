import stone_large_a from '../assets/kenney/stone_largeA.glb?url'
import stone_large_b from '../assets/kenney/stone_largeB.glb?url'
import stone_large_c from '../assets/kenney/stone_largeC.glb?url'
import stone_small_flat_a from '../assets/kenney/stone_smallFlatA.glb?url'
import stone_tall_a from '../assets/kenney/stone_tallA.glb?url'
import stone_tall_c from '../assets/kenney/stone_tallC.glb?url'

export const scene_pois = {
    overview: [
        {
            id: 'makkah',
            label: 'Makkah',
            description: 'The chapter begins with preparations for departure.',
            position: [-2.1, 0.18, 0.3],
            camera: { azimuth: -0.95, elevation: 0.58, distance: 8.2 },
        },
        {
            id: 'thawr',
            label: 'Thawr',
            description: 'The selected account places the cave stay within the journey.',
            position: [0, 0.18, -1.9],
            camera: { azimuth: 0.12, elevation: 0.6, distance: 7.4 },
        },
        {
            id: 'madinah',
            label: 'Madinah',
            description: 'The chapter closes with arrival and a new beginning.',
            position: [2.15, 0.18, 0.25],
            camera: { azimuth: 0.85, elevation: 0.58, distance: 8.2 },
        },
    ],
    thawr: [
        {
            id: 'shelter',
            label: 'Shelter',
            description: 'A schematic cave silhouette marks the selected stage.',
            position: [0, 0.55, -0.7],
            camera: { azimuth: 0, elevation: 0.56, distance: 6.5 },
        },
        {
            id: 'approach',
            label: 'Approach',
            description: 'The surrounding rock is an illustration, not an exact reconstruction.',
            position: [-2.25, 0.3, -0.2],
            camera: { azimuth: -0.7, elevation: 0.58, distance: 7.2 },
        },
        {
            id: 'night',
            label: 'Night view',
            description: 'The source and reading layers carry the historical account.',
            position: [2.1, 0.15, -0.4],
            camera: { azimuth: 0.7, elevation: 0.58, distance: 7.2 },
        },
    ],
}

export const scene_assets = [
    stone_large_a,
    stone_large_b,
    stone_large_c,
    stone_small_flat_a,
    stone_tall_a,
    stone_tall_c,
]
