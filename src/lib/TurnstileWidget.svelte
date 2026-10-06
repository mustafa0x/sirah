<script module>
    let loader

    function load_script() {
        if (window.turnstile?.render) return Promise.resolve(window.turnstile)
        if (!loader)
            loader = new Promise((resolve, reject) => {
                const script = document.createElement('script')
                const abort = () => {
                    script.remove()
                    loader = null
                    reject(new Error('turnstile_script_failed'))
                }
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
                script.async = true
                script.defer = true
                script.onload = () =>
                    window.turnstile?.render ? resolve(window.turnstile) : abort()
                script.onerror = abort
                document.head.append(script)
            })
        return loader
    }
</script>

<script>
    let { token = $bindable(''), failed = $bindable(false) } = $props()

    function mount(element) {
        let disposed = false
        let widget_id = null

        const fail = () => {
            if (!disposed) {
                token = ''
                failed = true
            }
            return true
        }
        ;(async () => {
            try {
                const turnstile = await load_script()
                if (disposed) return
                widget_id = turnstile.render(element, {
                    sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFPXMngw37dnzSUl',
                    action: 'guide',
                    appearance: 'interaction-only',
                    theme: 'dark',
                    size: element.clientWidth < 300 ? 'compact' : 'flexible',
                    'response-field': false,
                    retry: 'never',
                    callback: (value) => {
                        if (disposed) return
                        token = value
                        failed = false
                    },
                    'expired-callback': () => {
                        if (!disposed) token = ''
                    },
                    'timeout-callback': fail,
                    'error-callback': fail,
                    'unsupported-callback': fail,
                })
            } catch {
                fail()
            }
        })()

        return () => {
            disposed = true
            if (widget_id !== null) window.turnstile?.remove(widget_id)
            token = ''
            failed = false
        }
    }
</script>

<div class="w-full min-w-0 flex justify-center" {@attach mount}></div>
