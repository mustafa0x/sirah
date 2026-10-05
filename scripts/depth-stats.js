// What lies beneath the home page, counted from the content itself at build time, so the
// figures stay true as readings are added: readings, unique source passages, the books they
// come from, practice questions and interface languages.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function depth_stats(root) {
    const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'))
    const base = 'src/content/hijrah-chapters'
    const catalog = read(`${base}/catalog.ar.json`)
    const passages = new Set()
    const books = new Set()
    const questions = new Set()
    for (const item of catalog.chapters) {
        const chapter = read(`${base}/${item.path}`)
        for (const unit of chapter.source_units ?? []) {
            passages.add(unit.text_ar.trim())
            books.add(unit.book_ar)
        }
        for (const question of chapter.questions ?? []) questions.add(question.question_id)
    }
    return {
        readings: catalog.chapters.length,
        passages: passages.size,
        books: books.size,
        questions: questions.size,
        languages: read('locales.config.json').locales.length,
    }
}

// Serves the figures to the app as `virtual:depth-stats`.
export function depth_stats_plugin() {
    const id = 'virtual:depth-stats'
    let root = process.cwd()
    return {
        name: 'depth-stats',
        configResolved(config) {
            root = config.root
        },
        resolveId: (source) => (source === id ? `\0${id}` : null),
        load: (resolved) =>
            resolved === `\0${id}`
                ? `export default ${JSON.stringify(depth_stats(root))}`
                : null,
    }
}
