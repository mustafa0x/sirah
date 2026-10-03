import { loadLocale } from 'wuchale/load-utils'
import { default_language, language_direction, normalize_language } from './locale-config.js'

export function saved_language() {
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
    localStorage.setItem('sirah_language', normalize_language(language))
    location.reload()
}
