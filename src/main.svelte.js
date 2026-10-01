import Navgo from 'navgo'
import { mount } from 'svelte'
import App from './App.svelte'
import * as Journey from './routes/Journey.svelte'
import './style.css'

const props = $state({ Component: null, is_404: false })
const routes = [['/', Journey]]

const router = new Navgo(routes, {
    after_navigate(nav) {
        props.is_404 = nav.status === 404
        props.Component = nav.to?.route?.[1]?.default
    },
})

;(async () => {
    await router.init()
    mount(App, { target: document.body, props })
})().catch((error) => {
    document.body.textContent = `Sirah Journey could not start: ${error.message}`
})
