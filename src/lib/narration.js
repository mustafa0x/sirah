import index from '../assets/narration/index.json'
import { narrator_player, time_chapter } from './narration-core.js'

const files = import.meta.glob(
    ['../assets/narration/**/*.mp3', '!../assets/narration/**/*.tmp.mp3'],
    {
        eager: true,
        query: '?url',
        import: 'default',
    },
)

function clip(language, paragraph) {
    const young = paragraph.narration_variant === 'young'
    const entry = (young ? index.young?.[language] : index[language])?.[paragraph.id]
    const folder = young ? `young/${language}` : language
    const url = files[`../assets/narration/${folder}/${paragraph.id}.mp3`]
    // Never play an older script over new captions, or the adult wording in young mode.
    return url &&
        entry?.text === paragraph.text &&
        Number.isFinite(entry.seconds) &&
        entry.seconds > 0
        ? { url, seconds: entry.seconds }
        : null
}

export const apply_timings = (chapter, language) =>
    time_chapter(chapter, (paragraph) => clip(language, paragraph))
export const create_narrator = (language) =>
    narrator_player((paragraph) => clip(language, paragraph))
