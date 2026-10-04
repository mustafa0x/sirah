import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import domain from 'vite-plugin-domain'
import { wuchale } from 'wuchale/vite'
import { navigation_fallback } from './scripts/navigation-fallback.js'

export default defineConfig({
    plugins: [domain(), wuchale(), tailwindcss(), svelte({ inspector: true }), navigation_fallback],
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
        fs: {
            deny: [
                '.env',
                '.env.*',
                '**/*.{crt,pem}',
                '**/.git/**',
                '**/.mise.local.toml',
                '**/private/**',
                '**/docs/tests/evals/*holdout*',
            ],
        },
        proxy: {
            '/api': `http://127.0.0.1:${process.env.API_PORT || '8000'}`,
        },
    },
})
