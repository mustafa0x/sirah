// What lies beneath the home page, counted from the content itself at build time, so the
// figures stay true as readings are added: readings, unique source passages, the books they
// come from (listed, with their unique passages, for "Behind the journey"), practice questions
// and interface languages.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function depth_stats(root) {
    const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'))
    const base = 'src/content/hijrah-chapters'
    const catalog = read(`${base}/catalog.ar.json`)
    const titles_en = read('src/content/source-books.json')
    const passages = new Set()
    const books = new Map()
    const questions = new Set()
    for (const item of catalog.chapters) {
        const chapter = read(`${base}/${item.path}`)
        for (const unit of chapter.source_units ?? []) {
            passages.add(unit.text_ar.trim())
            if (!books.has(unit.book_ar))
                books.set(unit.book_ar, {
                    id: unit.source_url.match(/\/book\/(\d+)/)[1],
                    passages: new Set(),
                })
            books.get(unit.book_ar).passages.add(unit.text_ar.trim())
        }
        for (const question of chapter.questions ?? []) questions.add(question.question_id)
    }
    return {
        readings: catalog.chapters.length,
        passages: passages.size,
        books: books.size,
        book_list: [...books]
            .map(([title_ar, { id, passages }]) => ({
                id,
                title_ar,
                title_en: titles_en[id],
                url: `https://app.turath.io/book/${id}`,
                passages: passages.size,
            }))
            .sort((a, b) => b.passages - a.passages || a.title_en.localeCompare(b.title_en)),
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
