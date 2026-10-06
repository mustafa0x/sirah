import { current_question, inspect_practice_source, return_to_practice } from './hijrah-practice.js'

// Do not let a completed verification act on a different session or question.
export async function toggle_practice_source(session, current_session, packet, verify, apply) {
    const question_id = current_question(session)?.question_id
    if (!question_id) return false
    if (session.source_open) {
        if (current_session() !== session || current_question(session)?.question_id !== question_id)
            return false
        return_to_practice(session)
        apply([])
        return true
    }
    if (!await verify(packet)) throw new Error('Practice source text hash changed')
    if (current_session() !== session || current_question(session)?.question_id !== question_id)
        return false
    apply(inspect_practice_source(session, packet))
    return true
}
