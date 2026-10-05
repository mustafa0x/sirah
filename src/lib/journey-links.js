import { normalize_language } from './locale-config.js'

export const audiences = ['young', 'new', 'deep']
export const journey_paths = [
    '/',
    '/places/:poi',
    '/chapters/:chapter',
    '/chapters/:chapter/:tab',
    '/chapters/:chapter/:tab/:target',
    '/journey/hijrah',
    '/journey/hijrah/map',
    '/journey/hijrah/sources/:source',
    '/journey/hijrah/practice',
    '/journey/hijrah/practice/:question',
    '/journey/hijrah/timeline',
    '/journey/hijrah/timeline/:entry',
    '/journey/hijrah/glossary/:term',
    '/journey/hijrah/ask',
    '/journey/hijrah/help',
    '/journey/hijrah/recap',
    '/journey/hijrah/:stage',
    '/journey/hijrah/:stage/:beat',
]

export function link_context(url, defaults = {}) {
    const params = url.searchParams
    const audience = params.get('audience') ?? defaults.audience
    return {
        lang: normalize_language(params.get('lang') ?? defaults.lang),
        audience: audiences.includes(audience) ? audience : 'new',
        view: (params.get('view') ?? defaults.view) === 'reading' ? 'reading' : 'scene',
    }
}

export function journey_href(path, context, at = null) {
    const url = new URL(path, 'https://sirah.invalid')
    url.searchParams.set('lang', context.lang)
    url.searchParams.set('audience', context.audience)
    if (context.view === 'reading') url.searchParams.set('view', 'reading')
    else url.searchParams.delete('view')
    if (at) url.searchParams.set('at', at)
    if (url.pathname.startsWith('/journey/hijrah/practice')) {
        if (context.level) url.searchParams.set('level', context.level)
        if (context.practice_step) url.searchParams.set('stage', context.practice_step)
    }
    return `${url.pathname}${url.search}${url.hash}`
}

export function beat_position(step, beat_id) {
    const index = step.paragraphs.findIndex((paragraph) => paragraph.id === beat_id)
    if (index < 0) throw new Error('Beat does not belong to this stage')
    return step.paragraphs[index].start ?? (index * step.duration) / step.paragraphs.length
}

export function chapter_stage(steps, chapter_id, place_links = []) {
    const explicit = steps.find(
        (step) =>
            step.reading_chapter_id === chapter_id ||
            step.additional_reading_chapter_ids?.includes(chapter_id),
    )
    if (explicit) return explicit.id
    for (const place of place_links) {
        const step = steps.find((item) => item.id === place.place_id)
        if (step) return step.id
    }
    return steps[0].id
}

