import { cue_for } from '../content/first-chapter.js'
import { young_details, young_paragraphs, young_stages } from '../content/lenses.js'

export const modes = ['young', 'new', 'deep']

export function saved_mode() {
    try {
        const mode = localStorage.getItem('sirah_mode')
        return modes.includes(mode) ? mode : 'new'
    } catch {
        return 'new'
    }
}

export function change_mode(mode) {
    if (!modes.includes(mode)) throw new Error('Unknown learning mode')
    try {
        localStorage.setItem('sirah_mode', mode)
    } catch {
        // The current session still works when preference storage is unavailable.
    }
}

export function create_mode_chapter(source, mode, keep_steps = []) {
    return {
        ...source,
        steps: source.steps
            .filter(
                (step) =>
                    mode !== 'young' ||
                    young_stages.includes(step.id) ||
                    keep_steps.includes(step.id),
            )
            .map((step) => ({
                ...step,
                duration: mode === 'young' ? step.paragraphs.length * 9 : step.duration,
                paragraphs: step.paragraphs.map(({ start, end, ...paragraph }) => ({
                    ...paragraph,
                    text:
                        mode === 'young'
                            ? (young_paragraphs[paragraph.id] ?? paragraph.text)
                            : paragraph.text,
                    narration_variant: mode === 'young' ? 'young' : 'standard',
                })),
            })),
    }
}

export function mode_detail(detail, mode) {
    return mode === 'young' ? { ...detail, text: young_details[detail.id] ?? detail.text } : detail
}

// Keep the current paragraph and relative progress when narration lengths change.
export function remap_position(previous, next, seconds) {
    if (seconds >= previous.duration) return next.duration
    const paragraph = cue_for(previous, seconds)
    const position = previous.paragraphs.indexOf(paragraph)
    const target = next.paragraphs.find((item) => item.id === paragraph.id)
    if (!target) return 0
    const start = paragraph.start ?? (position * previous.duration) / previous.paragraphs.length
    const end = paragraph.end ?? ((position + 1) * previous.duration) / previous.paragraphs.length
    const target_position = next.paragraphs.indexOf(target)
    const target_start = target.start ?? (target_position * next.duration) / next.paragraphs.length
    const target_end =
        target.end ?? ((target_position + 1) * next.duration) / next.paragraphs.length
    const progress = Math.max(0, Math.min(1, (seconds - start) / (end - start)))
    return target_start + progress * (target_end - target_start)
}
