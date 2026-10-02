import { loadLocale } from 'wuchale/load-utils'

export function saved_language() {
    try {
        return localStorage.getItem('sirah_language') === 'ar' ? 'ar' : 'en'
    } catch {
        return 'en'
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
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
}

export function change_language(language) {
    // Reload so module-level chapter data is evaluated in the selected language too.
    localStorage.setItem('sirah_language', language === 'ar' ? 'ar' : 'en')
    location.reload()
}
