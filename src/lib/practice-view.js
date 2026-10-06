import packet from '../content/hijrah-practice.v3.ar.json'
import packet_text from '../content/hijrah-practice.v3.ar.json?raw'
import original from '../content/hijrah-practice.v2.ar.json'
import original_text from '../content/hijrah-practice.v2.ar.json?raw'
import baseline from '../content/hijrah-practice.ar.json'
import manifest from '../../docs/research/hijrah/learner/v2/manifest.json'
import manifest_text from '../../docs/research/hijrah/learner/v2/manifest.json?raw'
import receipt from '../../docs/research/hijrah/learner/v3/manifest.json'
import override from '../../docs/research/hijrah/learner/v3/assessment-v3.ar.json'
import override_text from '../../docs/research/hijrah/learner/v3/assessment-v3.ar.json?raw'
import arabic_review from '../../docs/research/hijrah/learner/v3/assessment-v3.ar.review.json'
import arabic_review_text from '../../docs/research/hijrah/learner/v3/assessment-v3.ar.review.json?raw'
import { practice_questions } from './hijrah-practice.js'
import { valid_packet, valid_packet_v3, verify_packet_v3, verify_locale_v3_bundle, compatible_quiz, compatible_reading, source_digest, verified_sources_once } from './practice-binding.js'

const translations = import.meta.glob('../../docs/research/hijrah/translations/*/quiz.json', {
    query: '?raw', import: 'default',
})
const readings = import.meta.glob('../../docs/research/hijrah/translations/*/readings.json', {
    query: '?raw', import: 'default',
})

const bundles = import.meta.glob('../../docs/research/hijrah/learner/v3/quiz.*.json', {
    query: '?raw', import: 'default',
})
const reviews = import.meta.glob('../../docs/research/hijrah/learner/v3/quiz.*.review.json', {
    query: '?raw', import: 'default',
})

if (!valid_packet(original, baseline, manifest) || !valid_packet_v3(packet, original, receipt, override))
    throw new Error('Practice evidence or wording binding failed')
let packet_verification
export { packet }
export const levels = ['beginner', 'intermediate', 'expert']
export const mode_levels = {
    young: { levels: ['beginner'], source_study: false },
    new: { levels: ['beginner', 'intermediate'], source_study: false },
    deep: { levels, source_study: true },
}


export async function load_wording(language) {
    packet_verification ??= verify_packet_v3(packet, packet_text, original, original_text, manifest_text,
        receipt, override, override_text, arabic_review, arabic_review_text)
    if (!await packet_verification || !await verified_sources_once(packet))
        throw new Error('Practice source text or wording hash changed')
    if (language === 'ar') return null
    for (const code of [language, 'en']) {
        const load_quiz = translations[`../../docs/research/hijrah/translations/${code}/quiz.json`]
        const load_readings = readings[`../../docs/research/hijrah/translations/${code}/readings.json`]
        const load_bundle = bundles[`../../docs/research/hijrah/learner/v3/quiz.${code}.json`]
        const load_review = reviews[`../../docs/research/hijrah/learner/v3/quiz.${code}.review.json`]
        if (!load_quiz || !load_readings || !load_bundle || !load_review) continue
        try {
            const [quiz_text, readings_text, bundle_text, review_text] =
                await Promise.all([load_quiz(), load_readings(), load_bundle(), load_review()])
            const bound = manifest.translation_compatibility.v1_packages[code]
            if (!bound || await source_digest(quiz_text) !== bound['quiz.json'] ||
                await source_digest(readings_text) !== bound['readings.json']) continue
            const quiz = JSON.parse(quiz_text)
            const source_readings = JSON.parse(readings_text)
            if (quiz.locale !== code || !compatible_quiz(quiz, baseline, original)) continue
            const checked = await verify_locale_v3_bundle(JSON.parse(bundle_text), bundle_text,
                JSON.parse(review_text), review_text, code, original, receipt)
            if (!checked) continue
            const questions = new Map(quiz.questions.map((question) => {
                const wording = checked.questions.get(question.question_id)
                return [question.question_id, wording ? {
                    ...question, ...wording,
                    options: wording.options.length ? question.options.map((option) => ({
                        ...option, ...wording.options.find((item) => item.option_id === option.option_id),
                    })) : question.options,
                } : question]
            }))
            const matched = new Map()
            for (const unit of packet.source_units) {
                const reading = source_readings[unit.unit_id]
                if (compatible_reading(reading, unit)) matched.set(unit.unit_id, reading)
            }
            return { language: code, questions, readings: matched }
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
