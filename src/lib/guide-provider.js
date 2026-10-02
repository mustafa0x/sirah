// Provider seam: the approved runtime endpoint is notified first. This local answer is
// intentionally finite and source-bounded; it is not a general chat model.
export function local_guide_answer(question, source_ids = []) {
    const text = question.toLowerCase()
    if (text.includes('exact route') || text.includes('precise')) {
        return {
            answer: 'The draft source packet does not establish an exact route. It describes a coastal way, while this overview is schematic rather than a measured itinerary.',
            status: 'draft-local-provider',
            confidence: 'bounded',
            citations: ['E07'],
            action: null,
        }
    }
    if (text.includes('after') && (text.includes('cave') || text.includes('thawr'))) {
        return {
            answer: 'The account says that ‘Amir ibn Fuhayrah and the guide went with them, and that the guide led them by the coastal way. The guide’s personal name and the precise route are not established here.',
            status: 'draft-local-provider',
            confidence: 'bounded',
            citations: ['E06', 'E07'],
            action: { type: 'detour', step_id: 'onward', label: 'Show the onward journey' },
        }
    }
    return {
        answer: 'This draft chapter can answer questions only from its selected evidence. The available passage records are shown below; the source packet does not establish an answer to that question.',
        status: 'draft-local-provider',
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
