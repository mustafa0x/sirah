// Finding glossary terms in text: whole words only, in any script, so that a short form
// (such as «المد») is not found inside a longer word (such as «المدينة»).
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function term_pattern(word, flags = 'u') {
    return new RegExp(`(?<![\\p{L}\\p{M}])${escape(word)}(?![\\p{L}\\p{M}])`, flags)
}

export function mentions(text, term) {
    return term.match.some((word) => term_pattern(word).test(text))
}
