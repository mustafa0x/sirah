# Sirah Journey

The root app is a learner journey through selected stages of the Hijrah: preparations, Thawr, the onward journey, and arrival. It supports scene and readable presentation, model-led Turath research, source inspection, detour/resume, and recap. Content review status is recorded in metadata and documentation; no narration is shipped.

## Run locally

Pins are in `mise.toml`.

```sh
mise exec -- pnpm install --frozen-lockfile
# terminal 1: server boundary (required for Turath/guide API; local guide fallback keeps UI usable)
mise exec -- pnpm run dev:api
# terminal 2:
mise exec -- pnpm run dev
```

Open `http://127.0.0.1:5100/`. Set `VITE_PORT` to use another dev port; the server fails if that port is occupied. The Vite dev server proxies `/api/*` to `127.0.0.1:8000`.

With Caddy running and its local CA trusted (`caddy trust`), `vite-plugin-domain` also maps `https://sirahviz.localhost` to the dev server. Direct localhost access works without Caddy. The Svelte inspector is enabled for click-to-source debugging.

The API boundary is server-only. The hackathon build defaults to the small working allowlist `930,13606,9820`; deployments can override it explicitly:

```sh
TURATH_BOOK_ALLOWLIST=930,13606,9820 mise exec -- pnpm run dev:api
```

`cat_id=24` and the book allowlist apply to the legacy REST `/api/turath/*` endpoints, not Ask's MCP research. An explicitly empty allowlist denies direct REST book/page retrieval. `TURATH_BASE_URL`, `TURATH_CLIENT`, `API_HOST`, and `API_PORT` can be set for a deployment. Credentials never enter browser code.

## Model-backed Ask

Set `OPENAI_API_KEY` in the server environment (or ignored `.mise.local.toml`), then restart the API. The guide defaults to `gpt-5-mini`; `GUIDE_MODEL` overrides a shared `OPENAI_MODEL` setting. Use `GUIDE_MODEL=gpt-5-mini` when other apps use a smaller model. `OPENAI_BASE_URL` optionally selects an OpenAI-compatible Responses endpoint. `MCP_URL` defaults to `https://api.turath.ai/mcp`, with optional server-only `MCP_TOKEN`.

`guide.py` discovers `turath_find` and `turath_open` from the live server. The model chooses books, Arabic search terms, filters, and refinements without a chapter-book or category ceiling. The lesson snapshot (`guide_context.json`, generated from `src/content/first-chapter.js`) supplies context, not an evidence whitelist. The chapter's twelve cached source excerpts are usable evidence for facts they explicitly contain; lesson prose is not. Further claims require MCP research and opened passages. Source metadata and links come from the server-owned packet or opened MCP results, never model-authored bibliography. The interface displays the actual cited passages and links.

Requests have isolated research sessions, at most ten tool calls, a 90-second deadline, no SDK retries, bounded result sizes, and three concurrent research slots. Missing keys, outages, timeouts, or invalid responses use explicitly labelled offline chapter notes. Citation validation checks provenance, not semantic entailment; factual accuracy, relevance, disagreement handling, and source quality still need live evaluation.

Questions, a maximum of two recent Q&A pairs held in browser memory, lesson context, and retrieved passages are sent to OpenAI (or the configured compatible service). Turath receives model-selected research arguments. OpenAI requests use `store=False`; this is not a guarantee about provider retention. This app stores no chats and logs no question/source text. Before public deployment, configure provider spend limits and reverse-proxy abuse/rate controls.

For development-case evaluation (no holdout loaded):

```sh
mise exec -- uv run python -m scripts.evaluate_guide --ids G01,G02,G09,G15,G20 --output /tmp/sirah-guide-development.json
```

This makes real model calls and costs API usage. It records answers and citation provenance for human review; it does not claim a semantic accuracy score or learner benefit.

## Checks

```sh
mise exec -- pnpm run format
mise exec -- pnpm run format:check
mise exec -- pnpm run test
mise exec -- pnpm run build
```

The tests cover journey freshness/detours/media tickets, legacy Turath REST boundaries, model/tool-loop orchestration with fake clients, source provenance and action validation, multilingual API requests, and offline failure behavior. `pnpm guide:context` refreshes the server lesson snapshot; builds refresh it and tests reject a stale snapshot. Restart the API after content changes so it loads the new packet. Fake-client tests are not a live-model evaluation. A browser smoke should exercise Ask → answer → opened source → back to answer → chapter detour → resume, plus a labelled offline answer.

## Localization

English is the source language. `locales.config.json` is the shared manifest for extraction, the header selector, direction, and API language validation. The app supports 20 languages, matching Turath’s original set: English, Arabic, Urdu, Persian, Indonesian, Turkish, Hindi, Bengali, Somali, Malay, German, Amharic, French, Dutch, Hausa, Pashto, Sinhala, Tamil, Swahili, and Thai. Wuchale extracts Svelte interface text and JavaScript chapter, map-label, and guide-answer text into `src/locales/{code}.po`. Arabic source quotations remain untouched. The selector saves the preference locally and reloads the app; changing languages restarts the journey. Catalogs load before chapter modules are evaluated. Arabic, Urdu, Persian, and Pashto use RTL text layout while the geographic scene retains its orientation.

After editing copy, run `pnpm i18n:extract`, fill new translations in every catalog, and run `pnpm test && pnpm build`. Automatic AI translation is disabled during extraction so it does not make unexpected paid requests. Tests enforce catalog completeness and placeholder parity across all 20 languages. Commit the catalogs and generated loaders, but not `src/locales/.wuchale/`. All supported languages use the same model-backed endpoint; the model answers in the question’s language, with interface language as a fallback. Offline notes and suggested questions are translated by Wuchale; free-form offline matching remains limited to English and Arabic. The additional 18 catalogs are machine-translated drafts; all wording, like the English and Arabic drafts, still requires native-language and scholarly/editorial review.

## Content and evidence boundaries

The app-owned contract is `src/content/first-chapter.js`. It is one chapter only. Its draft paragraphs map to the research records in `docs/SOURCES.md`; source panels preserve excerpts, attribution, limits, and working Turath `book_id`/`page_id` citations. The scene is an illustration, not a historical reconstruction. See `docs/SOURCES.md`, `docs/evaluation.md`, and `docs/todo/first-playable-sirah-journey.md` for hackathon gates and post-hackathon gaps.

Experiments remain under `spikes/` and are not runtime dependencies. Evaluation material is not imported into the app or API.
