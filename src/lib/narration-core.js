const PAUSE = 0.9

export function time_chapter(chapter, resolve_clip) {
    for (const step of chapter.steps) {
        step.authored_duration ??= step.duration
        const fallback = step.authored_duration / step.paragraphs.length
        let cursor = 0
        for (const paragraph of step.paragraphs) {
            const item = resolve_clip(paragraph)
            paragraph.start = cursor
            paragraph.narrated = Boolean(item)
            // When each sentence starts in the clip, if the recording carries timings.
            paragraph.sentence_starts = item?.sentences ?? null
            // Where a recited verse begins in the clip, if the caption ends with one.
            paragraph.recitation_at = item?.recitation_at ?? null
            cursor += item ? item.seconds + PAUSE : fallback
            paragraph.end = cursor
        }
        step.duration = cursor
    }
    return chapter.steps.some((step) => step.paragraphs.some((paragraph) => paragraph.narrated))
}

export function narrator_player(resolve_clip, audio = new Audio()) {
    audio.preload = 'auto'
    let current = null
    let muted = true
    let last_seconds = 0
    let resumed = false
    let desired_offset = 0
    let disposed = false
    let waiting = false
    let failed = null
    let generation = 0
    let seek_requested = false
    const buffering = () => {
        waiting = true
    }
    const ready = () => {
        waiting = false
    }
    const failure = () => {
        failed = current
        waiting = false
    }
    const position = () => {
        if (!disposed && audio.readyState >= 1) audio.currentTime = desired_offset
    }
    audio.addEventListener('loadedmetadata', position)
    audio.addEventListener('waiting', buffering)
    audio.addEventListener('playing', ready)
    audio.addEventListener('ended', ready)
    audio.addEventListener('error', failure)

    return {
        can_advance() {
            return !waiting
        },
        seek() {
            seek_requested = true
        },
        set_muted(next) {
            muted = next
            failed = null
            if (muted) {
                generation += 1
                audio.pause()
                resumed = false
                waiting = false
            }
        },
        sync(paragraph, seconds, playing) {
            const item = paragraph?.narrated ? resolve_clip(paragraph) : null
            const offset = item ? Math.max(0, seconds - paragraph.start) : 0
            const jumped = seek_requested || Math.abs(seconds - last_seconds) > 0.75
            last_seconds = seconds
            if (
                disposed ||
                !item ||
                !playing ||
                muted ||
                offset >= item.seconds ||
                failed === item.url
            ) {
                generation += 1
                audio.pause()
                resumed = false
                waiting = false
                return
            }
            // MP3 gapless playback can end before ffprobe's padded duration. Never restart
            // the first syllable in that tiny tail; only an explicit seek may restart it.
            if (current === item.url && audio.ended && !jumped) {
                waiting = false
                return
            }
            if (current !== item.url) {
                current = item.url
                audio.src = item.url
                desired_offset = offset
                position()
            } else if (jumped || !resumed) {
                desired_offset = offset
                position()
            } else if (audio.readyState < 1) {
                desired_offset = offset
            }
            seek_requested = false
            resumed = true
            if (audio.paused) {
                waiting = true
                const ticket = ++generation
                audio.play().then(
                    () => {
                        if (ticket === generation) ready()
                    },
                    () => {
                        if (ticket === generation) failure()
                    },
                )
            }
        },
        dispose() {
            disposed = true
            generation += 1
            waiting = false
            audio.removeEventListener('loadedmetadata', position)
            audio.removeEventListener('waiting', buffering)
            audio.removeEventListener('playing', ready)
            audio.removeEventListener('ended', ready)
            audio.removeEventListener('error', failure)
            audio.pause()
            audio.removeAttribute('src')
        },
    }
}
