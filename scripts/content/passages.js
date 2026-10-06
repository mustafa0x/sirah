// The passage registry: every source passage the content can cite, by one id, with its
// literal Arabic text, kind, speaker and citation. Passages come from three places:
//   - Core packets (docs/research/hijrah/core/core.ar.json): "<packet_id>:<part_id>"
//   - the evidence archive (docs/research/hijrah/evidence.jsonl and batches): "H-…"
//   - the journey's own passages (src/content/first-chapter.js): "E01"…
// Literal text is never edited here; glosses and strengths live with the content that cites it.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const research = path.join(root, 'docs/research/hijrah')

let cache = null

// "[book، 1/480](https://app.turath.io/book/23833?page=503)" -> { book_id, volume, page }
function locate(citation, url) {
    const book_id = /book\/(\d+)|book_id=(\d+)/.exec(url ?? citation ?? '')
    const place = /،\s*(\d+)\/(\d+)/.exec(citation ?? '')
    return {
        book_id: book_id ? (book_id[1] ?? book_id[2]) : null,
        volume: place?.[1] ?? null,
        page: place?.[2] ?? null,
    }
}

function load() {
    if (cache) return cache
    const units = new Map() // "<packet>:<part>" -> unit
    const packets = new Map() // packet id -> ordered part ids

    const core = JSON.parse(readFileSync(path.join(research, 'core/core.ar.json'), 'utf8'))
    for (const packet of core.source_packets) {
        packets.set(
            packet.packet_id,
            packet.parts.map((part) => part.part_id),
        )
        for (const part of packet.parts)
            units.set(`${packet.packet_id}:${part.part_id}`, {
                unit_id: `${packet.packet_id}:${part.part_id}`,
                packet_id: packet.packet_id,
                part_id: part.part_id,
                text_ar: part.text_ar,
                kind_ar: part.source_type_ar ?? null,
                speaker_ar: part.speaker_ar ?? null,
                book_ar: packet.book_ar ?? null,
                citation_ar: packet.citation_ar ?? null,
                source_url: packet.source_url ?? null,
                evidence_id: packet.evidence_id ?? null,
                ...locate(packet.citation_ar, packet.source_url),
            })
    }

    // The archive, passages added to it later (tracked), and local research batches.
    const archives = [
        path.join(research, 'evidence.jsonl'),
        path.join(research, 'evidence-additions.jsonl'),
    ]
    // Batches are local (untracked); a fresh clone builds from the tracked files alone.
    let batches = []
    try {
        batches = readdirSync(path.join(research, 'batches'), { withFileTypes: true })
    } catch {}
    for (const batch of batches)
        if (batch.isDirectory())
            archives.push(path.join(research, 'batches', batch.name, 'evidence.jsonl'))
    for (const file of archives) {
        let text
        try {
            text = readFileSync(file, 'utf8')
        } catch {
            continue
        }
        for (const line of text.split('\n')) {
            if (!line.trim()) continue
            let record
            try {
                record = JSON.parse(line)
            } catch {
                continue
            }
            const id = record.id ?? record.evidence_id
            if (!id || packets.has(id) || !record.text_ar) continue
            packets.set(id, ['p1'])
            units.set(`${id}:p1`, {
                unit_id: `${id}:p1`,
                packet_id: id,
                part_id: 'p1',
                text_ar: record.text_ar,
                kind_ar: record.source_type ?? null,
                speaker_ar: record.speaker ?? null,
                book_ar: record.book ?? null,
                citation_ar: record.citation ?? null,
                source_url: record.url ?? null,
                evidence_id: id,
                ...locate(record.citation, record.url),
                ...(record.volume ? { volume: String(record.volume) } : {}),
                ...(record.printed_page ? { page: String(record.printed_page) } : {}),
            })
        }
    }
    cache = { units, packets }
    return cache
}

// Journey passages are added by the caller (they come from the app's own modules).
export function add_journey_passages(sources) {
    const { units, packets } = load()
    for (const source of sources) {
        if (packets.has(source.id)) continue
        packets.set(source.id, ['p1'])
        units.set(`${source.id}:p1`, {
            unit_id: `${source.id}:p1`,
            packet_id: source.id,
            part_id: 'p1',
            text_ar: source.excerpt ?? '',
            kind_ar: null,
            speaker_ar: source.speaker_ar ?? null,
            book_ar: source.work ?? null,
            citation_ar: source.citation_ar ?? `[${source.work}](${source.url})`,
            source_url: source.url ?? null,
            evidence_id: null,
            ...locate(source.citation_ar, source.url),
            ...(source.volume ? { volume: String(source.volume) } : {}),
            ...(source.page ? { page: String(source.page) } : {}),
        })
    }
}

// Resolves a cited id ("council:p1–p3" with its chapter prefix, "H-…", "E23", "p4" after a
// packet) to { packet_id, part_ids }, or null.
export function resolve(token, prefix = '', previous = null) {
    const { packets } = load()
    token = token.trim()
    if (/^p\d+(?:[–-]p\d+)?$/.test(token) && previous) token = `${previous}:${token}`
    const [name, parts = ''] = token.split(':')
    const packet = [name, prefix + name, `sp_${name}`].find((id) => packets.has(id))
    if (!packet) return null
    const order = packets.get(packet)
    if (!parts) return { packet_id: packet, part_ids: [...order] }
    const [from, to = from] = parts.split(/[–-]/)
    const start = order.indexOf(from)
    const end = order.indexOf(to)
    if (start < 0 || end < start) return null
    return { packet_id: packet, part_ids: order.slice(start, end + 1) }
}

export function unit(packet_id, part_id) {
    return load().units.get(`${packet_id}:${part_id}`)
}
