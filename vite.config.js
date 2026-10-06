import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'node:path'
import { defineConfig } from 'vite'
import domain from 'vite-plugin-domain'
import { wuchale } from 'wuchale/vite'
import { navigation_fallback } from './scripts/navigation-fallback.js'
import { depth_stats_plugin } from './scripts/depth-stats.js'
import { content_plugin } from './scripts/content/compile.js'
import tsconfig from './tsconfig.json' with { type: 'json' }

export default defineConfig({
    resolve: {
        // '$lib/*': ['./src/lib/*'] => '$lib': <root>/src/lib
        alias: Object.fromEntries(
            Object.entries(tsconfig.compilerOptions.paths).map(([key, [target]]) => [
                key.replace('/*', ''),
                path.resolve(import.meta.dirname, target.replace('/*', '')),
            ]),
        ),
    },
    plugins: [
        domain(),
        wuchale(),
        tailwindcss(),
        svelte({ inspector: true }),
        navigation_fallback,
        depth_stats_plugin(),
        content_plugin(),
    ],
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
