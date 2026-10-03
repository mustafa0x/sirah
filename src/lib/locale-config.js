import locale_config from '../../locales.config.json' with { type: 'json' }

export const default_language = locale_config.source_locale
export const locales = locale_config.locales

const locale_by_code = new Map(locales.map((locale) => [locale.code, locale]))

export function normalize_language(language) {
    const normalized = String(language ?? '')
        .trim()
        .toLowerCase()
    if (locale_by_code.has(normalized)) return normalized
    const primary = normalized.split('-', 1)[0]
    return locale_by_code.has(primary) ? primary : default_language
}

export function language_direction(language) {
    return locale_by_code.get(normalize_language(language)).direction
}
