// Derivation: the journey's narrated captions retell the chapters. Each caption in
// content/narrative.md names what it retells with "from: hch_thawr §2" (sections of the chapter's
// story, counted from 1, as "§2" or "§2–3"; "overview" for the overview), and may cite only
// passages that those sections cite. content/narrative.lock.json records the text of those
// sections when the caption was written, so a later change to the chapter flags the caption.
//
// The command line is scripts/derive.js.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { compile_chapters } from './chapters.js'
import { resolve } from './passages.js'

const root = path.resolve(import.meta.dirname, '../..')
export const lock_file = path.join(root, 'content/narrative.lock.json')

let chapters = null
function chapter(id) {
    chapters ??= compile_chapters().chapters.filter((item) => item.locale === 'en')
    return chapters.find((item) => item.chapter_id === id)
}

// "hch_thawr §2–3" -> the sections, the passages they cite, and a fingerprint of their text.
export function sections_for(from) {
    const match = /^(\S+)\s+(?:§(\d+)(?:[–-](\d+))?|(overview))$/.exec((from ?? '').trim())
    if (!match) return { error: `"from:" should read like "hch_thawr §2" or "hch_thawr §2–3"` }
    const source = chapter(match[1])
    if (!source) return { error: `no chapter "${match[1]}"` }
    const blocks = []
    const titles = []
    if (match[4]) {
        blocks.push(...source.overview)
        titles.push('Overview')
    } else {
        const first = Number(match[2])
        const last = Number(match[3] ?? match[2])
        for (let n = first; n <= last; n++) {
            const section = source.account[n - 1]
            if (!section) return { error: `${match[1]} has no section §${n}` }
            blocks.push(...section.paragraphs)
            titles.push(section.title)
        }
    }
    const notes = new Set(
        blocks.flatMap((block) => block.parts.filter((p) => p.note).map((p) => p.note)),
    )
    const units = new Set()
    for (const reading of source.readings)
        if (notes.has(reading.number))
            for (const ref of reading.source_refs)
                for (const id of ref.part_ids) units.add(`${ref.packet_id}:${id}`)
    const text = blocks.map((block) => block.text).join('\n')
    return {
        chapter: source,
        titles,
        blocks,
        units,
        hash: createHash('sha256').update(text).digest('hex').slice(0, 16),
    }
}

export function lock() {
    try {
        return JSON.parse(readFileSync(lock_file, 'utf8'))
    } catch {
        return {}
    }
}

// Checks every caption with "from:": its sections exist, and each passage it cites is one
// those sections cite. Returns { errors, stale, underived }.
export function check_derivations(stage_text) {
    const errors = []
    const stale = []
    const underived = []
    const recorded = lock()
    for (const [stage, content] of Object.entries(stage_text))
        for (const paragraph of content.paragraphs) {
            if (!paragraph.from) {
                underived.push(paragraph.id)
                continue
            }
            const found = sections_for(paragraph.from)
            if (found.error) {
                errors.push(`${paragraph.id}: ${found.error}`)
                continue
            }
            for (const token of paragraph.source_ids) {
                const ref = resolve(token)
                if (!ref) {
                    errors.push(`${paragraph.id}: passage "${token}" not found`)
                    continue
                }
                const outside = ref.part_ids.filter(
                    (id) => !found.units.has(`${ref.packet_id}:${id}`),
                )
                if (outside.length)
                    errors.push(
                        `${paragraph.id}: cites ${token}, which ${paragraph.from} does not cite`,
                    )
            }
            const entry = recorded[paragraph.id]
            if (!entry || entry.from !== paragraph.from || entry.hash !== found.hash)
                stale.push(
                    `${paragraph.id} (${stage}): ${paragraph.from} ${entry ? 'has changed since it was derived' : 'not yet recorded'}`,
                )
        }
    return { errors, stale, underived }
}
