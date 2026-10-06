export async function source_digest(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verified_sources(packet) {
    for (const unit of packet.source_units)
        if (await source_digest(unit.text_ar) !== unit.source_text_sha256) return false
    return true
}

const verified_packets = new WeakMap()

export function verified_sources_once(packet) {
    if (!verified_packets.has(packet)) verified_packets.set(packet, verified_sources(packet))
    return verified_packets.get(packet)
}

function rank(value) {
    let hash = 2166136261
    for (const character of value) hash = Math.imul(hash ^ character.codePointAt(0), 16777619)
    return hash >>> 0
}

export function worded(question, wording) {
    const local = wording?.questions.get(question.question_id)
    const option = (id) => local?.options.find((item) => item.option_id === id)
    return {
        prompt: local?.prompt ?? question.prompt_ar,
        explanation: local?.explanation ?? question.explanation_ar,
        scope_note: local?.scope_note ?? question.scope_note_ar,
        language: local ? wording.language : 'ar',
        options: question.options.map((item) => ({
            id: item.option_id,
            text: option(item.option_id)?.text ?? item.text_ar,
            feedback: option(item.option_id)?.feedback ?? item.feedback_ar,
        })).sort((a, b) => rank(question.question_id + ':' + a.id) - rank(question.question_id + ':' + b.id)),
        translated: Boolean(local),
    }
}

export function reading_for(unit, wording) {
    const reading = wording?.readings.get(unit.unit_id)
    return {
        ...unit,
        text: reading?.translated_text ?? unit.text_ar,
        book: reading?.book ?? unit.book_ar,
        speaker: reading?.speaker ?? unit.speaker_ar,
        kind: reading?.kind ?? unit.kind_ar,
        context: reading?.context_note ?? unit.context_note_ar,
        language: reading ? wording.language : 'ar',
    }
}


const e03_ids = [1, 2, 3].map((n) => 'H-1655-1021-CRIT-SHAFIIUMAR:p' + n)

function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b)
}

export function valid_packet(value, original, receipt) {
    if (
        value.schema_version !== 2 || value.packet_id !== receipt.packet_id ||
        value.source_release_id !== original.source_release_id ||
        value.source_release_id !== receipt.source_release_id ||
        value.source_document_sha256 !== original.source_document_sha256 ||
        value.source_document_sha256 !== receipt.source_document_sha256 ||
        value.questions.length !== original.questions.length ||
        !same(value.lesson, original.lesson)
    ) return false
    for (const [index, question] of value.questions.entries()) {
        const prior = original.questions[index]
        if (!prior || question.question_id !== prior.question_id ||
            !same(question.options, prior.options) || question.correct_option_id !== prior.correct_option_id ||
            !same({ ...question, source_unit_ids: prior.source_unit_ids }, prior) ||
            !same(question.source_unit_ids, question.question_id === 'HQ-E03' ? e03_ids : prior.source_unit_ids)) return false
    }
    if (value.source_units.length !== original.source_units.length + 2 ||
        !same(value.source_units.slice(0, original.source_units.length), original.source_units)) return false
    for (const [index, id] of e03_ids.entries()) {
        const unit = value.source_units.find((item) => item.unit_id === id)
        const bound = receipt.e03_ordered_parts[index]
        if (!unit || !bound || !Object.entries(bound).every(([key, expected]) => unit[key] === expected) ||
            [...unit.text_ar].length !== unit.source_end - unit.source_start ||
            unit.source_url !== value.source_units.find((item) => item.unit_id === e03_ids[0]).source_url) return false
    }
    return value.source_units.at(-2).kind_ar === 'قرآن منقول ضمن خبر الشافعي' &&
        value.source_units.at(-1).text_ar.includes('سِوَارَيْ') &&
        value.source_units[0].unit_id === original.source_units[0].unit_id
}

