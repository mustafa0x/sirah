// A small route-owned clock on real elapsed time. Captions, camera and narration all
// follow it, so stages with and without audio share one seek and cue path.
export function create_media_clock({ duration, can_advance = () => true, on_tick }) {
    let timer = null
    let disposed = false
    let playing = false
    let current = 0
    let last = 0

    function emit() {
        if (!disposed) on_tick(current, playing)
    }

    function stop() {
        if (timer) window.clearInterval(timer)
        timer = null
        playing = false
        emit()
    }

    function play() {
        if (disposed || playing) return false
        playing = true
        last = performance.now()
        timer = window.setInterval(() => {
            const now = performance.now()
            // A stalled tab resumes where it left off instead of jumping ahead.
            if (can_advance())
                current = Math.min(duration(), current + Math.min(0.5, (now - last) / 1000))
            last = now
            emit()
            if (current >= duration()) stop()
        }, 100)
        emit()
        return true
    }

    return {
        play,
        pause() {
            if (!disposed) stop()
        },
        seek(seconds) {
            if (disposed) return
            current = Math.max(0, Math.min(duration(), Number(seconds) || 0))
            emit()
        },
        set_position(seconds) {
            current = Math.max(0, Math.min(duration(), Number(seconds) || 0))
            emit()
        },
        snapshot() {
            return { seconds: current, playing }
        },
        dispose() {
            if (disposed) return
            disposed = true
            if (timer) window.clearInterval(timer)
            timer = null
            playing = false
        },
    }
}
