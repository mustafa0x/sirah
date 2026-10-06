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
import { glossary_terms } from '../../src/content/text.generated.js'
import { term_pattern } from '../../src/lib/terms.js'

const root = path.resolve(import.meta.dirname, '../..')
const source_dir = path.join(root, 'content/chapters')
const output_dir = path.join(root, 'src/content/chapters')

add_journey_passages(journey.sources)

// English translations of passages: those made for the earlier chapter editions, then those in
// content/passage-translations.en.json (scripts/translate-passages.js), by passage.
const translations = new Map()
try {
    for (const [id, text] of Object.entries(
        JSON.parse(readFileSync(path.join(root, 'content/passage-translations.en.json'), 'utf8')),
    ))
        translations.set(id, text)
} catch {}
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

// Markdown emphasis, code and links reduced to their text.
const unformat = (text) =>
    text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
const plain = (text) => unformat(text).trim()

// A citation where it stands in the text: [[passage ids | remark]], e.g.
// [[council:p1–p3, debate:p4 | Ibn ‘Abbas through Ibn Ishaq]], or [[| a remark only]].
const citation = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g

// The paragraph as pieces in reading order, [{ text }, { cite }, { text }, …], with formatting
// removed, and its plain text.
function marked(text) {
    const pieces = []
    let last = 0
    const source = text.trim()
    for (const match of source.matchAll(citation)) {
        if (match.index > last) pieces.push({ text: unformat(source.slice(last, match.index)) })
        pieces.push({
            cite: {
                tokens: match[1]
                    .split(',')
                    .map((token) => token.trim())
                    .filter(Boolean),
                remark: (match[2] ?? '').trim(),
            },
        })
        last = match.index + match[0].length
    }
    if (last < source.length) pieces.push({ text: unformat(source.slice(last)) })
    pieces[0] && 'text' in pieces[0] && (pieces[0].text = pieces[0].text.trimStart())
    return {
        text: pieces
            .map((piece) => piece.text ?? '')
            .join('')
            .trim(),
        pieces,
    }
}

// "## <id>" sections with one line or field each, for content/books.md and content/strength.md.
function sections(file) {
    const out = new Map()
    let id = null
    for (const line of readFileSync(path.join(root, file), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .split('\n')) {
        if (/^## /.test(line)) out.set((id = line.slice(3).trim()), { text: '', fields: {} })
        else if (id && line.trim()) {
            const field = /^([a-z_]+):\s*(.+)$/.exec(line)
            if (field) out.get(id).fields[field[1]] = field[2].trim()
            else out.get(id).text += (out.get(id).text ? ' ' : '') + line.trim()
        }
    }
    return out
}
export const books = new Map(
    [...sections('content/books.md')].map(([id, entry]) => [id, entry.text]),
)
export const weak = new Set()
for (const [id, entry] of sections('content/strength.md')) {
    if (entry.fields.strength !== 'weak') continue
    const ref = resolve(id)
    if (ref) for (const part of ref.part_ids) weak.add(`${ref.packet_id}:${part}`)
}

// "Ibn Hisham, al-Sirah al-Nabawiyyah, 1/480–482; Ibn Hajar, Fath al-Bari, 7/246"
const arabic_digits = (text) => text.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])

function source_title(units, locale = 'en') {
    const groups = []
    for (const item of units) {
        const name =
            locale === 'ar'
                ? (item.book_ar ?? '').replace(/\s+-\s+.*$/, '')
                : (books.get(String(item.book_id)) ?? item.book_ar ?? '')
        let group = groups.find((g) => g.name === name && g.volume === item.volume)
        if (!group) groups.push((group = { name, volume: item.volume, pages: [] }))
        if (item.page && !group.pages.includes(Number(item.page)))
            group.pages.push(Number(item.page))
    }
    return groups
        .map(({ name, volume, pages }) => {
            if (!pages.length) return name
            const low = Math.min(...pages)
            const high = Math.max(...pages)
            const span = low === high ? `${low}` : `${low}–${high}`
            const place = `${volume ? `${volume}/` : ''}${span}`
            return locale === 'ar' ? `${name}، ${arabic_digits(place)}` : `${name}, ${place}`
        })
        .join(locale === 'ar' ? '؛ ' : '; ')
}

