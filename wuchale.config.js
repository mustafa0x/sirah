import { adapter as svelte } from '@wuchale/svelte'
import { defaultHeuristic, defineConfig } from 'wuchale'
import { adapter as vanilla } from 'wuchale/adapter-vanilla'
import { locales } from './src/lib/locale-config.js'

const heuristic = (message) => {
    const body = Array.isArray(message.body) ? message.body.join(' ') : message.body
    // Leave source quotations, keyboard codes, and styling untouched.
    // Lowercase identifiers (place keys, actor names) are data, never wording.
    if (/^[a-z][a-z0-9_]*$/.test(body)) return false
    if (
        !/[A-Za-z]/.test(body) ||
        ['Enter', 'Escape', 'ArrowRight', 'ArrowLeft', 'English'].includes(body)
    )
        return false
    if (
        message.path.some(
            (scope) =>
                scope.type === 'property' &&
                ['id', 'source_ids', 'source_unit_id', 'scene', 'place', 'context_step', 'step_id'].includes(
                    scope.name,
                ),
        )
    )
        return false
    if (
        message.path.some(
            (scope) =>
                (scope.type === 'attribute' &&
                    ['class', 'style', 'id', 'src', 'href'].includes(scope.name)) ||
                (scope.type === 'assignment' &&
                    scope.targets?.some((target) =>
                        ['primary_button', 'ghost_button'].includes(target),
                    )),
        )
    )
        return false
    if (
        message.path.some(
            (scope) =>
                scope.type === 'property' &&
                (['title', 'text', 'description', 'label', 'answer', 'review_status'].includes(
                    scope.name,
                ) ||
                    /^N\d{2}[a-z]$/.test(scope.name)),
        )
    )
        return 'message'
    return defaultHeuristic(message)
}

export default defineConfig({
    locales: locales.map((locale) => locale.code),
    localesDir: 'src/locales',
    dev: 'read',
    ai: null,
    adapters: {
        main: svelte({ files: ['src/**/*.svelte'], heuristic, loader: 'svelte' }),
        js: vanilla({
            files: [
                'src/content/text.generated.js',
                'src/content/first-chapter.js',
                'src/content/details.js',
                'src/content/timeline.js',
                'src/content/lenses.js',
                'src/lib/scene-manifest.js',
                'src/lib/guide-provider.js',
                'src/lib/journey-state.js',
            ],
            heuristic,
            runtime: { initReactive: () => false },
            loader: 'vite',
        }),
    },
})
