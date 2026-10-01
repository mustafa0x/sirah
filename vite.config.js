import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [svelte()],
    publicDir: false,
    build: {
        assetsInlineLimit: 0,
        manifest: true,
    },
    server: {
        host: '127.0.0.1',
        port: 5100,
        strictPort: true,
        proxy: {
            '/api': 'http://127.0.0.1:8000',
        },
    },
})
