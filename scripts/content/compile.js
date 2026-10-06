// Compiles the learner-facing prose in content/*.md into src/content/text.generated.js, which
// the journey's content modules read. Markdown owns the words; the JavaScript modules own the
// data (positions, durations, passages, links). See docs/CONTENT_SPEC.md for the format.
//
//   node scripts/content/compile.js          write the generated module
//   node scripts/content/compile.js --check  fail if it is out of date or the content is invalid
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const content_dir = path.join(root, 'content')
const output = path.join(root, 'src/content/text.generated.js')

// --- A small, strict Markdown reader -------------------------------------------------------
// A file is: an optional `# Title`, optional `key: value` lines, then `## id` sections. A
// section has `key: value` lines, blockquotes (shown for reference, ignored), one prose
// paragraph, and optional `### young` with one prose paragraph. HTML comments are ignored.

export function parse(file, text) {
    const errors = []
    const fail = (line, message) => errors.push(`${path.relative(root, file)}:${line}: ${message}`)
    const lines = text
        .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ''))
        .split('\n')
    const doc = { title: null, fields: {}, sections: [] }
    let section = null
    let target = null // where prose goes: { prose: [] }
    let paragraph = []
    const flush = () => {
        if (paragraph.length && target) target.prose.push(paragraph.join(' ').trim())
        paragraph = []
    }
    lines.forEach((raw, index) => {
        const line = raw.trimEnd()
        const at = index + 1
        if (/^# /.test(line)) {
            flush()
            if (section) fail(at, 'a "# " title belongs at the top of the file')
            else doc.title = line.slice(2).trim()
            return
        }
        if (/^## /.test(line)) {
            flush()
            section = {
                id: line.slice(3).trim(),
                line: at,
                fields: {},
                quote: [],
                prose: [],
                young: null,
            }
            doc.sections.push(section)
            target = section
            return
        }
        if (/^### /.test(line)) {
            flush()
            const name = line.slice(4).trim()
            if (!section) return fail(at, `"### ${name}" outside a section`)
            if (name !== 'young')
                return fail(at, `unknown subsection "### ${name}" (only "### young")`)
            if (section.young) return fail(at, 'a second "### young"')
            section.young = { prose: [], line: at }
            target = section.young
            return
        }
        if (/^#/.test(line)) return fail(at, `unsupported heading "${line}"`)
        if (!line.trim()) return flush()
        if (line.startsWith('>')) {
            flush()
            if (section) section.quote.push(line.replace(/^> ?/, ''))
            return
        }
        const field = /^([a-z_]+):\s*(.*)$/.exec(line)
        const owner = section ?? doc
        if (field && !paragraph.length && !target?.prose.length && target !== section?.young) {
            if (field[1] in owner.fields) fail(at, `"${field[1]}" given twice`)
            owner.fields[field[1]] = field[2].trim()
            return
        }
        if (!target) return fail(at, 'text outside a section')
        paragraph.push(line.trim())
    })
    flush()
    return { doc, errors }
}

// --- The representations -------------------------------------------------------------------

function read(file) {
    const full = path.join(content_dir, file)
    return { file: full, ...parse(full, readFileSync(full, 'utf8')) }
}

// Each section must hold exactly one prose paragraph (or none, where allowed).
function one(errors, file, section, where, optional = false) {
    const prose = where.prose
    const at = `${path.relative(root, file)}:${where.line ?? section.line}`
    if (prose.length > 1)
        errors.push(`${at}: "${section.id}" has ${prose.length} paragraphs; write one`)
    if (!prose.length && !optional) errors.push(`${at}: "${section.id}" has no text`)
    return prose[0]
}

function need(errors, file, owner, key, line) {
    const value = owner.fields[key]
    if (!value) errors.push(`${path.relative(root, file)}:${line}: missing "${key}:"`)
    return value
}

