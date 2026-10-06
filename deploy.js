#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { cpSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('.', import.meta.url)))
const host = process.env.DEPLOY_HOST || 'labs'
const action = process.argv[2] || 'all'
const app_root = '/srv/apps/sirah'
if (!/^[A-Za-z0-9][A-Za-z0-9_.@-]*$/.test(host)) throw new Error('Invalid DEPLOY_HOST')
if (!['setup', 'all', 'rollback'].includes(action)) throw new Error('Use setup, all, or rollback')
if (process.argv.slice(3).some((arg) => arg !== '--allow-dirty')) throw new Error('Unknown deployment option')

function run(command, args, input) {
    execFileSync(command, args, { stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'], input })
}
function remote(script) {
    run('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', host, 'bash -se'], 'set -euo pipefail\n' + script)
}
function upload(content, destination, owner, mode) {
    run('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', host,
        `sudo -n install -o root -g ${owner} -m ${mode} /dev/stdin ${destination}`], content)
}

if (action === 'setup') {
    remote(`
test "$(id -un)" = web
test ! -e /srv/conf/sirah.caddy
test ! -e ${app_root}/.mise.local.toml
sudo -n install -d -m 0755 -o root -g root ${app_root} ${app_root}/releases ${app_root}/shared
sudo -n install -d -m 0700 -o "$(id -un)" -g "$(id -gn)" ${app_root}/incoming
sudo -n touch ${app_root}/shared/deploy.lock
sudo -n chown root:"$(id -gn)" ${app_root}/shared/deploy.lock
sudo -n chmod 0660 ${app_root}/shared/deploy.lock
`)
    const password = process.env.SIRAH_AUTH_PASSWORD || randomBytes(24).toString('base64url')
    const hash = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', host,
        'caddy hash-password --algorithm argon2id'], { input: password + '\n', encoding: 'utf8' }).trim()
    if (!process.env.SIRAH_AUTH_PASSWORD) console.log('Basic Auth username: sirah\nPassword: ' + password)
    upload(readFileSync('deploy/api.mise.toml', 'utf8'), app_root + '/.mise.local.toml', 'web', '0640')
    upload(readFileSync('deploy/sirah-api.service', 'utf8'), '/etc/systemd/system/sirah-api.service', 'root', '0644')
    upload(readFileSync('deploy/sirah.caddy', 'utf8').replace('HASH_PLACEHOLDER', hash), '/srv/conf/sirah.caddy', 'caddy', '0640')
    remote(`
mise trust ${app_root}/.mise.local.toml
sudo -n systemctl daemon-reload
sudo -n systemctl enable sirah-api.service
sudo -n caddy validate --config /srv/conf/Caddyfile --adapter caddyfile
sudo -n systemctl reload caddy
`)
    console.log('Setup complete; deploy all before adding proxied DNS.')
    process.exit(0)
}

const activation = `
exec 9>${app_root}/shared/deploy.lock
flock -n 9
previous=$(readlink ${app_root}/current || true)
rollback() {
    trap - ERR
    sudo -n rm -f ${app_root}/current.next ${app_root}/previous.next
    if [ -n "$previous" ]; then
        sudo -n ln -s "$previous" ${app_root}/current.next
        sudo -n mv -Tf ${app_root}/current.next ${app_root}/current
        sudo -n systemctl restart sirah-api.service
    else
        sudo -n rm -f ${app_root}/current
        sudo -n systemctl stop sirah-api.service
    fi
    echo 'Activation failed; restored previous current link.' >&2
}
activate() {
    test ! -e ${app_root}/current.next
    test ! -e ${app_root}/previous.next
    sudo -n ln -s "$1" ${app_root}/current.next
    sudo -n mv -Tf ${app_root}/current.next ${app_root}/current
    trap rollback ERR
    sudo -n systemctl restart sirah-api.service
    healthy=false
    for attempt in {1..30}; do
        if curl -fsS --max-time 2 http://127.0.0.1:8075/api/health >/dev/null; then
            healthy=true
            break
        fi
        sleep 1
    done
    test "$healthy" = true
    sudo -n systemctl is-active --quiet sirah-api.service
    if [ -n "$previous" ]; then
        sudo -n ln -s "$previous" ${app_root}/previous.next
        sudo -n mv -Tf ${app_root}/previous.next ${app_root}/previous
    fi
    trap - ERR
}
`

