import packet from '../content/hijrah-practice.ar.json'
import { practice_questions } from './hijrah-practice.js'

// Draft translations of the question bank, one file per language. The Arabic packet stays
// the source of truth: ids, answers and passages come from it, only the wording changes.
const translations = import.meta.glob('../../docs/research/hijrah/translations/*/quiz.json', {
    import: 'default',
})

export { packet }

export const levels = ['beginner', 'intermediate', 'expert']

// Which levels each mode offers, and whether optional source study is included.
export const mode_levels = {
    young: { levels: ['beginner'], source_study: false },
    new: { levels: ['beginner', 'intermediate'], source_study: false },
    deep: { levels: levels, source_study: true },
}

export async function load_wording(language) {
    if (language === 'ar') return null
    for (const code of [language, 'en']) {
        const load = translations[`../../docs/research/hijrah/translations/${code}/quiz.json`]
        if (!load) continue
        try {
            const file = await load()
            return new Map(file.questions.map((question) => [question.question_id, question]))
        } catch {
            // Fall through to the next language.
        }
    }
    return null
}

// The bank lists every correct answer first. Options are shown in a fixed order derived
// from their ids, so the answer cannot be found by position and stays put on a revisit.
function rank(text) {
    let hash = 2166136261
    for (const character of text) hash = Math.imul(hash ^ character.codePointAt(0), 16777619)
    return hash >>> 0
}

// A question's wording in the learner's language, or the Arabic original.
export function worded(question, wording) {
    const local = wording?.get(question.question_id)
    const option = (id) => local?.options.find((item) => item.option_id === id)
    return {
        prompt: local?.prompt ?? question.prompt_ar,
        explanation: local?.explanation ?? question.explanation_ar,
        scope_note: local?.scope_note ?? question.scope_note_ar,
        options: question.options
            .map((item) => ({
                id: item.option_id,
                text: option(item.option_id)?.text ?? item.text_ar,
                feedback: option(item.option_id)?.feedback ?? item.feedback_ar,
            }))
            .sort(
                (a, b) =>
                    rank(`${question.question_id}:${a.id}`) -
                    rank(`${question.question_id}:${b.id}`),
            ),
        translated: Boolean(local),
    }
}

export function questions_for(mode, { level, step_id } = {}) {
    const { levels: allowed, source_study } = mode_levels[mode] ?? mode_levels.new
    return (level ? [level] : allowed).flatMap((item) =>
        allowed.includes(item)
            ? practice_questions(packet, item, { step_id, include_source_study: source_study })
            : [],
    )
}