export function compatible_quiz(file, original, current) {
    if (file?.source_release_id !== current.source_release_id || file.question_type !== current.question_type ||
        file.questions?.length !== original.questions.length) return false
    return file.questions.every((question, index) => {
        const prior = original.questions[index]
        const now = current.questions[index]
        return question.question_id === prior.question_id && question.question_id === now.question_id &&
            question.correct_option_id === now.correct_option_id &&
            same(question.source_unit_ids, prior.source_unit_ids) &&
            same(question.options.map((option) => option.option_id), now.options.map((option) => option.option_id)) &&
            question.options.every((option) => typeof option.text === 'string' && typeof option.feedback === 'string') &&
            ['prompt', 'explanation', 'scope_note'].every((key) => typeof question[key] === 'string')
    })
}

const v3_question_ids = ['HQ-E01', 'HQ-E02', 'HQ-E03']
const v3_locales = ['am', 'bn', 'de', 'en', 'fa', 'fr', 'ha', 'hi', 'id', 'ms', 'nl', 'ps', 'si', 'so', 'sw', 'ta', 'th', 'tr', 'ur']
const v3_slots = {
    'HQ-E01': ['prompt_ar'],
    'HQ-E02': ['prompt_ar'],
    'HQ-E03': ['prompt_ar', 'explanation_ar', 'scope_note_ar', 'options'],
}
const v2_packet_sha256 = 'ec13e45a7812997dc00dd060956d3f76a5db8c91e279528eadc9277cecb8b04d'
const v2_manifest_sha256 = '0a526591ddd1676c9635a16829dbdb286664985ecb6a347792983f27fbef052f'

function canonical_json(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical_json).join(',') + ']'
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical_json(value[key])).join(',') + '}'
    return JSON.stringify(value)
}

function exact_keys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
        canonical_json(Object.keys(value).sort()) === canonical_json([...keys].sort())
}

function v3_text(value, allow_empty = false) {
    return typeof value === 'string' && (allow_empty || value.trim().length > 0) && !/[<>]/.test(value)
}

function validate_v3_override(override, original, manifest) {
    if (!exact_keys(override, ['source_release_id', 'v2_packet_sha256', 'v2_manifest_sha256', 'reviewed', 'independent_language_approval', 'question_ids', 'questions']) ||
        override.source_release_id !== original.source_release_id || override.v2_packet_sha256 !== v2_packet_sha256 ||
        override.v2_manifest_sha256 !== v2_manifest_sha256 || override.reviewed !== true ||
        override.independent_language_approval !== false || canonical_json(override.question_ids) !== canonical_json(v3_question_ids) ||
        canonical_json(manifest.question_ids) !== canonical_json(v3_question_ids) ||
        !exact_keys(override.questions, v3_question_ids)) return false
    const originals = new Map(original.questions.map((question) => [question.question_id, question]))
    return v3_question_ids.every((qid) => {
        const wording = override.questions[qid]
        if (!exact_keys(wording, v3_slots[qid])) return false
        if (!v3_slots[qid].filter((key) => key !== 'options').every((key) => v3_text(wording[key], qid === 'HQ-E03' && key === 'scope_note_ar'))) return false
        if (qid !== 'HQ-E03') return true
        const option_ids = originals.get(qid)?.options.map((option) => option.option_id) ?? []
        if (!exact_keys(wording.options, option_ids)) return false
        return option_ids.every((id) => exact_keys(wording.options[id], ['text_ar', 'feedback_ar']) &&
            v3_text(wording.options[id].text_ar) && v3_text(wording.options[id].feedback_ar))
    })
}