if (action === 'rollback') {
    remote(activation + `
target=$(readlink ${app_root}/previous)
case "$target" in ${app_root}/releases/*) ;; *) exit 1 ;; esac
test "$target" != "$previous"
test -x "$target/.venv/bin/python"
cd "$target"
sha256sum --quiet -c checksums.sha256
activate "$target"
echo "Rolled back to $target"
`)
    process.exit(0)
}

const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
if (dirty && !process.argv.includes('--allow-dirty')) throw new Error('Worktree is dirty; explicitly pass --allow-dirty to deploy this snapshot')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
run('mise', ['exec', '--', 'pnpm', 'run', 'build'])
// A nested mise invocation otherwise restores its old environment over the explicit test override.
run('mise', ['exec', '--', 'env', '-u', '__MISE_DIFF', 'pnpm', 'test'])
const release_id = new Date().toISOString().replace(/[^0-9]/g, '') + '-' + randomBytes(3).toString('hex')
const release_dir = app_root + '/releases/' + release_id
const incoming = app_root + '/incoming/' + release_id
const staging = mkdtempSync(path.join(tmpdir(), 'sirah-release-'))
try {
    for (const file of ['dist', 'api.py', 'guide.py', 'guide_context.json', 'locales.config.json', 'pyproject.toml', 'uv.lock'])
        cpSync(file, path.join(staging, file), { recursive: true })
    const config = readFileSync('mise.toml', 'utf8')
    const python_version = config.match(/^python = ['"]([^'"]+)['"]/m)[1]
    const uv_version = config.match(/^uv = ['"]([^'"]+)['"]/m)[1]
    writeFileSync(path.join(staging, 'mise.toml'), `[tools]
python = "${python_version}"
uv = "${uv_version}"

[tasks."api:prod"]
run = '.venv/bin/python api.py'
`)
    writeFileSync(path.join(staging, 'release.json'), JSON.stringify({ release_id, commit, dirty, built_at: new Date().toISOString() }, null, 2) + '\n')
    const checksums = []
    for (const file of readdirSync(staging, { recursive: true }).sort()) {
        const full_path = path.join(staging, file)
        const stat = lstatSync(full_path)
        if (stat.isDirectory()) continue
        if (!stat.isFile()) throw new Error('Release inputs must be regular files: ' + file)
        checksums.push(createHash('sha256').update(readFileSync(full_path)).digest('hex') + '  ' + file)
    }
    writeFileSync(path.join(staging, 'checksums.sha256'), checksums.join('\n') + '\n')
    remote(`test -f /srv/conf/sirah.caddy\ntest -f ${app_root}/.mise.local.toml\nmkdir -m 0700 '${incoming}'\n`)
    run('rsync', ['-az', '--', staging + '/', host + ':' + incoming + '/'])
    remote(activation + `
test ! -e '${release_dir}'
cd '${incoming}'
sha256sum --quiet -c checksums.sha256
sudo -n install -d -m 0755 -o "$(id -un)" -g "$(id -gn)" '${release_dir}'
cp -a . '${release_dir}/'
cd '${release_dir}'
mise trust mise.toml
mise install python uv
mise exec -- uv sync --frozen --no-dev --no-install-project
mise exec -- .venv/bin/python -c 'import api; assert isinstance(api.APIHandler.provider, api.LocalGuideProvider)'
sudo -n chown -hR root:root '${release_dir}'
sudo -n chmod -R a+rX,u+w,go-w '${release_dir}'
activate '${release_dir}'
echo 'Activated ${release_id}'
`)
    console.log('Deployed to https://sirah.nuqayah.com (Basic Auth unchanged)')
} finally {
    rmSync(staging, { recursive: true, force: true })
}
