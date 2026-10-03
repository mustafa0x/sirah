import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import domain from 'vite-plugin-domain'
import { wuchale } from 'wuchale/vite'

export default defineConfig({
    plugins: [domain(), wuchale(), tailwindcss(), svelte({ inspector: true })],
    publicDir: false,
    build: {
        assetsInlineLimit: 0,
        reportCompressedSize: false,
        manifest: true,
    },
    server: {
        host: '127.0.0.1',
        port: +(process.env.VITE_PORT || 5100),
        strictPort: true,
        proxy: {
            '/api': `http://127.0.0.1:${process.env.API_PORT || '8000'}`,
        },
    },
})
