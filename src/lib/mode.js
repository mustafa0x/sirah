import { details } from '../content/details.js'
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
    // Reload so the chapter is shaped for the new mode before anything is drawn.
    localStorage.setItem('sirah_mode', mode)
    location.reload()
}

let applied = false
// Shapes the shared chapter once, before the page uses it.
export function apply_mode(chapter, mode) {
    if (applied || mode !== 'young') return
    applied = true
    chapter.steps = chapter.steps.filter((step) => young_stages.includes(step.id))
    for (const step of chapter.steps) {
        for (const paragraph of step.paragraphs)
            paragraph.text = young_paragraphs[paragraph.id] ?? paragraph.text
        // Short sentences need less time on screen.
        step.duration = step.paragraphs.length * 9
    }
    for (const item of details) item.text = young_details[item.id] ?? item.text
}
