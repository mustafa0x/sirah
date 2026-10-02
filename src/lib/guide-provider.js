// Provider seam: the approved runtime endpoint is notified first. This local answer is
// intentionally finite and source-bounded; it is not a general chat model.
export function local_guide_answer(question, source_ids = []) {
    const text = question.toLowerCase()
    const cited = (...ids) => ids.filter((source_id) => source_ids.includes(source_id))
    const available = (...ids) =>
        cited(...ids).length > 0 ? cited(...ids) : source_ids.slice(0, 2)
    if (
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
    if (text.includes('news') || text.includes('message') || /أخبار|الأخبار/.test(text)) {
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
        citations: source_ids.slice(0, 2),
        action: null,
    }
}

function valid_answer(value, source_ids) {
    return (
        value &&
        typeof value.answer === 'string' &&
        typeof value.status === 'string' &&
        Array.isArray(value.citations) &&
        value.citations.every((source_id) => source_ids.includes(source_id))
    )
}

export async function ask_guide(question, context) {
    const fallback = local_guide_answer(question, context.source_ids)
    // The demo endpoint only returns English; use the same bounded local answers in Arabic.
    if (document.documentElement.lang === 'ar') return fallback
    try {
        const response = await fetch('/api/guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, context }),
        })
        if (!response.ok) return fallback
        const answer = await response.json()
        return valid_answer(answer, context.source_ids) ? answer : fallback
    } catch {
        return fallback
    }
}
