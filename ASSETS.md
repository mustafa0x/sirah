# Asset attribution

## Thawr cave

`art/thawr/trellis/model-web.glb` is a transformed TRELLIS-generated cave. It is **CC BY-SA 4.0**, not CC0. Preserve the [model license and upstream attribution](art/thawr/trellis/MODEL-LICENSE.md) and [generation provenance](art/thawr/trellis/provenance.json).

## Terrain

`src/assets/terrain/*.grid.json` contains resampled heights from the [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) Terrarium dataset, produced by Mapzen/Tilezen. Heights were converted from encoded elevation pixels into compact local grids; they are a visualization aid, not historical evidence.

Global ETOPO1 terrain data courtesy of the U.S. National Oceanic and Atmospheric Administration. Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.

Provider terms and attribution: [Tilezen attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md), [data sources](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md).

## Other shipped assets

The journey's geometric landmarks are authored in `src/lib/`. Brand images, the About poster, and narration clips are app assets under `src/assets/`. Third-party JavaScript packages retain their own licenses in their distributions.

Source passages retain their original attributions and evidence links; their inclusion is not a blanket license for all source editions. Original project material is subject to the copyright reservation in [LICENSE](LICENSE). That reservation does not override third-party licenses or public-domain status, including the cave model's CC BY-SA 4.0 permissions and applicable share-alike obligations.
