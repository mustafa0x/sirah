// Compiles content/chapters/NN-name.md (the English chapter stories, the foundation of the
// content) into src/content/chapters/<chapter_id>.en.json in the shape the chapter reader
// reads, plus src/content/chapters/index.json. Each footnote becomes a numbered source entry
// whose passages are resolved through the passage registry; markers stay where they are in
// the text. See docs/CHAPTER_SPEC.md.
//
//   node scripts/content/chapters.js          write the generated files
//   node scripts/content/chapters.js --check  fail if they are out of date or a chapter is invalid
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chapter as journey } from '../../src/content/first-chapter.js'
import { add_journey_passages, resolve, unit } from './passages.js'

const root = path.resolve(import.meta.dirname, '../..')
const source_dir = path.join(root, 'content/chapters')
const output_dir = path.join(root, 'src/content/chapters')

add_journey_passages(journey.sources)

// English translations of passages already made for the earlier chapter editions, by passage.
const translations = new Map()
{
    const editions = path.join(root, 'src/content/hijrah-chapters')
    for (const dir of readdirSync(editions, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue
        let edition
        try {
            edition = JSON.parse(
                readFileSync(path.join(editions, dir.name, 'chapter.en.json'), 'utf8'),
            )
        } catch {
            continue
        }
        for (const item of edition.units ?? []) {
            const match = /^(.+:p\d+):text_ar$/.exec(item.unit_id)
            if (match && item.text?.trim()) translations.set(match[1], item.text)
        }
    }
}

const plain = (text) =>
    text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()

// "text with[^3] markers[^4][^5]" -> { text, marks: [{ at, label }] }
function marked(text) {
    const marks = []
    let out = ''
    let last = 0
    for (const match of text.matchAll(/\[\^([\w-]+)\]/g)) {
        out += text.slice(last, match.index)
        marks.push({ at: out.length, label: match[1] })
        last = match.index + match[0].length
    }
    out += text.slice(last)
    return { text: plain(out), marks }
}

export function compile_chapter(file) {
    const errors = []
    const at = (line, message) => errors.push(`${path.relative(root, file)}:${line}: ${message}`)
    const lines = readFileSync(file, 'utf8').split('\n')
    const doc = {
        title: null,
        fields: {},
        question: null,
        overview: [],
        account: [],
        outline: [],
        in_depth: [],
        notes: new Map(),
        prefix: '',
        readings_table: [],
    }
    let part = 'head' // head | overview | account | outline | in_depth | notes | readings | other
    let section = null
    let buffer = []
    const flush = () => {
        if (!buffer.length) return
        const text = buffer.join(buffer[0].startsWith('>') ? '\n' : ' ').replace(/^> ?/gm, '')
        buffer = []
        if (part === 'overview') doc.overview.push(text)
        else if ((part === 'account' || part === 'in_depth') && section)
            section.paragraphs.push(text)
    }
    lines.forEach((raw, index) => {
        const line = raw.trimEnd()
        const n = index + 1
        if (/^# /.test(line)) {
            doc.title = line.slice(2).trim()
            return
        }
        if (/^## /.test(line)) {
            flush()
            const name = line.slice(3).trim()
            section = null
            if (name === 'Overview') part = 'overview'
            else if (name === 'Outline') part = 'outline'
            else if (name === 'In depth') part = 'in_depth'
            else if (name === 'Notes') part = 'notes'
            else if (name === 'Readings') part = 'readings'
            else if (name === 'For the reviewer') part = 'other'
            else if (part === 'head' || part === 'overview' || part === 'account') {
                part = 'account'
                section = { title: name, paragraphs: [] }
                doc.account.push(section)
            } else at(n, `unexpected section "${name}"`)
            return
        }
        if (/^### /.test(line)) {
            flush()
            if (part !== 'in_depth') return at(n, '"###" only belongs in In depth')
            section = { title: line.slice(4).trim(), paragraphs: [] }
            doc.in_depth.push(section)
            return
        }
        if (part === 'head') {
            const field = /^([a-z_]+):\s*(.+)$/.exec(line)
            if (field) doc.fields[field[1]] = field[2].trim()
            const question = /^\*\*Question:\*\*\s*(.+)$/.exec(line)
            if (question) doc.question = question[1].trim()
            return
        }
        if (part === 'notes') {
            const note = /^\[\^([\w-]+)\]:\s*(.+)$/.exec(line)
            if (note) doc.notes.set(note[1], { line: n, text: note[2] })
            const prefix = /omit the prefix `([^`]+)`/.exec(line)
            if (prefix) doc.prefix = prefix[1]
            return
        }
        if (part === 'readings') {
            if (/^\|/.test(line) && !/^\|\s*-/.test(line)) doc.readings_table.push(line)
            return
        }
        if (part === 'outline') {
            const point = /^\d+\.\s+(.+)$/.exec(line)
            if (point) doc.outline.push(point[1].trim())
            return
        }
        if (part === 'other') return
        if (!line.trim() || line.trim() === '---') return flush()
        if (line.startsWith('>') !== (buffer[0]?.startsWith('>') ?? line.startsWith('>'))) flush()
        buffer.push(line.trim())
    })
    flush()

    const chapter_id = doc.fields.chapter
    if (!chapter_id) at(1, 'missing "chapter:"')
    if (!doc.title) at(1, 'missing "# Title"')
    if (!doc.question) at(1, 'missing "**Question:**"')
    if (!doc.account.length) at(1, 'no account sections')

    // Footnotes, numbered by first appearance in the text.
    const order = []
    const number = (label) => {
        if (!order.includes(label)) order.push(label)
        return order.indexOf(label) + 1
    }
    const block = (text, id) => {
        const { text: clean, marks } = marked(text)
        for (const mark of marks)
            if (!doc.notes.has(mark.label)) at(1, `footnote [^${mark.label}] is not defined`)
        return {
            paragraph_id: id,
            text: clean,
            marks: marks.map((mark) => ({ at: mark.at, note: number(mark.label) })),
        }
    }
    const overview = doc.overview.map((text, i) => block(text, `${chapter_id}_o${i + 1}`))
    const account = doc.account.map((s, i) => ({
        section_id: `${chapter_id}_s${i + 1}`,
        title: s.title,
        paragraphs: s.paragraphs.map((text, j) => block(text, `${chapter_id}_s${i + 1}_${j + 1}`)),
    }))
    const in_depth = doc.in_depth.map((s, i) => ({
        section_id: `${chapter_id}_d${i + 1}`,
        title: s.title,
        paragraphs: s.paragraphs.map((text, j) => block(text, `${chapter_id}_d${i + 1}_${j + 1}`)),
    }))

    // Outline points link to the account section they share the most words with.
    const words = (text) => new Set(text.toLowerCase().match(/[a-z‘’']{4,}/g) ?? [])
    const outline = doc.outline.map((text, i) => {
        const point = words(text)
        let best = account[0]
        let score = -1
        for (const s of account) {
            const pool = words(`${s.title} ${s.paragraphs.map((p) => p.text).join(' ')}`)
            const hits = [...point].filter((w) => pool.has(w)).length
            if (hits > score) [best, score] = [s, hits]
        }
        return {
            point_id: `${chapter_id}_pt${i + 1}`,
            text: plain(text),
            section_id: best?.section_id,
        }
    })

    // Strength from the Readings table, when it has a Strength column.
    const strength = new Map()
    const header = doc.readings_table[0]?.split('|').map((cell) => cell.trim().toLowerCase())
    const strength_column = header?.indexOf('strength') ?? -1
    if (strength_column > 0)
        for (const row of doc.readings_table.slice(1)) {
            const cells = row.split('|').map((cell) => cell.trim())
            const value = /^(weak|single|sound)\b/i.exec(cells[strength_column] ?? '')?.[1]
            if (!value) continue
            let previous = null
            for (const token of [...(cells[2] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1])) {
                const ref = resolve(token, doc.prefix, previous)
                if (!ref) continue
                previous = ref.packet_id
                for (const id of ref.part_ids)
                    strength.set(`${ref.packet_id}:${id}`, value.toLowerCase())
            }
        }

    // One source entry per footnote, in reading order.
    const units = new Map()
    const readings = order.map((label, index) => {
        const note = doc.notes.get(label)
        if (!note) return null
        const refs = []
        let previous = null
        for (const group of note.text.matchAll(/`([^`]+)`/g))
            for (const token of group[1].split(/,\s*/)) {
                const ref = resolve(token, doc.prefix, previous)
                if (!ref) {
                    if (/:p\d|^H-|^E\d+$|^p\d/.test(token.trim()))
                        at(note.line, `passage "${token.trim()}" not found`)
                    continue
                }
                previous = ref.packet_id
                refs.push(ref)
                for (const id of ref.part_ids)
                    units.set(`${ref.packet_id}:${id}`, unit(ref.packet_id, id))
            }
        const title = plain(note.text.split(/\s*\[Turath\]/)[0].replace(/\s*·.*$/, ''))
        const translated = refs.every((ref) =>
            ref.part_ids.every((id) => translations.has(`${ref.packet_id}:${id}`)),
        )
        const levels = refs.flatMap((ref) =>
            ref.part_ids.map((id) => strength.get(`${ref.packet_id}:${id}`)),
        )
        return {
            reading_id: `${chapter_id}_n${index + 1}`,
            number: index + 1,
            title,
            mode: translated && refs.length ? 'translated' : 'original',
            strength: levels.includes('weak')
                ? 'weak'
                : levels.includes('single')
                  ? 'single'
                  : null,
            source_refs: refs,
        }
    })
    for (const label of doc.notes.keys())
        if (!order.includes(label))
            at(doc.notes.get(label).line, `footnote [^${label}] is never used`)

    const questions_file = file.replace(/\.md$/, '.questions.json')
    let questions = []
    try {
        questions = JSON.parse(readFileSync(questions_file, 'utf8'))
    } catch {}

    return {
        errors,
        chapter: {
            chapter_id,
            locale: 'en',
            status: 'story',
            packet_id: `${chapter_id}:en:story`,
            stage: doc.fields.stage ?? null,
            title: doc.title,
            reader_question: doc.question,
            overview,
            account,
            outline,
            in_depth,
            readings: readings.filter(Boolean),
            source_units: [...units.values()]
                .filter(Boolean)
                .map((item) => ({ ...item, text: translations.get(item.unit_id) ?? null })),
            footnotes: [],
            objectives: [],
            open_issues: [],
            deferred_questions: [],
            questions,
        },
    }
}

