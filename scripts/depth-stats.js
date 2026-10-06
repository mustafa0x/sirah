// What lies beneath the home page, counted from the content itself at build time, so the
// figures stay true as readings are added: readings, unique source passages, the books they
// come from (listed, with their unique passages, for "Behind the journey"), practice questions
// and interface languages.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function depth_stats(root) {
    const read_text = (file) => readFileSync(path.join(root, file), 'utf8')
    const read = (file) => JSON.parse(read_text(file))
    // English book names by Turath id, from content/books.md ("## <id>" then the name).
    const names = new Map(
        [...read_text('content/books.md').matchAll(/^## (\d+)\n(.+)$/gm)].map((m) => [m[1], m[2]]),
    )
    const index = read('src/content/chapters/index.json')
    const passages = new Set()
    const books = new Map()
    const questions = new Set()
    for (const item of index) {
        const chapter = read(`src/content/chapters/${item.chapter_id}.en.json`)
        for (const unit of chapter.source_units ?? []) {
            const text = unit.text_ar.trim()
            passages.add(text)
            const id = String(unit.book_id ?? unit.source_url?.match(/\/book\/(\d+)/)?.[1] ?? '')
            if (!id) continue
            if (!books.has(id)) books.set(id, { title_ar: unit.book_ar, passages: new Set() })
            books.get(id).passages.add(text)
        }
        for (const question of chapter.questions ?? []) questions.add(question.question_id)
    }
    return {
        readings: index.length,
        passages: passages.size,
        books: books.size,
        book_list: [...books]
            .map(([id, { title_ar, passages }]) => ({
                id,
                title_ar,
                title_en: names.get(id) ?? title_ar,
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
            resolved === `\0${id}` ? `export default ${JSON.stringify(depth_stats(root))}` : null,
    }
}
