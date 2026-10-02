# Sirah Journey

The root app is the first playable, deliberately draft learner journey: a selected account of the Hijrah from preparations through Thawr, the onward journey, and arrival. It supports scene and readable presentation, a bounded question, source inspection, detour/resume, and recap. Historical wording, source selection, and the procedural illustration are visibly marked as draft pending review; no narration is shipped.

## Run locally

Pins are in `mise.toml`.

```sh
mise exec -- pnpm install --frozen-lockfile
# terminal 1: server boundary (required for Turath/guide API; local guide fallback keeps UI usable)
mise exec -- pnpm run dev:api
# terminal 2:
mise exec -- pnpm run dev
```

Open `http://127.0.0.1:5100/`. The Vite dev server proxies `/api/*` to `127.0.0.1:8000`.

The API boundary is server-only. The hackathon build defaults to the small working allowlist `930,13606,9820`; deployments can override it explicitly:

```sh
TURATH_BOOK_ALLOWLIST=930,13606,9820 mise exec -- pnpm run dev:api
```

`cat_id=24` is fixed in `api.py`; an explicitly empty allowlist permits no direct book or page retrieval. `TURATH_BASE_URL`, `TURATH_CLIENT`, `API_HOST`, and `API_PORT` can be set for a deployment. Turath credentials/headers never enter browser code. The deterministic local guide provider is the intentional hackathon choice; an external provider is optional follow-up work.

## Checks

```sh
mise exec -- pnpm run format
mise exec -- pnpm run format:check
mise exec -- pnpm run test
mise exec -- pnpm run build
```

The focused tests cover journey freshness/detours/media tickets and the Turath boundary’s category enforcement, allowlist, validation, malformed responses, and bounded guide response. A browser smoke should exercise: Start guided journey → Three nights at Thawr → Ask about this → Answer from this chapter → View E07 → Show the onward journey → Resume journey.

## Localization

English is the source language. Wuchale extracts Svelte interface text and JavaScript chapter, map-label, and guide-answer text into `src/locales/en.po` and `src/locales/ar.po`. Arabic source quotations remain untouched. The header language selector saves the preference locally and reloads the app; changing languages restarts the journey. Catalogs load before chapter modules are evaluated, and Arabic uses RTL text layout while the geographic scene retains its orientation.

After editing copy, run `pnpm i18n:extract`, fill new Arabic translations in `src/locales/ar.po`, and run `pnpm test && pnpm build`. Commit the catalogs and generated loaders, but not `src/locales/.wuchale/`. Arabic guide questions use the translated, source-bounded local provider because the demo API currently returns English only. Arabic wording, like the English draft, still requires scholarly/editorial review.

## Content and evidence boundaries

The app-owned contract is `src/content/first-chapter.js`. It is one chapter only. Its draft paragraphs map to the research records in `docs/SOURCES.md`; source panels preserve excerpts, attribution, limits, and working Turath `book_id`/`page_id` citations. The scene is an illustration, not a historical reconstruction. See `docs/SOURCES.md`, `docs/evaluation.md`, and `docs/todo/first-playable-sirah-journey.md` for hackathon gates and post-hackathon gaps.

Experiments remain under `spikes/` and are not runtime dependencies. Evaluation material is not imported into the app or API.
