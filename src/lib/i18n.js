import { loadLocale } from 'wuchale/load-utils'
import { default_language, language_direction, normalize_language } from './locale-config.js'

const arabic_digits = '٠١٢٣٤٥٦٧٨٩'

// Write numbers in Arabic digits when the interface is Arabic. Changing the
// language reloads the page, so reading the document language is enough.
export function fmt_num(value) {
    if (document.documentElement.lang !== 'ar') return value
    return String(value).replace(/[0-9]/g, (digit) => arabic_digits[digit])
}

export function saved_language() {
    const linked = new URL(location.href).searchParams.get('lang')
    if (linked) return normalize_language(linked)
    try {
        return normalize_language(localStorage.getItem('sirah_language'))
    } catch {
        return default_language
    }
}

export async function init_i18n() {
    await Promise.all([
        import('../locales/main.loader.svelte.js'),
        import('../locales/js.loader.js'),
    ])
    const language = saved_language()
    await loadLocale(language)
    document.documentElement.lang = language
    document.documentElement.dir = language_direction(language)
}

export function change_language(language) {
    // Reload so module-level chapter data is evaluated in the selected language too.
    const next = normalize_language(language)
    try {
        localStorage.setItem('sirah_language', next)
    } catch {
        // The link still works when preference storage is blocked.
    }
    const url = new URL(location.href)
    url.searchParams.set('lang', next)
    location.assign(url.href)
}