function v3_manifest_valid(manifest, original) {
    return exact_keys(manifest, ['schema_version', 'packet_id', 'source_release_id', 'source_document_sha256', 'v2_packet_sha256', 'v2_manifest_sha256', 'arabic_override_sha256', 'arabic_review_sha256', 'arabic_review_target_sha256', 'question_ids', 'independent_language_approval', 'specialist_approval', 'public_distribution_approved', 'outputs', 'arabic_review', 'translations', 'translation_reviews']) &&
        manifest.schema_version === 3 && manifest.packet_id === 'hijrah-practice-ar-demo-v3' &&
        manifest.source_release_id === original.source_release_id && manifest.source_document_sha256 === original.source_document_sha256 &&
        manifest.v2_packet_sha256 === v2_packet_sha256 && manifest.v2_manifest_sha256 === v2_manifest_sha256 &&
        manifest.independent_language_approval === false && manifest.specialist_approval === false && manifest.public_distribution_approved === false &&
        exact_keys(manifest.outputs, ['packet', 'quiz.ar.json', 'assessment-v3.ar.json', 'assessment-v3.ar.review.json']) &&
        exact_keys(manifest.arabic_review, ['review_sha256', 'target_sha256']) &&
        manifest.arabic_review.review_sha256 === manifest.arabic_review_sha256 &&
        manifest.arabic_review.target_sha256 === manifest.arabic_review_target_sha256 &&
        canonical_json(Object.keys(manifest.translations ?? {}).sort()) === canonical_json(v3_locales) &&
        canonical_json(Object.keys(manifest.translation_reviews ?? {}).sort()) === canonical_json(v3_locales) &&
        /^[a-f0-9]{64}$/.test(manifest.arabic_override_sha256) &&
        /^[a-f0-9]{64}$/.test(manifest.arabic_review_sha256) &&
        /^[a-f0-9]{64}$/.test(manifest.arabic_review_target_sha256) &&
        Object.values(manifest.outputs).every((hash) => /^[a-f0-9]{64}$/.test(hash)) &&
        v3_locales.every((locale) => /^[a-f0-9]{64}$/.test(manifest.translations[locale]) &&
            exact_keys(manifest.translation_reviews[locale], ['review_sha256', 'target_sha256', 'question_ids']) &&
            /^[a-f0-9]{64}$/.test(manifest.translation_reviews[locale].review_sha256) &&
            /^[a-f0-9]{64}$/.test(manifest.translation_reviews[locale].target_sha256) &&
            canonical_json(manifest.translation_reviews[locale].question_ids) === canonical_json(v3_question_ids))
}

export function valid_packet_v3(value, original, manifest, override) {
    if (!v3_manifest_valid(manifest, original) || !validate_v3_override(override, original, manifest) ||
        manifest.arabic_override_sha256.length !== 64 || manifest.arabic_review_sha256.length !== 64 ||
        manifest.arabic_review_target_sha256.length !== 64 || !/^[a-f0-9]{64}$/.test(manifest.outputs.packet)) return false
    const expected = structuredClone(original)
    expected.schema_version = 3
    expected.packet_id = manifest.packet_id
    const originals = new Map(expected.questions.map((question) => [question.question_id, question]))
    for (const qid of v3_question_ids) {
        const question = originals.get(qid)
        const wording = override.questions[qid]
        for (const field of v3_slots[qid]) {
            if (field !== 'options') question[field] = wording[field]
        }
        if (qid === 'HQ-E03') {
            for (const option of question.options) {
                option.text_ar = wording.options[option.option_id].text_ar
                option.feedback_ar = wording.options[option.option_id].feedback_ar
            }
        }
    }
    return canonical_json(value) === canonical_json(expected)
}

function valid_v3_review(review, locale, release, override_digest, target_digest) {
    return exact_keys(review, ['locale', 'source_release_id', 'arabic_override_sha256', 'target_sha256', 'question_ids', 'findings', 'summary', 'independent_language_approval', 'specialist_approval', 'public_distribution_approved']) &&
        review.locale === locale && review.source_release_id === release && review.arabic_override_sha256 === override_digest &&
        review.target_sha256 === target_digest && canonical_json(review.question_ids) === canonical_json(v3_question_ids) &&
        Array.isArray(review.findings) && review.findings.length === 0 && typeof review.summary === 'string' && review.summary.trim() &&
        review.independent_language_approval === false && review.specialist_approval === false && review.public_distribution_approved === false
}

