# Sirah Journey

An interactive account of the Hijrah with twelve chapters, Arabic source passages, multilingual reading, narrated stages, a 3D journey map, practice questions, and a source-grounded guide.

## Run

Install [Mise](https://mise.jdx.dev/), then:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- uv sync --frozen
mise run dev:all
```

Open `http://127.0.0.1:5100/`; the API listens on `127.0.0.1:8027`. With Caddy running and its local CA trusted, the domain plugin also provides HTTPS at `https://<checkout-folder>.localhost`.

## Build

```sh
mise exec -- pnpm build
mise exec -- pnpm check
```

The build compiles authored Markdown into app data and bundles the frontend into `dist/`.

- `content/chapters/`: English and Arabic chapters and their questions.
- `content/narrative*.md`, `content/journey/`: narrated stages and supporting prose.
- `content/passages/`: literal source registries used by the compiler.
- `content/practice/`: practice packets, translations, and byte-bound validation records.
- `src/`: Svelte interface, scene, app data, locale catalogs, and shipped assets.
- `api.py`, `guide.py`: guide API and providers.

Source identities, citations, and validation bindings are preserved in the content data. Asset attribution and licenses are in [ASSETS.md](ASSETS.md).

## Guide and deployment

Copy `.env.example` values into your local environment or an ignored `.mise.local.toml`. Without an OpenAI key the guide uses its local provider. Every guide request requires a valid Cloudflare Turnstile token for the configured hostname and `guide` action.

See [deploy/README.md](deploy/README.md). Local credentials and `.private-archive/` are never included in deployment releases.

## Copyright

Copyright © 2026 Mustafa Jibaly (Nuqayah). **All rights reserved** for original project material. Third-party, separately licensed, and public-domain materials are excepted, including the CC BY-SA 4.0 cave model and covered adaptations. See [LICENSE](LICENSE) and [ASSETS.md](ASSETS.md).
