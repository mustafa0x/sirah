// A small route-owned media clock. It accepts a real media element when one is
// approved later, but the first playable build deliberately ships without audio.
// Reading mode therefore has the same seek/cue path and no voice-rights claim.
export function create_media_clock({ duration, get_position, on_tick }) {
    let timer = null
    let disposed = false
    let playing = false
    let current = 0

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
        timer = window.setInterval(() => {
            current = Math.min(duration(), current + 0.1)
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
