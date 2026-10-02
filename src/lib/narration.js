import index from '../assets/narration/index.json'

const files = import.meta.glob('../assets/narration/*/*.mp3', {
    eager: true,
    query: '?url',
    import: 'default',
})
// Silence left after each paragraph before the next begins.
const PAUSE = 0.9

const clip = (language, id) => {
    const url = files[`../assets/narration/${language}/${id}.mp3`]
    const entry = index[language]?.[id]
    return url && entry ? { url, seconds: entry.seconds } : null
}

// Where a stage has audio for every paragraph, its length and cue boundaries follow the
// audio. Stages without audio keep their authored length and equal cues.
export function apply_timings(chapter, language) {
    let narrated = false
    for (const step of chapter.steps) {
        const clips = step.paragraphs.map((paragraph) => clip(language, paragraph.id))
        if (clips.some((item) => !item)) continue
        narrated = true
        let cursor = 0
        step.paragraphs.forEach((paragraph, position) => {
            paragraph.start = cursor
            cursor = Math.round((cursor + clips[position].seconds + PAUSE) * 10) / 10
            paragraph.end = cursor
        })
        step.duration = cursor
    }
    return narrated
}

export function create_narrator(language) {
    const audio = new Audio()
    audio.preload = 'auto'
    let current = null
    let muted = true
    let last_seconds = 0
    // False until the audio has been positioned for the current run of playback.
    let resumed = false

    return {
        set_muted(next) {
            muted = next
            if (muted) audio.pause()
        },
        // Called on every clock tick. The audio is positioned when a paragraph starts and when
        // the learner jumps, then left to run: nudging it back into step is audible as a stutter.
        sync(paragraph, seconds, playing) {
            const item = paragraph?.end === undefined ? null : clip(language, paragraph.id)
            const offset = item ? seconds - paragraph.start : 0
            const jumped = Math.abs(seconds - last_seconds) > 0.75
            last_seconds = seconds
            if (!item || !playing || muted || offset >= item.seconds) {
                audio.pause()
                resumed = false
                return
            }
            if (current !== item.url) {
                current = item.url
                audio.src = item.url
                audio.currentTime = offset
            } else if (jumped || !resumed) audio.currentTime = offset
            resumed = true
            if (audio.paused) audio.play().catch(() => {})
        },
        dispose() {
            audio.pause()
            audio.removeAttribute('src')
        },
    }
}
