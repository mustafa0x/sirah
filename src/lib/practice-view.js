import packet from '../content/hijrah-practice.v2.ar.json'
import baseline from '../content/hijrah-practice.ar.json'
import manifest from '../../docs/research/hijrah/learner/v2/manifest.json'
import { practice_questions } from './hijrah-practice.js'
import { valid_packet, compatible_quiz, compatible_reading, source_digest, verified_sources_once } from './practice-binding.js'

const translations = import.meta.glob('../../docs/research/hijrah/translations/*/quiz.json', {
    query: '?raw', import: 'default',
})
const readings = import.meta.glob('../../docs/research/hijrah/translations/*/readings.json', {
    query: '?raw', import: 'default',
})

if (!valid_packet(packet, baseline, manifest)) throw new Error('Practice v2 evidence binding failed')
export { packet }
export const levels = ['beginner', 'intermediate', 'expert']
export const mode_levels = {
    young: { levels: ['beginner'], source_study: false },
    new: { levels: ['beginner', 'intermediate'], source_study: false },
    deep: { levels, source_study: true },
}


export async function load_wording(language) {
    if (!await verified_sources_once(packet)) throw new Error('Practice source text hash changed')
    if (language === 'ar') return null
    for (const code of [language, 'en']) {
        const load_quiz = translations[`../../docs/research/hijrah/translations/${code}/quiz.json`]
        const load_readings = readings[`../../docs/research/hijrah/translations/${code}/readings.json`]
        if (!load_quiz || !load_readings) continue
        try {
            const [quiz_text, readings_text] = await Promise.all([load_quiz(), load_readings()])
            const bound = manifest.translation_compatibility.v1_packages[code]
            if (!bound || await source_digest(quiz_text) !== bound['quiz.json'] ||
                await source_digest(readings_text) !== bound['readings.json']) continue
            const quiz = JSON.parse(quiz_text)
            const source_readings = JSON.parse(readings_text)
            if (quiz.locale !== code || !compatible_quiz(quiz, baseline, packet)) continue
            const matched = new Map()
            for (const unit of packet.source_units) {
                const reading = source_readings[unit.unit_id]
                if (compatible_reading(reading, unit)) matched.set(unit.unit_id, reading)
            }
            return { language: code, questions: new Map(quiz.questions.map((q) => [q.question_id, q])), readings: matched }
        } catch {
            // An incomplete locale never changes evidence or answer identity.
        }
    }
    return null
}

export { worded, reading_for } from './practice-binding.js'

export function questions_for(mode, { level, step_id } = {}) {
    const { levels: allowed, source_study } = mode_levels[mode] ?? mode_levels.new
    return (level ? [level] : allowed).flatMap((item) => allowed.includes(item)
        ? practice_questions(packet, item, { step_id, include_source_study: source_study }) : [])
}