export async function verify_packet_v3(packet, packet_text, original, original_packet_text, original_manifest_text, manifest, override, override_text, arabic_review, arabic_review_text) {
    if (await source_digest(original_manifest_text) !== v2_manifest_sha256) return false
    const original_manifest = JSON.parse(original_manifest_text)
    const override_digest = await source_digest(canonical_json(override))
    return await source_digest(original_packet_text) === v2_packet_sha256 &&
        await source_digest(original_manifest_text) === v2_manifest_sha256 &&
        original_manifest.outputs?.['src/content/hijrah-practice.v2.ar.json'] === v2_packet_sha256 &&
        await source_digest(packet_text) === manifest.outputs?.packet &&
        await source_digest(override_text) === manifest.arabic_review_target_sha256 &&
        await source_digest(override_text) === manifest.outputs['assessment-v3.ar.json'] &&
        await source_digest(arabic_review_text) === manifest.arabic_review_sha256 &&
        await source_digest(arabic_review_text) === manifest.outputs['assessment-v3.ar.review.json'] &&
        override_digest === manifest.arabic_override_sha256 &&
        valid_v3_review(arabic_review, 'ar', original.source_release_id, override_digest, await source_digest(override_text)) &&
        valid_packet_v3(packet, original, manifest, override) &&
        canonical_json(packet) === canonical_json(JSON.parse(packet_text)) &&
        canonical_json(original) === canonical_json(JSON.parse(original_packet_text)) &&
        canonical_json(override) === canonical_json(JSON.parse(override_text)) &&
        canonical_json(arabic_review) === canonical_json(JSON.parse(arabic_review_text))
}

export async function verify_locale_v3_bundle(bundle, bundle_text, review, review_text, locale, original, manifest) {
    if (!v3_locales.includes(locale) || !v3_manifest_valid(manifest, original) ||
        !exact_keys(bundle, ['locale', 'source_release_id', 'arabic_override_sha256', 'questions']) ||
        bundle.locale !== locale || bundle.source_release_id !== manifest.source_release_id ||
        bundle.arabic_override_sha256 !== manifest.arabic_override_sha256 ||
        await source_digest(bundle_text) !== manifest.translations[locale] ||
        await source_digest(review_text) !== manifest.translation_reviews[locale].review_sha256 ||
        await source_digest(bundle_text) !== manifest.translation_reviews[locale].target_sha256 ||
        !valid_v3_review(review, locale, manifest.source_release_id, manifest.arabic_override_sha256, await source_digest(bundle_text))) return null
    if (canonical_json(bundle) !== canonical_json(JSON.parse(bundle_text)) ||
        canonical_json(review) !== canonical_json(JSON.parse(review_text))) return null
    if (!exact_keys(bundle.questions, v3_question_ids)) return null
    const questions = new Map(original.questions.map((question) => [question.question_id, question]))
    for (const qid of v3_question_ids) {
        const wording = bundle.questions[qid]
        const expected = qid === 'HQ-E03' ? ['prompt', 'explanation', 'scope_note', 'options'] : ['prompt']
        if (!exact_keys(wording, expected)) return null
        for (const field of expected.filter((key) => key !== 'options'))
            if (!v3_text(wording[field], field === 'scope_note' && qid === 'HQ-E03')) return null
        if (qid === 'HQ-E03') {
            const options = questions.get(qid).options
            const option_ids = options.map((option) => option.option_id)
            if (!exact_keys(wording.options, option_ids)) return null
            for (const id of option_ids)
                if (!exact_keys(wording.options[id], ['text', 'feedback']) || !v3_text(wording.options[id].text) || !v3_text(wording.options[id].feedback)) return null
        }
    }
    const local_questions = Object.entries(bundle.questions).map(([question_id, wording]) => [question_id, {
        ...wording,
        options: wording.options ? Object.entries(wording.options).map(([option_id, option]) => ({ option_id, ...option })) : [],
    }])
    return { language: locale, questions: new Map(local_questions) }
}

export function compatible_reading(reading, unit) {
    return reading?.unit_id === unit.unit_id && reading.evidence_id === unit.evidence_id &&
        reading.source_start === unit.source_start && reading.source_end === unit.source_end &&
        reading.source_text_sha256 === unit.source_text_sha256 && reading.original_text_ar === unit.text_ar &&
        reading.source_url === unit.source_url && reading.kind_ar === unit.kind_ar &&
        reading.speaker_ar === unit.speaker_ar && reading.book_ar === unit.book_ar &&
        reading.citation_ar === unit.citation_ar &&
        ['translated_text', 'book', 'speaker', 'kind'].every((key) => typeof reading[key] === 'string' && !!reading[key].trim())
}
