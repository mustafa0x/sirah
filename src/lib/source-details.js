// Presentation-only grouping; note scopes and literal source order stay intact.
export function source_details(units) {
    const sections = []
    for (const unit of units) {
        let section = sections.at(-1)
        if (
            !section ||
            section.context_note !== unit.context_note ||
            section.context_note_ar !== unit.context_note_ar
        ) {
            section = {
                context_note: unit.context_note,
                context_note_ar: unit.context_note_ar,
                groups: [],
            }
            sections.push(section)
        }
        const group = section.groups.at(-1)
        if (
            group &&
            [
                'kind',
                'speaker',
                'kind_ar',
                'speaker_ar',
                'source_url',
                'citation',
                'citation_ar',
            ].every((key) => group[0][key] === unit[key])
        )
            group.push(unit)
        else section.groups.push([unit])
    }
    return sections
}
