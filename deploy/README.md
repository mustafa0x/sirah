# Private deployment

Target: `labs:/srv/apps/sirah`, served at `https://sirah.nuqayah.com`.

The deployment follows Fihrist's setup/deploy/rollback pattern, without its database-specific machinery. It preserves dirty working-tree changes rather than committing or discarding them.

## Commands

```sh
node deploy.js setup
node deploy.js all
# Explicitly deploy a working-tree snapshot:
node deploy.js all --allow-dirty
node deploy.js rollback
```

Equivalent Mise tasks: `mise run deploy:setup`, `mise run deploy`, and `mise run deploy:rollback`. `DEPLOY_HOST` defaults to `labs`.

Setup installs the environment and service, validates the complete Caddy configuration, and reloads Caddy. It refuses to overwrite an existing site or environment. It generates a Basic Auth password and prints it once, unless `SIRAH_AUTH_PASSWORD` is supplied. Password hashing uses stdin; the Caddy config contains only an Argon2id hash. Keep the password in a password manager, never in this repository.

Setup must finish successfully before creating DNS. Use the existing `../cf/cf_add_dns_record.js` with `--zone nuqayah.com --subdomain sirah --ip 65.108.157.120`. Omit `--dns-only`: the record is proxied. The zone uses Cloudflare Full SSL, matching the Caddy internal origin certificate; do not change this origin to Full (strict) without installing a publicly trusted or Cloudflare Origin CA certificate.

## Runtime and release layout

- `.mise.local.toml`: root-owned, mode 0640, server-only environment. The initial configuration explicitly clears `OPENAI_API_KEY` for offline Ask.
- `incoming/<release>/`: private upload workspace.
- `releases/<release>/`: checksummed build and API allowlist, frozen dependencies, and metadata recording the source commit and whether it was a dirty snapshot. Sealed root-owned after preparation.
- `current` / `previous`: atomically replaced, root-owned release links.
- `shared/deploy.lock`: serializes preparation and activation.
- `sirah-api.service`: enabled at boot, runs as `web`, listens only on `127.0.0.1:8075`.
- `/srv/conf/sirah.caddy`: authentication before every content handler, including static assets and API requests. Only `current/dist` is served.

Build/test failures prevent upload. Checksum, dependency, or import failures prevent activation. A failed service restart or health check restores the previous current link; successful deployments retain a rollback target. The first failed activation stops the API and removes its current link. Caddy and its authentication are never disabled during release changes.

Production pins for Python and uv come from the repository's `mise.toml`; no host-specific installation paths are embedded. No research directories, Git metadata, or local credentials are uploaded. Incoming workspaces and old releases are retained for inspection; cleanup is manual.

## Verification

Unauthenticated and incorrect-password requests to pages, deep links, assets, dotfiles, and API routes must return 401. Authenticated deep links load the SPA; missing assets and dotfiles return 404. Check `/api/health` and an offline `/api/guide` response. Responses use `Cache-Control: private, no-store`; verify Cloudflare does not return authenticated assets to an unauthenticated client.

```sh
ssh labs 'systemctl status sirah-api.service --no-pager'
ssh labs 'journalctl -u sirah-api.service -n 30 --no-pager'
```

TLS verification may be bypassed only for explicit origin checks against the internal certificate. Public checks through Cloudflare must verify TLS normally.
