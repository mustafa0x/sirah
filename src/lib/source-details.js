// Presentation-only grouping; source units remain intact and in their original order.
export function source_details(units) {
    return {
        notes: [...new Set(units.map((unit) => unit.context_note).filter(Boolean))],
        groups: units.reduce((groups, unit) => {
            const previous = groups.at(-1)
            if (
                previous &&
                previous.kind === unit.kind &&
                previous.speaker === unit.speaker &&
                previous.source_url === unit.source_url &&
                previous.citation === unit.citation
            )
                previous.units.push(unit)
            else
                groups.push({
                    kind: unit.kind,
                    speaker: unit.speaker,
                    source_url: unit.source_url,
                    citation: unit.citation,
                    units: [unit],
                })
            return groups
        }, []),
    }
}
