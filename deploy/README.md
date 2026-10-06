# Deployment

This deployment targets `https://sirah.nuqayah.com` with Caddy and a Python service. `DEPLOY_HOST` selects the SSH host (default: the local alias `labs`).

```sh
mise run deploy:setup
mise run deploy
# Only when intentionally deploying uncommitted changes:
node deploy.js all --allow-dirty
```

Setup requires the existing `web` account, passwordless service/install privileges, `/srv/conf/Caddyfile`, and Mise. It refuses to overwrite an existing site or environment. Configure proxied DNS and an origin certificate matching your Cloudflare TLS mode separately.

Setup prints a generated Basic Auth password once, unless `SIRAH_AUTH_PASSWORD` is supplied. Store it outside Git. Basic Auth remains enabled for pages, static assets, and API requests.

## Environment

`/srv/apps/sirah/.mise.local.toml` is server-only, root-owned, group `web`, mode `0640`. Configure the OpenAI and Turnstile secrets there; see `.env.example` for names. The service listens on loopback port `8075`. Do not commit or upload local credential files.

## Releases

Deployment builds and checks the app, uploads an explicit file allowlist, verifies checksums, installs frozen API dependencies, checks the configured provider without a paid request, and seals the release root-owned.

- `incoming/<release>/`: upload workspace.
- `releases/<release>/`: static build, backend, dependencies, and release metadata.
- `current`: atomically replaced release link.
- `shared/deploy.lock`: serializes activation.

A failed health check leaves the new `current` link in place and fails the command. There is no rollback path. Authentication is never disabled. Archives, research tooling, Git metadata, and local credentials are not uploaded.

## Verify

Unauthenticated requests should return 401. With Basic Auth, verify the journey and `/api/health`; invalid guide challenge tokens must return 403.

```sh
ssh "${DEPLOY_HOST:-labs}" 'systemctl status sirah-api.service --no-pager'
```
