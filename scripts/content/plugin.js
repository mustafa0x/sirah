// Rebuilds the generated content (src/content/text.generated.js and the chapters) when
// content/ changes. The compilers run as separate processes, so the Vite config does not
// depend on what they import or write: regenerating never restarts the dev server, and every
// build reads the content fresh.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const content_dir = path.join(root, 'content')

// Runs one compiler; returns its error lines (empty when it succeeds).
function run(script) {
    const done = spawnSync(process.execPath, [path.join(root, 'scripts/content', script)], {
        cwd: root,
        encoding: 'utf8',
    })
    if (done.status === 0) return []
    return `${done.stderr}${done.stdout}`.split('\n').filter((line) => line.trim())
}

export function content_plugin() {
    const report = (errors) => {
        for (const error of errors) console.error(`[content] ${error}`)
    }
    let serving = false
    return {
        name: 'content',
        configResolved(config) {
            serving = config.command === 'serve'
        },
        buildStart() {
            const errors = [...run('compile.js'), ...run('chapters.js')]
            if (!errors.length) return
            report(errors)
            // A production build stops; the dev server keeps running with the last good output.
            if (!serving) this.error(`${errors.length} content errors`)
        },
        configureServer(server) {
            server.watcher.add(content_dir)
            const rebuild = (file) => {
                if (!file.startsWith(content_dir) || !file.endsWith('.md')) return
                report(
                    file.includes(`${path.sep}chapters${path.sep}`)
                        ? run('chapters.js')
                        : run('compile.js'),
                )
            }
            for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, rebuild)
        },
    }
}
