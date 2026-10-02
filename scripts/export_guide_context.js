import { readFileSync, writeFileSync } from 'node:fs'
import { chapter } from '../src/content/first-chapter.js'

// Build-time snapshot of the actual lesson, never evaluation material.
const context = {
    id: chapter.id,
    title: chapter.title,
    objective: chapter.objective,
    steps: chapter.steps.map(({ id, title, paragraphs, source_ids }) => ({
        id,
        title,
        paragraphs,
        source_ids,
    })),
    sources: chapter.sources.map(
        ({
            id,
            number,
            reference,
            work,
            author,
            excerpt,
            book_id,
            page_id,
            url,
            volume,
            page,
        }) => ({
            id,
            number,
            reference,
            work,
            author,
            excerpt,
            book_id,
            page_id,
            url,
            volume,
            page,
        }),
    ),
}
const path = new URL('../guide_context.json', import.meta.url)
const encoded = JSON.stringify(context, null, 2) + '\n'
if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== encoded) {
        throw new Error('Guide context is stale. Run node scripts/export_guide_context.js')
    }
} else writeFileSync(path, encoded)
