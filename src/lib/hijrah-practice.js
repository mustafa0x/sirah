export function practice_questions(
    packet,
    difficulty,
    { step_id, include_source_study = false } = {},
) {
    if (!['beginner', 'intermediate', 'expert'].includes(difficulty))
        throw new Error('Unknown practice difficulty')
    return packet.questions.filter(
        (question) =>
            question.difficulty === difficulty &&
            (!step_id || question.step_id === step_id) &&
            (include_source_study || question.practice_scope === 'lesson'),
    )
}

export function create_practice(packet, questions) {
    if (questions.length === 0) throw new Error('No practice questions for this selection')
    if (new Set(questions.map((question) => question.question_id)).size !== questions.length)
        throw new Error('Duplicate practice question')
    if (questions.some((question) => !packet.questions.includes(question)))
        throw new Error('Question does not belong to this packet')
    return {
        packet_id: packet.packet_id,
        source_release_id: packet.source_release_id,
        source_document_sha256: packet.source_document_sha256,
        locale: packet.locale,
        questions,
        index: 0,
        answers: {},
        source_open: false,
        used_source: {},
    }
}

export function current_question(practice) {
    return practice.questions[practice.index] ?? null
}

export function submit_practice(practice, option_id) {
    const question = current_question(practice)
    if (!question) return false
    if (Object.hasOwn(practice.answers, question.question_id)) return false
    if (option_id !== null && !question.options.some((option) => option.option_id === option_id))
        throw new Error('Unknown practice option')
    practice.answers[question.question_id] = option_id
    return true
}

export function practice_feedback(practice) {
    const question = current_question(practice)
    if (!question || !Object.hasOwn(practice.answers, question.question_id)) return null
    const chosen = practice.answers[question.question_id]
    return {
        correct: chosen === question.correct_option_id,
        skipped: chosen === null,
        option_feedback_ar: question.options.find((option) => option.option_id === chosen)
            ?.feedback_ar,
        explanation_ar: question.explanation_ar,
        scope_note_ar: question.scope_note_ar,
        used_source: !!practice.used_source[question.question_id],
    }
}

export function next_practice(practice) {
    const question = current_question(practice)
    if (!question || !Object.hasOwn(practice.answers, question.question_id)) return false
    practice.source_open = false
    practice.index += 1
    return true
}

export function practice_score(practice) {
    const answered = practice.questions.filter((question) =>
        Object.hasOwn(practice.answers, question.question_id),
    )
    return {
        correct: answered.filter(
            (question) => practice.answers[question.question_id] === question.correct_option_id,
        ).length,
        attempted: answered.length,
        answered: answered.filter((question) => practice.answers[question.question_id] !== null)
            .length,
        skipped: answered.filter((question) => practice.answers[question.question_id] === null)
            .length,
        total: practice.questions.length,
    }
}

export function inspect_practice_source(practice, packet) {
    if (
        practice.packet_id !== packet.packet_id ||
        practice.source_release_id !== packet.source_release_id ||
        practice.source_document_sha256 !== packet.source_document_sha256 ||
        practice.locale !== packet.locale
    )
        throw new Error('Practice packet version changed')
    const question = current_question(practice)
    if (!question) return []
    const units = question.source_unit_ids.map((id) => {
        const unit = packet.source_units.find((source) => source.unit_id === id)
        if (!unit) throw new Error('Practice source missing')
        return unit
    })
    practice.used_source[question.question_id] = true
    practice.source_open = true
    return units
}

export function return_to_practice(practice) {
    practice.source_open = false
}
