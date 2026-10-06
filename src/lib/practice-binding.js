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

export function compatible_reading(reading, unit) {
    return reading?.unit_id === unit.unit_id && reading.evidence_id === unit.evidence_id &&
        reading.source_start === unit.source_start && reading.source_end === unit.source_end &&
        reading.source_text_sha256 === unit.source_text_sha256 && reading.original_text_ar === unit.text_ar &&
        reading.source_url === unit.source_url && reading.kind_ar === unit.kind_ar &&
        reading.speaker_ar === unit.speaker_ar && reading.book_ar === unit.book_ar &&
        reading.citation_ar === unit.citation_ar &&
        ['translated_text', 'book', 'speaker', 'kind'].every((key) => typeof reading[key] === 'string' && !!reading[key].trim())
}
