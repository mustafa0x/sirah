import accepted from '../content/hijrah-chapters/catalog.ar.json'
import english from '../content/hijrah-chapters/catalog.en.json'
import { chapter_locale, prepare_chapter } from './chapter-editions.js'

// Chapter payloads are large; each loads only when a reader opens it.
const payloads = import.meta.glob('../content/hijrah-chapters/*/chapter.*.json', {
    import: 'default',
})

// Accepted chapters, plus any chapter still in draft, so every exported chapter can be
// read in the app. Draft payloads load on demand rather than in the main bundle.
export const catalog = $state({
    chapter_order: [...accepted.chapter_order],
    chapters: [...accepted.chapters],
    places: accepted.places.map((place) => ({ ...place, chapter_ids: [...place.chapter_ids] })),
})

{
    for (const [path, load] of Object.entries(payloads)) {
        if (!path.endsWith('/chapter.ar.json')) continue
        const relative = path.replace('../content/hijrah-chapters/', '')
        if (accepted.chapters.some((item) => item.path === relative)) continue
        load().then((payload) => {
            catalog.chapter_order.push(payload.chapter_id)
            catalog.chapters.push({
                chapter_id: payload.chapter_id,
                title_ar: payload.title_ar,
                path: relative,
                revision: payload.revision,
                topic_ids: payload.topic_ids,
            })
            for (const link of payload.place_links ?? []) {
                let place = catalog.places.find((item) => item.place_id === link.place_id)
                if (!place) {
                    catalog.places.push({
                        place_id: link.place_id,
                        name_ar: link.place_id,
                        chapter_ids: [],
                    })
                    place = catalog.places.at(-1)
                }
                if (!place.chapter_ids.includes(payload.chapter_id))
                    place.chapter_ids.push(payload.chapter_id)
            }
        })
    }
}

export function chapter_title(item, requested) {
    return chapter_locale(requested) === 'ar'
        ? item.title_ar
        : (english.chapters.find((entry) => entry.chapter_id === item.chapter_id)?.title ??
              item.title_ar)
}

export async function load_chapter(chapter_id, requested = 'ar') {
    const entry = catalog.chapters.find((item) => item.chapter_id === chapter_id)
    const path = entry?.path ?? `${chapter_id}/chapter.ar.json`
    const load = payloads[`../content/hijrah-chapters/${path}`]
    if (!load) throw new Error(`Unknown chapter: ${chapter_id}`)
    const arabic = await load()
    if (chapter_locale(requested) === 'ar') return prepare_chapter(arabic)
    const translation = english.chapters.find((item) => item.chapter_id === chapter_id)
    if (!translation) throw new Error('English edition is not available')
    const edition = await payloads[`../content/hijrah-chapters/${translation.path}`]()
    if (edition.english_sha256 !== translation.english_sha256)
        throw new Error('English catalog and edition differ')
    return prepare_chapter(arabic, edition)
}

// Chapters whose setting or mentions include a scene place.
export function chapters_for_place(place_id) {
    const place = catalog.places.find((item) => item.place_id === place_id)
    return (place?.chapter_ids ?? []).map((id) =>
        catalog.chapters.find((item) => item.chapter_id === id),
    )
}

const entities = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#39;': "'",
    '&nbsp;': ' ',
}

// Display only: the payload keeps the literal source, including digital markup.
export function display_text(text) {
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/&(quot|amp|lt|gt|#39|nbsp);/g, (match) => entities[match])
        .replace(/[ \t]+\n/g, '\n')
        .trim()
}

// How a part reads to a learner: the chain of narrators, the text itself, or a note.
export function part_role(unit) {
    const kind = unit.kind_ar ?? ''
    if (kind.includes('إسناد')) return 'chain'
    if (kind.includes('تخريج') || kind.includes('تعليق')) return 'note'
    if (kind.includes('قرآن')) return 'quran'
    return 'text'
}

// "[label](url)" → { label, url }
export function citation(unit) {
    const match = /^\[(.+)\]\((.+)\)$/.exec(unit.citation ?? unit.citation_ar ?? '')
    return match
        ? { label: match[1], url: match[2] }
        : { label: unit.book ?? unit.book_ar, url: unit.source_url }
}