export function resolve_journey_link(url, registry, defaults = {}) {
    let parts
    let fragment_id
    try {
        parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
        fragment_id = decodeURIComponent(url.hash.slice(1))
    } catch {
        return null
    }
    const context = link_context(url, defaults)
    const { steps, sources, pois, entries, terms, questions } = registry
    const find_beat = (id) => steps.find((step) => step.paragraphs.some((p) => p.id === id))
    const at = url.searchParams.get('at')
    if (at && !find_beat(at)) return null
    const target = { ...context, at, fragment_id, stage_id: find_beat(at)?.id ?? steps[0].id }
    if (!parts.length) return { ...target, kind: 'home' }
    if (parts[0] === 'places' && parts.length === 2) {
        const poi = pois.find((item) => item.id === parts[1])
        if (!poi) return null
        return {
            ...target,
            kind: 'place',
            poi_id: poi.id,
            stage_id: at
                ? target.stage_id
                : (steps.find((s) => s.id === poi.place)?.id ?? target.stage_id),
        }
    }
    if (parts[0] === 'chapters' && parts.length >= 2 && parts.length <= 4) {
        const tab = parts[2] ?? 'story'
        if (!['story', 'readings', 'sources', 'practice'].includes(tab)) return null
        return {
            ...target,
            kind: 'chapter',
            stage_id: at ? target.stage_id : chapter_stage(steps, parts[1]),
            chapter_id: parts[1],
            tab,
            target_id: parts[3] ?? null,
        }
    }
    if (parts[0] !== 'journey' || parts[1] !== 'hijrah') return null
    const [name, id] = parts.slice(2)
    if (parts.length > 4) return null
    if (!name) return { ...target, kind: 'stage' }
    if (name === 'sources' && id) {
        const source = sources.find((item) => item.id === id)
        if (!source) return null
        const step = steps.find((s) => s.paragraphs.some((p) => p.source_ids.includes(id)))
        return {
            ...target,
            kind: 'source',
            source_id: id,
            stage_id: at ? target.stage_id : (step?.id ?? target.stage_id),
            at: at ?? step?.paragraphs.find((p) => p.source_ids.includes(id))?.id,
        }
    }
    if (name === 'map' && !id) return { ...target, kind: 'map', view: 'scene' }
    if (name === 'practice') {
        const level = url.searchParams.get('level')
        const practice_step = url.searchParams.get('stage')
        if (level && !['beginner', 'intermediate', 'expert'].includes(level)) return null
        if (practice_step && !steps.some((s) => s.id === practice_step)) return null
        const available = questions(context.audience, { level, step_id: practice_step })
        const question = available.find((q) => q.question_id === id)
        if (!available.length || (id && !question)) return null
        return {
            ...target,
            kind: 'practice',
            question_id: id ?? null,
            level,
            practice_step,
            stage_id: at
                ? target.stage_id
                : (question?.step_id ?? practice_step ?? target.stage_id),
        }
    }
    if (name === 'timeline') {
        const entry = id ? entries.find((item) => item.id === id) : entries[0]
        return entry
            ? {
                  ...target,
                  kind: 'timeline',
                  entry_id: entry.id,
                  stage_id: at ? target.stage_id : entry.stage,
              }
            : null
    }
    if (name === 'glossary' && id && terms.some((item) => item.id === id))
        return { ...target, kind: 'term', term_id: id }
    if (['ask', 'help', 'recap'].includes(name) && !id)
        return {
            ...target,
            kind: name,
            stage_id: name === 'recap' ? steps.at(-1).id : target.stage_id,
            at: name === 'recap' ? null : at,
        }
    const stage = steps.find((step) => step.id === name)
    if (
        !stage ||
        (at && target.stage_id !== stage.id) ||
        (id && !stage.paragraphs.some((paragraph) => paragraph.id === id))
    )
        return null
    if (fragment_id && !stage.paragraphs.some((p) => p.id === fragment_id)) return null
    return { ...target, kind: 'stage', stage_id: stage.id, at: fragment_id || id || at || null }
}

export function valid_chapter_link(target, chapter) {
    if (chapter.chapter_id !== target.chapter_id) return false
    if (target.fragment_id && target.tab !== 'story') return false
    if (
        target.fragment_id &&
        ![
            ...chapter.overview,
            ...chapter.account.flatMap((s) => s.paragraphs),
            ...chapter.in_depth.flatMap((s) => s.paragraphs),
        ].some((p) => p.paragraph_id === target.fragment_id)
    )
        return false
    if (!target.target_id) return true
    if (target.fragment_id) {
        const sections =
            target.target_id === 'in_depth'
                ? chapter.in_depth
                : [...chapter.account, ...chapter.in_depth].filter(
                      (s) => s.section_id === target.target_id,
                  )
        if (!sections.some((s) => s.paragraphs.some((p) => p.paragraph_id === target.fragment_id)))
            return false
    }
    if (target.tab === 'story')
        return (
            (target.target_id === 'in_depth' && chapter.in_depth.length > 0) ||
            [...chapter.account, ...chapter.in_depth].some((s) => s.section_id === target.target_id)
        )
    if (target.tab === 'readings')
        return chapter.readings.some((r) => r.reading_id === target.target_id)
    if (target.tab === 'sources')
        return chapter.source_units.some((u) => u.unit_id === target.target_id)
    return chapter.questions.some((q) => q.question_id === target.target_id)
}

export function follow_link(event, action) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    action()
}