export function compile() {
    const errors = []
    const result = {
        stage_text: {},
        places: {},
        moments: {},
        timeline_text: {},
        source_notes: {},
        glossary_terms: [],
    }

    // Journey: one file per stage.
    const stage_files = readdirSync(path.join(content_dir, 'journey'))
        .filter((name) => name.endsWith('.md'))
        .sort((a, b) => parseInt(a) - parseInt(b))
    const paragraph_ids = new Set()
    for (const name of stage_files) {
        const { file, doc, errors: parse_errors } = read(`journey/${name}`)
        errors.push(...parse_errors)
        const id = need(errors, file, doc, 'stage', 1)
        if (!doc.title) errors.push(`${path.relative(root, file)}:1: missing "# Stage title"`)
        const stage = { title: doc.title, paragraphs: [] }
        for (const section of doc.sections) {
            if (section.id === 'why' || section.id === 'recap') {
                stage[section.id] = { text: one(errors, file, section, section) }
                continue
            }
            if (!/^N\d{2}[a-z]$/.test(section.id))
                errors.push(
                    `${path.relative(root, file)}:${section.line}: "${section.id}" is not a paragraph id (N01a), "why" or "recap"`,
                )
            if (paragraph_ids.has(section.id))
                errors.push(
                    `${path.relative(root, file)}:${section.line}: paragraph "${section.id}" appears twice`,
                )
            paragraph_ids.add(section.id)
            const sources = need(errors, file, section, 'sources', section.line)
            stage.paragraphs.push({
                id: section.id,
                text: one(errors, file, section, section),
                ...(section.young
                    ? { young: { text: one(errors, file, section, section.young) } }
                    : {}),
                source_ids: (sources ?? '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
            })
        }
        if (id) result.stage_text[id] = stage
    }

    // Map: places and moments.
    {
        const { file, doc, errors: parse_errors } = read('map.md')
        errors.push(...parse_errors)
        for (const section of doc.sections) {
            const [kind, id] = section.id.split(/:\s*/)
            if (kind === 'place')
                result.places[id] = {
                    label: need(errors, file, section, 'name', section.line),
                    description: one(errors, file, section, section),
                }
            else if (kind === 'moment')
                result.moments[id] = {
                    title: need(errors, file, section, 'title', section.line),
                    text: one(errors, file, section, section),
                    ...(section.young
                        ? { young: { text: one(errors, file, section, section.young) } }
                        : {}),
                }
            else
                errors.push(
                    `${path.relative(root, file)}:${section.line}: expected "## place: id" or "## moment: id"`,
                )
        }
    }

    // Timeline.
    {
        const { file, doc, errors: parse_errors } = read('timeline.md')
        errors.push(...parse_errors)
        for (const section of doc.sections) {
            const note = one(errors, file, section, section, true)
            result.timeline_text[section.id] = {
                title: need(errors, file, section, 'title', section.line),
                when: { text: need(errors, file, section, 'when', section.line) },
                ...(note ? { note: { text: note } } : {}),
            }
        }
    }

    // Source notes.
    {
        const { file, doc, errors: parse_errors } = read('sources.md')
        errors.push(...parse_errors)
        for (const section of doc.sections) {
            if (!/^E\d+$/.test(section.id))
                errors.push(
                    `${path.relative(root, file)}:${section.line}: "${section.id}" is not a source id (E01)`,
                )
            result.source_notes[section.id] = { text: one(errors, file, section, section) }
        }
    }

    // Glossary.
    {
        const { file, doc, errors: parse_errors } = read('glossary.md')
        errors.push(...parse_errors)
        for (const section of doc.sections)
            result.glossary_terms.push({
                id: section.id,
                word: need(errors, file, section, 'word', section.line),
                meaning: one(errors, file, section, section),
                match: (need(errors, file, section, 'matches', section.line) ?? '')
                    .split('|')
                    .map((item) => item.trim())
                    .filter(Boolean),
            })
    }
    return { result, errors }
}

export function render(result) {
    const lines = [
        '// Generated by scripts/content/compile.js from content/*.md. Edit the Markdown, not this file.',
        '',
    ]
    for (const [name, value] of Object.entries(result))
        lines.push(
            `export const ${name} = ${JSON.stringify(value, null, 4).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:')}`,
            '',
        )
    return lines.join('\n')
}

// Written through the project's formatter, so the generated file passes the format check.
function formatted(text) {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'content-')), 'text.generated.js')
    writeFileSync(file, text)
    execFileSync(path.join(root, 'node_modules/.bin/oxfmt'), [
        '-c',
        path.join(root, '.oxfmtrc.json'),
        file,
    ])
    return readFileSync(file, 'utf8')
}

// Compiles and writes the generated module (or, with check, compares it). Returns errors.
export function build_content({ check = false } = {}) {
    const { result, errors } = compile()
    if (errors.length) return errors
    const text = formatted(render(result))
    let current = ''
    try {
        current = readFileSync(output, 'utf8')
    } catch {}
    if (current === text) return []
    if (check)
        return ['src/content/text.generated.js is out of date: run node scripts/content/compile.js']
    writeFileSync(output, text)
    return []
}

// Vite: compile when the dev server starts or a build begins, and again whenever a content
// file changes, so edits to content/*.md show up straight away.
export function content_plugin() {
    const report = (errors) => {
        for (const error of errors) console.error(`[content] ${error}`)
    }
    return {
        name: 'content',
        buildStart() {
            const errors = build_content()
            if (errors.length) {
                report(errors)
                this.error(`${errors.length} content errors`)
            }
        },
        configureServer(server) {
            server.watcher.add(content_dir)
            const rebuild = (file) => {
                if (file.startsWith(content_dir) && file.endsWith('.md')) report(build_content())
            }
            for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, rebuild)
        },
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const errors = build_content({ check: process.argv.includes('--check') })
    for (const error of errors) console.error(error)
    if (errors.length) process.exit(1)
}
