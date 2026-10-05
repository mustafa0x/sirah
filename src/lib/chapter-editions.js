import { normalize_language } from './locale-config.js'

// Catalogs include complete WIP drafts; Arabic is selected only when explicitly requested.
export function chapter_locale(requested, available = []) {
    const locale = normalize_language(requested)
    if (locale === 'ar') return 'ar'
    if (available.includes(locale)) return locale
    return null
}

export async function content_digest(value) {
    const canonical = (value) => {
        if (Array.isArray(value)) return '[' + value.map(canonical).join(', ') + ']'
        if (value !== null && typeof value === 'object')
            return (
                '{' +
                Object.keys(value)
                    .sort()
                    .map((key) => JSON.stringify(key) + ': ' + canonical(value[key]))
                    .join(', ') +
                '}'
            )
        return JSON.stringify(value)
    }
    return text_digest(canonical(value) + '\n')
}

async function text_digest(text) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const wip_inventories = new Map()

async function wip_inventory(chapter) {
    const rows = new Map()
    const add = (id, item, fields, source = false) => {
        for (const field of fields) {
            const text = item[field]
            if (typeof text !== 'string' || !text.trim()) continue
            if (
                source &&
                !text
                    .replace(/<[^>]*>/g, '')
                    .replace(/&(?:nbsp|#160|#xa0);/gi, ' ')
                    .trim()
            )
                continue
            rows.set(`${id}:${field}`, text)
        }
    }
    add(chapter.chapter_id, chapter, ['title_ar', 'reader_question_ar'])
    for (const paragraph of chapter.overview) add(paragraph.paragraph_id, paragraph, ['text_ar'])
    for (const section of [...chapter.account, ...chapter.in_depth]) {
        add(section.section_id, section, ['title_ar'])
        for (const paragraph of section.paragraphs)
            add(paragraph.paragraph_id, paragraph, ['text_ar'])
    }
    for (const point of chapter.outline) add(point.point_id, point, ['text_ar'])
    for (const reading of chapter.readings) add(reading.reading_id, reading, ['title_ar'])
    for (const record of chapter.records)
        for (const objective of record.learning_objectives)
            if (chapter.objective_ids.includes(objective.objective_id))
                add(objective.objective_id, objective, ['text_ar'])
    for (const question of chapter.questions) {
        add(question.question_id, question, ['prompt_ar', 'explanation_ar', 'scope_note_ar'])
        for (const option of question.options)
            add(`${question.question_id}:${option.option_id}`, option, ['text_ar', 'feedback_ar'])
    }
    for (const objective of chapter.unassessed_objectives)
        add(objective.objective_id, objective, ['reason_ar'])
    for (const issue of chapter.open_issues) add(issue.issue_id, issue, ['note_ar'])
    for (const unit of chapter.source_units) {
        add(unit.unit_id, unit, [
            'kind_ar',
            'speaker_ar',
            'book_ar',
            'citation_ar',
            'context_note_ar',
        ])
        add(unit.unit_id, unit, ['text_ar'], true)
    }
    if (chapter.introduction) {
        add(chapter.introduction.section_id, chapter.introduction, ['title_ar'])
        for (const paragraph of chapter.introduction.paragraphs)
            add(paragraph.paragraph_id, paragraph, ['text_ar'])
    }
    return new Map(
        await Promise.all(
            [...rows].map(async ([id, text]) => [
                id,
                {
                    hash: await text_digest(text),
                    urls: id.endsWith(':citation_ar')
                        ? [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
                        : null,
                },
            ]),
        ),
    )
}

export async function verify_edition(edition, arabic) {
    const { translation_sha256, review, status, ...authored } = edition
    authored.status = 'translation_draft'
    const digest = await content_digest(authored)
    if (
        digest !== translation_sha256 ||
        !arabic ||
        edition.arabic_payload_sha256 !== (await content_digest(arabic)) ||
        !['translation_ready', 'translation_wip'].includes(status) ||
        (status === 'translation_ready'
            ? review?.translation_sha256 !== digest ||
              review?.arabic_sha256 !== edition.arabic_sha256 ||
              review?.translation_compared !== true
            : review?.translation_compared !== false ||
              edition.deferred_questions.length !== 0 ||
              edition.reading_editions.some((mode) => mode.mode !== 'translated')) ||
        review?.independent_language_approval !== false ||
        review?.specialist_approval !== false ||
        review?.public_distribution_approved !== false
    )
        throw new Error('Translation edition content does not match its review')
    const reading_ids = new Set(arabic.readings.map((reading) => reading.reading_id))
    if (
        edition.reading_editions.length !== reading_ids.size ||
        new Set(edition.reading_editions.map((mode) => mode.reading_id)).size !==
            reading_ids.size ||
        edition.reading_editions.some(
            (mode) =>
                !reading_ids.has(mode.reading_id) ||
                Object.keys(mode).sort().join('|') !== 'gloss|mode|reading_id' ||
                !['translated', 'arabic_with_gloss'].includes(mode.mode) ||
                typeof mode.gloss !== 'string' ||
                /<[^>]+>/.test(mode.gloss) ||
                (mode.mode === 'arabic_with_gloss' && !mode.gloss.trim()),
        )
    )
        throw new Error('Invalid translation reading mode')
    if (!wip_inventories.has(edition.arabic_payload_sha256))
        wip_inventories.set(edition.arabic_payload_sha256, wip_inventory(arabic))
    const expected = await wip_inventories.get(edition.arabic_payload_sha256)
    if (status === 'translation_wip') {
        if (
            edition.units.length !== expected.size ||
            new Set(edition.units.map((unit) => unit.unit_id)).size !== expected.size ||
            edition.units.some((unit) => {
                const source = expected.get(unit.unit_id)
                return (
                    !source ||
                    source.hash !== unit.source_text_sha256 ||
                    typeof unit.text !== 'string' ||
                    !unit.text.trim() ||
                    /<[^>]+>/.test(unit.text) ||
                    (source.urls !== null &&
                        JSON.stringify(source.urls) !==
                            JSON.stringify(
                                [...unit.text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]),
                            ))
                )
            })
        )
            throw new Error('WIP translation is incomplete or its source units do not match')
    }
    const unit_ids = new Set(edition.units.map((unit) => unit.unit_id))
    if (
        JSON.stringify(edition.units.map((unit) => unit.unit_id)) !==
        JSON.stringify([...expected.keys()].filter((id) => unit_ids.has(id)))
    )
        throw new Error('Translation unit order changed')
}

export async function prepare_chapter(arabic, edition = null) {
    if (
        'introduction' in arabic &&
        (!arabic.introduction ||
            typeof arabic.introduction !== 'object' ||
            Array.isArray(arabic.introduction) ||
            Object.keys(arabic.introduction).sort().join('|') !==
                'paragraphs|section_id|title_ar')
    )
        throw new Error('Introduction must be an object with its required fields')
    if (
        edition &&
        (edition.chapter_id !== arabic.chapter_id ||
            edition.revision !== arabic.revision ||
            edition.arabic_sha256 !== arabic.source_document_sha256 ||
            chapter_locale(edition.locale, [edition.locale]) !== edition.locale ||
            edition.locale === 'ar' ||
            !['translation_ready', 'translation_wip'].includes(edition.status))
    )
        throw new Error('Translation edition does not match the accepted Arabic chapter')
    if (edition) await verify_edition(edition, arabic)
    const wording = new Map((edition?.units ?? []).map((unit) => [unit.unit_id, unit.text]))
    const words = (item, id, fields) => {
        const result = { ...item }
        for (const field of fields) {
            if (!item[field]) continue
            const key = `${id}:${field}`
            const value = edition ? wording.get(key) : item[field]
            if (edition && value === undefined)
                throw new Error(`Missing translation wording: ${key}`)
            result[field.replace(/_ar$/, '')] = value
        }
        return result
    }
    const paragraph = (item) => words(item, item.paragraph_id, ['text_ar'])
    const section = (item) => ({
        ...words(item, item.section_id, ['title_ar']),
        paragraphs: item.paragraphs.map(paragraph),
    })
    const modes = new Map((edition?.reading_editions ?? []).map((item) => [item.reading_id, item]))
    const deferred = new Set((edition?.deferred_questions ?? []).map((item) => item.question_id))
    if (edition) {
        for (const question of arabic.questions) {
            if (deferred.has(question.question_id)) continue
            if (question.reading_ids.some((id) => modes.get(id)?.mode !== 'translated'))
                throw new Error('Included question needs translated evidence')
            const choices = question.options.map((option) =>
                wording.get(`${question.question_id}:${option.option_id}:text_ar`),
            )
            if (new Set(choices).size !== choices.length)
                throw new Error('Duplicate translated choices')
        }
    }
    const translated_parts = new Set(
        arabic.readings
            .filter((reading) => modes.get(reading.reading_id)?.mode === 'translated')
            .flatMap((reading) =>
                reading.source_refs.flatMap((ref) =>
                    ref.part_ids.map((id) => ref.packet_id + ':' + id),
                ),
            ),
    )
    return {
        ...words(arabic, arabic.chapter_id, ['title_ar', 'reader_question_ar']),
        locale: edition?.locale ?? 'ar',
        status: edition?.status ?? arabic.status,
        packet_id: edition
            ? `${arabic.chapter_id}:${edition.locale}:r${arabic.revision}:${edition.translation_sha256}`
            : arabic.packet_id,
        translation_sha256: edition?.translation_sha256,
        translation_review: edition?.review,
        ...(arabic.introduction
            ? {
                  introduction: {
                      ...words(arabic.introduction, arabic.introduction.section_id, ['title_ar']),
                      paragraphs: arabic.introduction.paragraphs.map(paragraph),
                  },
              }
            : {}),
        overview: arabic.overview.map(paragraph),
        account: arabic.account.map(section),
        outline: arabic.outline.map((item) => words(item, item.point_id, ['text_ar'])),
        in_depth: arabic.in_depth.map(section),
        readings: arabic.readings.map((item) => {
            const mode = modes.get(item.reading_id)
            return {
                ...words(item, item.reading_id, ['title_ar']),
                ...(mode ? { mode: mode.mode, gloss: mode.gloss } : {}),
            }
        }),
        objectives: arabic.records
            .flatMap((record) => record.learning_objectives)
            .filter((item) => arabic.objective_ids.includes(item.objective_id))
            .map((item) => words(item, item.objective_id, ['text_ar'])),
        open_issues: arabic.open_issues.map((item) => words(item, item.issue_id, ['note_ar'])),
        deferred_questions: edition?.deferred_questions ?? [],
        questions: arabic.questions
            .filter((item) => !deferred.has(item.question_id))
            .map((item) => ({
                ...words(item, item.question_id, ['prompt_ar', 'explanation_ar', 'scope_note_ar']),
                options: item.options.map((option) =>
                    words(option, `${item.question_id}:${option.option_id}`, [
                        'text_ar',
                        'feedback_ar',
                    ]),
                ),
            })),
        source_units: arabic.source_units.map((unit) => {
            const text = edition ? (wording.get(`${unit.unit_id}:text_ar`) ?? null) : unit.text_ar
            if (
                edition &&
                translated_parts.has(unit.unit_id) &&
                unit.text_ar
                    .replace(/<[^>]*>/g, '')
                    .replace(/&(?:nbsp|#160|#xa0);/gi, ' ')
                    .trim() &&
                !text?.trim()
            )
                throw new Error(`Missing translation source wording: ${unit.unit_id}`)
            return {
                ...words(unit, unit.unit_id, [
                    'kind_ar',
                    'speaker_ar',
                    'book_ar',
                    'citation_ar',
                    'context_note_ar',
                ]),
                text,
            }
        }),
    }
}

export function source_part_display(unit, locale, reading_mode) {
    const original = reading_mode === 'arabic_with_gloss'
    return { text: original ? unit.text_ar : unit.text, locale: original ? 'ar' : locale, original }
}

export function reading_for_note(readings, note) {
    return readings.find((reading) =>
        reading.source_refs.some((ref) =>
            note.source_refs.some(
                (source) =>
                    source.packet_id === ref.packet_id &&
                    source.part_ids.every((id) => ref.part_ids.includes(id)),
            ),
        ),
    )?.reading_id
}

export function reading_groups(chapter) {
    const units = new Map(chapter.source_units.map((unit) => [unit.unit_id, unit]))
    const seen = new Map()
    return chapter.readings.map((reading) => ({
        ...reading,
        blocks: reading.source_refs.map((ref) => {
            const key = JSON.stringify([ref.packet_id, ref.part_ids, reading.mode])
            if (seen.has(key)) return { repeat: seen.get(key) }
            seen.set(key, reading.reading_id)
            return {
                packet_id: ref.packet_id,
                parts: ref.part_ids.map((id) => units.get(`${ref.packet_id}:${id}`)),
            }
        }),
    }))
}
