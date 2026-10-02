import Navgo from 'navgo'
import { mount } from 'svelte'
import { init_i18n } from './lib/i18n.js'
import './style.css'

;(async () => {
    await init_i18n()
    const [{ default: App }, Journey] = await Promise.all([
        import('./App.svelte'),
        import('./routes/Journey.svelte'),
    ])
    const props = $state({ Component: null, is_404: false })
    const router = new Navgo([['/', Journey]], {
        after_navigate(nav) {
            props.is_404 = nav.status === 404
            props.Component = nav.to?.route?.[1]?.default
        },
    })
    await router.init()
    mount(App, { target: document.body, props })
})().catch((error) => {
    document.body.textContent = `Sirah Journey could not start: ${error.message}`
})