export function compile_chapters() {
    const errors = []
    const chapters = []
    for (const name of readdirSync(source_dir)
        .filter((n) => /^\d+-[\w-]+\.md$/.test(n))
        .sort()) {
        const result = compile_chapter(path.join(source_dir, name))
        errors.push(...result.errors)
        chapters.push({ number: parseInt(name), file: name, ...result.chapter })
    }
    return { errors, chapters }
}

// Through the project's formatter, so the generated files pass the format check.
function formatted(files) {
    const dir = mkdtempSync(path.join(tmpdir(), 'chapters-'))
    for (const [name, text] of files) writeFileSync(path.join(dir, name), text)
    execFileSync(path.join(root, 'node_modules/.bin/oxfmt'), [
        '-c',
        path.join(root, '.oxfmtrc.json'),
        ...[...files.keys()].map((name) => path.join(dir, name)),
    ])
    return new Map(
        [...files.keys()].map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]),
    )
}

export function build_chapters({ check = false } = {}) {
    let compiled
    try {
        compiled = compile_chapters()
    } catch (error) {
        return [`chapters could not be read: ${error.message}`]
    }
    const { errors, chapters } = compiled
    if (errors.length) return errors
    const files = new Map()
    for (const { number, file, ...chapter } of chapters)
        files.set(`${chapter.chapter_id}.en.json`, JSON.stringify(chapter))
    files.set(
        'index.json',
        JSON.stringify(
            chapters.map(({ number, chapter_id, stage, title, reader_question }) => ({
                number,
                chapter_id,
                stage,
                title,
                reader_question,
            })),
            null,
            1,
        ),
    )
    const output = formatted(files)
    const stale = []
    for (const [name, text] of files) {
        let current = ''
        try {
            current = readFileSync(path.join(output_dir, name), 'utf8')
        } catch {}
        if (current !== output.get(name)) stale.push(name)
    }
    if (check)
        return stale.length
            ? [
                  `src/content/chapters is out of date (${stale.join(', ')}): run node scripts/content/chapters.js`,
              ]
            : []
    mkdirSync(output_dir, { recursive: true })
    for (const name of stale) writeFileSync(path.join(output_dir, name), output.get(name))
    return []
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const errors = build_chapters({ check: process.argv.includes('--check') })
    for (const error of errors) console.error(error)
    if (errors.length) process.exit(1)
}
