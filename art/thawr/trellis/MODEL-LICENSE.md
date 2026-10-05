# TRELLIS.2 cave · attribution and modifications

Reference photograph: [King Eliot, “Jabl e Thawr”](https://commons.wikimedia.org/wiki/File:Jabl_e_Thawr.jpg), dated 2016-01-31, declared [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

This trial reuses the approved artistic image at the asset audition's `spikes/thawr-v2/reference-input-v2.png`; it does not upload the user's watermarked photograph. The approved image was generated using the Commons photograph as a reference, omitting modern surroundings and proposing an isolated rock formation, new silhouette, opening and surface details. It is not an exact photographic reproduction or a measured historical reconstruction.

Further modifications on 2026-10-04: the official Microsoft Hugging Face demo automatically resized, background-masked and cropped that image; TRELLIS.2 inferred a textured 3D object from it. The hidden rear, underside, fissures and opening geometry are generated proposals. GLB extraction requested about 100,000 faces and 2048px textures; local optimization halved triangles, quantized/compressed geometry with Meshopt and resized textures to 1024px WebP. The audition viewer fits the mesh into nominal units, grounds it and uses neutral inspection lighting. Main-app integration on 2026-10-05 rotates the aperture towards north, fits the formation to an illustrative nine-metre footprint and lightly embeds its base in authored terrain. Those are presentation transforms, not site measurements.

The reference adaptation and derived cave asset are conservatively released under **CC BY-SA 4.0**, preserving attribution, modification notice and applicable share-alike obligations. No endorsement by King Eliot, Wikimedia, Microsoft or Hugging Face is implied. Do not relabel this asset CC0.

[Microsoft's model and code are MIT-licensed](https://github.com/microsoft/TRELLIS.2#%EF%B8%8F-license); that does not remove the source photograph's obligations or independently settle hosted-service/dependency terms. This notice is not legal clearance.
