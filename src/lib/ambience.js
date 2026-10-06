// A synthesised desert wind bed. No recorded audio and no narration: just filtered noise,
// so there is nothing to license and nothing to download.
export function create_ambience() {
    let context = null
    let gain = null
    let filter = null
    let enabled = false
    let night = false
    let speaking = false

    function build() {
        context = new AudioContext()
        const seconds = 4
        const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
        const data = buffer.getChannelData(0)
        let last = 0
        for (let index = 0; index < data.length; index += 1) {
            // Brown noise: integrated white noise, which sounds like moving air.
            last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
            data[index] = last * 3.5
        }
        const noise = context.createBufferSource()
        noise.buffer = buffer
        noise.loop = true
        filter = context.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 420
        filter.Q.value = 0.5
        gain = context.createGain()
        gain.gain.value = 0
        // Slow gusts.
        const gust = context.createOscillator()
        gust.frequency.value = 0.07
        const gust_depth = context.createGain()
        gust_depth.gain.value = 160
        gust.connect(gust_depth).connect(filter.frequency)
        noise.connect(filter).connect(gain).connect(context.destination)
        noise.start()
        gust.start()
    }

    // A quiet bed under the narration: lower at night, lower still while the narrator speaks.
    function level() {
        const value = enabled ? (night ? 0.016 : 0.024) * (speaking ? 0.45 : 1) : 0
        gain?.gain.setTargetAtTime(value, context.currentTime, 0.8)
    }

    return {
        // Must be called from a user gesture the first time.
        set_enabled(next) {
            enabled = next
            if (enabled && !context) build()
            if (!context) return
            if (enabled) context.resume()
            level()
        },
        // Night is quieter and lower; open country by day is brighter.
        set_mood(mood) {
            if (!context) return
            night = mood === 'night'
            filter.frequency.setTargetAtTime(night ? 260 : 460, context.currentTime, 1.5)
            level()
        },
        set_speaking(next) {
            speaking = next
            if (context) level()
        },
        dispose() {
            context?.close()
            context = null
        },
    }
}
