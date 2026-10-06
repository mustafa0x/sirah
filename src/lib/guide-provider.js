import { chapter } from '../content/first-chapter.js'

// Offline journey notes, not a substitute for model-led research.
function chapter_note_answer(question, source_ids = []) {
    const text = question.trim().toLowerCase()
    const cited = (...ids) => ids.filter((source_id) => source_ids.includes(source_id))
    const available = (...ids) => (cited(...ids).length === ids.length ? cited(...ids) : [])
    if (
        text === 'Is the exact route known?'.toLowerCase() ||
        text.includes('exact route') ||
        text.includes('precise') ||
        /المسار الدقيق|الطريق الدقيق/.test(text)
    ) {
        return {
            answer: 'The selected evidence does not establish an exact route. It describes a coastal way, while this overview is schematic rather than a measured itinerary.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E07'),
            action: null,
        }
    }
    if (
        text === 'How did the journey continue after the cave?'.toLowerCase() ||
        (text.includes('after') && (text.includes('cave') || text.includes('thawr'))) ||
        /بعد.*(?:الغار|الكهف|ثور)/.test(text)
    ) {
        return {
            answer: '‘Amir ibn Fuhayrah and the guide went with them when they continued, and the guide led them by the coastal way. The guide’s personal name and the precise route are not established here.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E06', 'E07'),
            action: { type: 'detour', step_id: 'onward', label: 'Show the onward journey' },
        }
    }
    if (
        text === 'Who brought them news?'.toLowerCase() ||
        text.includes('news') ||
        text.includes('message') ||
        /أخبار|الأخبار/.test(text)
    ) {
        return {
            answer: '‘Abdullah ibn Abi Bakr brought news of plans against them after darkness and returned to Makkah before daybreak.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E04'),
            action: null,
        }
    }
    if (
        text.includes('milk') ||
        text.includes('sheep') ||
        text.includes('amir') ||
        /حليب|غنم|عامر|لبن.*(?:الغار|الكهف)|(?:الغار|الكهف).*لبن/.test(text)
    ) {
        return {
            answer: '‘Amir ibn Fuhayrah tended the flock and brought milk near the cave during the three nights.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E05'),
            action: null,
        }
    }
    if (text.includes('guide') || text.includes('coastal') || /دليل|ساحل|سواحل/.test(text)) {
        return {
            answer: 'They hired a skilled guide, entrusted him with two riding animals, and arranged to meet him at Thawr. The account says he led them by the coastal way.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E06', 'E07'),
            action: null,
        }
    }
    if (
        text === 'How long did they stay in the cave?'.toLowerCase() ||
        text.includes('how long') ||
        text.includes('how many nights') ||
        text.includes('three nights') ||
        /(?:كم|مدة).*(?:مكث|بقوا|أقام|الغار|الكهف|ليل)|ثلاث ليال/.test(text)
    ) {
        return {
            answer: 'The selected account says that they remained in the cave for three nights.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E03'),
            action: null,
        }
    }
    if (
        text.includes('asma') ||
        text.includes('provision') ||
        text.includes('food') ||
        /أسماء|زاد|طعام/.test(text)
    ) {
        return {
            answer: 'The preparations account describes provisions packed in a bag and Asma bint Abi Bakr using part of her waist-belt to tie its opening.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E01', 'E02'),
            action: null,
        }
    }
    if (
        text.includes('arrival') ||
        text.includes('madi') ||
        text.includes('mosque') ||
        /وصول|المدينة|مسجد/.test(text)
    ) {
        return {
            answer: 'The arrival account describes Muslims waiting, the stay among Bani ‘Amr ibn ‘Awf, and later building work at the mosque site.',
            status: 'local-bounded',
            confidence: 'bounded',
            citations: available('E11', 'E12'),
            action: null,
        }
    }
    return {
        answer: 'The selected evidence does not establish an answer to that question. The available source records are shown below.',
        status: 'local-bounded',
        confidence: 'bounded',
        citations: [],
        action: null,
    }
}

export function local_guide_answer(question, source_ids = [], language = 'en') {
    const answer = chapter_note_answer(question, source_ids)
    return answer.citations.length
        ? { ...answer, provider: 'local', sources: [], language: 'en' }
        : {
              answer: 'The offline journey notes do not establish an answer to that question.',
              status: 'local-bounded',
              provider: 'local',
              language: 'en',
              confidence: 'bounded',
              citations: [],
              sources: [],
              action: null,
          }
}

export function valid_answer(value) {
    if (
        !value ||
        value.provider !== 'openai-turath' ||
        !['answered', 'not_in_sources', 'clarify', 'out_of_scope'].includes(value.status) ||
        typeof value.answer !== 'string' ||
        !value.answer.trim() ||
        value.answer.length > 12000 ||
        !Array.isArray(value.sources) ||
        value.sources.length > 8 ||
        !Array.isArray(value.citations) ||
        value.citations.length > 8
    )
        return false
    const ids = new Set()
    for (const source of value.sources) {
        if (
            !source ||
            typeof source.id !== 'string' ||
            (!source.id.startsWith('tr_') &&
                !(source.cached && chapter.sources.some((item) => item.id === source.id))) ||
            ids.has(source.id) ||
            !['reference', 'work', 'excerpt', 'url'].every(
                (key) => typeof source[key] === 'string' && source[key].length,
            )
        )
            return false
        try {
            const url = new URL(source.url)
            if (
                url.protocol !== 'https:' ||
                !['app.turath.io', 'turath.io', 'api.turath.io'].includes(url.hostname) ||
                url.username ||
                url.password
            )
                return false
        } catch {
            return false
        }
        ids.add(source.id)
    }
    if (
        !value.citations.every((id) => ids.has(id)) ||
        new Set(value.citations).size !== value.citations.length ||
        (value.status === 'answered' && !value.citations.length)
    )
        return false
    return (
        value.action === null ||
        (value.status === 'answered' &&
            value.action?.type === 'detour' &&
            chapter.steps.some((step) => step.id === value.action.step_id) &&
            typeof value.action.label === 'string' &&
            value.action.label.length > 0 &&
            value.action.label.length <= 120)
    )
}

function available_action(answer, step_ids) {
    return answer.action && step_ids && !step_ids.includes(answer.action.step_id)
        ? { ...answer, action: null }
        : answer
}

export async function ask_guide(question, context, turnstile_token) {
    const fallback = available_action(
        local_guide_answer(question, context.source_ids, context.language),
        context.available_step_ids,
    )
    try {
        const response = await fetch('/api/guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, context, turnstile_token }),
            signal: AbortSignal.timeout(100000),
        })
        if (!response.ok) return fallback
        const answer = await response.json()
        return valid_answer(answer)
            ? available_action(answer, context.available_step_ids)
            : fallback
    } catch {
        return fallback
    }
}