// content/chapters/NN-name.questions.md: "## <question id>" with level:, scope:, answer: and
// sources: lines, the prompt, then "### <option id>" (text, then "> feedback") and "### why".
function compile_questions(file, chapter_id, errors) {
    let text
    try {
        text = readFileSync(file, 'utf8')
    } catch {
        return { questions: [], refs: [] }
    }
    const at = (line, message) => errors.push(`${path.relative(root, file)}:${line}: ${message}`)
    const questions = []
    const refs = []
    let question = null
    let option = null
    let buffer = []
    const flush = () => {
        if (!buffer.length || !question) return (buffer = [])
        const feedback = buffer[0].startsWith('>')
        const value = plain(buffer.map((line) => line.replace(/^> ?/, '')).join(' '))
        buffer = []
        if (option === 'why') question.explanation = value
        else if (option && feedback) question.options.at(-1).feedback = value
        else if (option) question.options.at(-1).text = value
        else question.prompt = value
    }
    text.replace(/<!--[\s\S]*?-->/g, '')
        .split('\n')
        .forEach((raw, index) => {
            const line = raw.trimEnd()
            const n = index + 1
            if (/^# /.test(line)) return
            if (/^## /.test(line)) {
                flush()
                option = null
                question = {
                    question_id: line.slice(3).trim(),
                    step_id: chapter_id,
                    difficulty: 'beginner',
                    practice_scope: 'lesson',
                    prompt: '',
                    options: [],
                    explanation: '',
                    scope_note: '',
                    source_unit_ids: [],
                    line: n,
                }
                questions.push(question)
                return
            }
            if (/^### /.test(line)) {
                flush()
                if (!question) return at(n, 'option outside a question')
                option = line.slice(4).trim()
                if (option !== 'why')
                    question.options.push({ option_id: option, text: '', feedback: '' })
                return
            }
            const field =
                !option && !buffer.length && /^(level|scope|answer|sources):\s*(.+)$/.exec(line)
            if (field && question) {
                if (field[1] === 'level') question.difficulty = field[2].trim()
                if (field[1] === 'scope') question.practice_scope = field[2].trim()
                if (field[1] === 'answer') question.correct_option_id = field[2].trim()
                if (field[1] === 'sources')
                    for (const token of [...field[2].matchAll(/`([^`]+)`/g)].map((m) => m[1])) {
                        const ref = resolve(token)
                        if (!ref) at(n, `passage "${token}" not found`)
                        else {
                            refs.push(ref)
                            question.source_unit_ids.push(
                                ...ref.part_ids.map((id) => `${ref.packet_id}:${id}`),
                            )
                        }
                    }
                return
            }
            if (!line.trim()) return flush()
            if (buffer.length && line.startsWith('>') !== buffer[0].startsWith('>')) flush()
            buffer.push(line.trim())
        })
    flush()
    for (const q of questions) {
        if (!['beginner', 'intermediate', 'expert'].includes(q.difficulty))
            at(q.line, `unknown level "${q.difficulty}"`)
        if (!['lesson', 'source_study'].includes(q.practice_scope))
            at(q.line, `unknown scope "${q.practice_scope}"`)
        if (!q.prompt) at(q.line, 'no prompt')
        if (q.options.length < 2) at(q.line, 'fewer than two options')
        if (!q.options.some((o) => o.option_id === q.correct_option_id))
            at(q.line, 'answer is not one of the options')
        if (q.options.some((o) => !o.text)) at(q.line, 'an option has no text')
        delete q.line
    }
    return { questions, refs }
}

export function compile_chapter(file) {
    const locale = file.endsWith('.ar.md') ? 'ar' : 'en'
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

    // Citations, numbered by first appearance; the same citation keeps its number.
    const cited = []
    const number = (cite) => {
        const key = `${cite.tokens.join(',')}|${cite.remark}`
        let index = cited.findIndex((item) => item.key === key)
        if (index < 0) index = cited.push({ key, ...cite }) - 1
        return index + 1
    }
    const block = (text, id) => {
        const { text: clean, pieces } = marked(text)
        return {
            paragraph_id: id,
            text: clean,
            parts: pieces.map((piece) =>
                piece.cite ? { note: number(piece.cite) } : { text: piece.text },
            ),
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
    const words = (text) =>
        new Set(
            text
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[\u064B-\u0652\u0670]/g, '')
                .match(/[\p{L}‘’']{4,}/gu) ?? [],
        )
    // Outline points follow the story: each links to an account section, in order (never
    // going back), choosing the order that shares the most words between points and sections.
    const pools = account.map((s) =>
        words(`${s.title} ${s.paragraphs.map((p) => p.text).join(' ')}`),
    )
    const overlap = doc.outline.map((text) => {
        const point = [...words(text)]
        return pools.map((pool) => point.filter((w) => pool.has(w)).length)
    })
    const best = doc.outline.map(() => account.map(() => -Infinity))
    const back = doc.outline.map(() => account.map(() => 0))
    overlap.forEach((row, i) =>
        row.forEach((score, j) => {
            if (i === 0) return (best[0][j] = score)
            for (let k = 0; k <= j; k++)
                if (best[i - 1][k] + score > best[i][j]) {
                    best[i][j] = best[i - 1][k] + score
                    back[i][j] = k
                }
        }),
    )
    const chosen = []
    if (doc.outline.length && account.length) {
        let j = best.at(-1).indexOf(Math.max(...best.at(-1)))
        for (let i = doc.outline.length - 1; i >= 0; i--) {
            chosen[i] = j
            j = back[i][j]
        }
    }
    const outline = doc.outline.map((text, i) => ({
        point_id: `${chapter_id}_pt${i + 1}`,
        text: plain(text),
        section_id: account[chosen[i] ?? 0]?.section_id,
    }))

    // One source entry per citation, in reading order.
    const prefix = doc.fields.prefix ?? ''
    const units = new Map()
    const readings = cited.map((cite, index) => {
        const refs = []
        let previous = null
        for (const token of cite.tokens) {
            const ref = resolve(token, prefix, previous)
            if (!ref) {
                at(1, `passage "${token}" not found`)
                continue
            }
            previous = ref.packet_id
            refs.push(ref)
            for (const id of ref.part_ids)
                units.set(`${ref.packet_id}:${id}`, unit(ref.packet_id, id))
        }
        if (!refs.length && !cite.remark) at(1, 'a citation with neither passages nor a remark')
        const cited_units = refs.flatMap((ref) => ref.part_ids.map((id) => unit(ref.packet_id, id)))
        const title = [source_title(cited_units, locale), cite.remark].filter(Boolean).join(' — ')
        const translated = refs.every((ref) =>
            ref.part_ids.every((id) => translations.has(`${ref.packet_id}:${id}`)),
        )
        return {
            reading_id: `${chapter_id}_n${index + 1}`,
            number: index + 1,
            title,
            mode: locale === 'en' && translated && refs.length ? 'translated' : 'original',
            strength: cited_units.some((item) => weak.has(item.unit_id)) ? 'weak' : null,
            source_refs: refs,
        }
    })

    // Glossary terms: each is marked where it first appears in the chapter, in reading order,
    // and listed as the chapter's terms.
    const terms = []
    const blocks = [
        ...overview,
        ...account.flatMap((s) => s.paragraphs),
        ...in_depth.flatMap((s) => s.paragraphs),
    ]
    for (const block of blocks)
        for (let i = 0; i < block.parts.length; i++) {
            const part = block.parts[i]
            if (part.text === undefined) continue
            let first = null
            for (const term of locale === 'en' ? glossary_terms : []) {
                if (term.id === 'pbuh' || terms.some((item) => item.id === term.id)) continue
                for (const word of term.match) {
                    const found = term_pattern(word).exec(part.text)
                    if (found && (!first || found.index < first.index))
                        first = { term, index: found.index, length: found[0].length }
                }
            }
            if (!first) continue
            terms.push({ id: first.term.id, word: first.term.word, meaning: first.term.meaning })
            const before = part.text.slice(0, first.index)
            const word = part.text.slice(first.index, first.index + first.length)
            const after = part.text.slice(first.index + first.length)
            block.parts.splice(
                i,
                1,
                ...[
                    before && { text: before },
                    { text: word, term: first.term.id },
                    after && { text: after },
                ].filter(Boolean),
            )
        }

    const { questions, refs: question_refs } = compile_questions(
        file.replace(/(\.ar)?\.md$/, (_, ar) => `.questions${ar ?? ''}.md`),
        chapter_id,
        errors,
    )
    for (const ref of question_refs)
        for (const id of ref.part_ids) units.set(`${ref.packet_id}:${id}`, unit(ref.packet_id, id))

    return {
        errors,
        chapter: {
            chapter_id,
            locale,
            status: 'story',
            packet_id: `${chapter_id}:${locale}:story`,
            stage: doc.fields.stage ?? null,
            title: doc.title,
            reader_question: doc.question,
            overview,
            account,
            outline,
            in_depth,
            readings,
            terms,
            source_units: [...units.values()].filter(Boolean).map((item) => ({
                ...item,
                text: locale === 'en' ? (translations.get(item.unit_id) ?? null) : null,
            })),
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
        .filter((n) => /^\d+-[\w-]+(\.ar)?\.md$/.test(n))
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
        files.set(`${chapter.chapter_id}.${chapter.locale}.json`, JSON.stringify(chapter))
    files.set(
        'index.json',
        JSON.stringify(
            chapters
                .filter((chapter) => chapter.locale === 'en')
                .map(({ number, chapter_id, stage, title, reader_question }) => {
                    const arabic = chapters.find(
                        (item) => item.chapter_id === chapter_id && item.locale === 'ar',
                    )
                    return {
                        number,
                        chapter_id,
                        stage,
                        title,
                        reader_question,
                        ...(arabic ? { title_ar: arabic.title } : {}),
                    }
                }),
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
