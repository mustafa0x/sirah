import accepted from '../content/hijrah-chapters/catalog.ar.json'
import { chapter_locale, prepare_chapter } from './chapter-editions.js'

// The chapter stories (content/chapters/*.md, compiled): the foundation, in English, with an
// Arabic edition beside each one as it is written. Other languages read the English until they
// have their own; Arabic reads the earlier edition until the new one exists.
import story_index from '../content/chapters/index.json'
const stories = import.meta.glob('../content/chapters/*.{en,ar}.json', { import: 'default' })
const story_entry = (chapter_id) => story_index.find((item) => item.chapter_id === chapter_id)
const story_locale = (chapter_id, requested) => {
    if (!story_entry(chapter_id)) return null
    if (requested !== 'ar') return 'en'
    return stories[`../content/chapters/${chapter_id}.ar.json`] ? 'ar' : null
}
const reads_story = (chapter_id, requested) => Boolean(story_locale(chapter_id, requested))

// Chapter payloads are large; each loads only when a reader opens it.
const payloads = import.meta.glob('../content/hijrah-chapters/*/chapter.*.json', {
    import: 'default',
})
const editions = import.meta.glob('../content/hijrah-chapters/catalog.*.json', {
    eager: true,
    import: 'default',
})
const available_for = (chapter_id) =>
    Object.entries(editions)
        .filter(
            ([path, value]) =>
                !path.endsWith('catalog.ar.json') &&
                value.chapters.some((item) => item.chapter_id === chapter_id),
        )
        .map(([path]) => path.match(/catalog\.([^.]+)\.json$/)[1])
const edition_entry = (chapter_id, locale) =>
    editions[`../content/hijrah-chapters/catalog.${locale}.json`]?.chapters.find(
        (item) => item.chapter_id === chapter_id,
    )

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

// In story order (chronology), as the chapter files are numbered.
const story_order = (item) => story_entry(item.chapter_id)?.number ?? 99

export function available_chapters(requested) {
    return catalog.chapters
        .filter(
            (item) =>
                reads_story(item.chapter_id, requested) ||
                chapter_locale(requested, available_for(item.chapter_id)),
        )
        .sort((a, b) => story_order(a) - story_order(b))
}

export function chapter_content_locale(item, requested) {
    if (reads_story(item.chapter_id, requested)) return story_locale(item.chapter_id, requested)
    return chapter_locale(requested, available_for(item.chapter_id))
}

export function chapter_title(item, requested) {
    const story = story_locale(item.chapter_id, requested)
    if (story === 'en') return story_entry(item.chapter_id).title
    if (story === 'ar') return story_entry(item.chapter_id).title_ar
    const locale = chapter_content_locale(item, requested)
    return locale === 'ar' ? item.title_ar : (edition_entry(item.chapter_id, locale)?.title ?? null)
}

export async function load_chapter(chapter_id, requested = 'ar') {
    const story = story_locale(chapter_id, requested)
    if (story) return stories[`../content/chapters/${chapter_id}.${story}.json`]()
    const entry = catalog.chapters.find((item) => item.chapter_id === chapter_id)
    const path = entry?.path ?? `${chapter_id}/chapter.ar.json`
    const load = payloads[`../content/hijrah-chapters/${path}`]
    if (!load) throw new Error(`Unknown chapter: ${chapter_id}`)
    const arabic = await load()
    const locale = chapter_locale(requested, available_for(chapter_id))
    if (locale === 'ar') return prepare_chapter(arabic)
    if (!locale) throw new Error('No complete chapter edition is available')
    const translation = edition_entry(chapter_id, locale)
    const edition = await payloads[`../content/hijrah-chapters/${translation.path}`]()
    if (
        edition.translation_sha256 !== translation.translation_sha256 ||
        edition.status !== translation.status ||
        edition.locale !== locale ||
        edition.arabic_sha256 !== translation.arabic_sha256 ||
        edition.revision !== translation.revision
    )
        throw new Error('Translation catalog and edition differ')
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
