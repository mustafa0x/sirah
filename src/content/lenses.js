import { glossary_terms, moments, stage_text } from './text.generated.js'

// The same journey seen three ways. The scene, sources and order never change; a mode
// changes the wording, what is explained, and what is shown at first.

// Young learners follow six stages, in short sentences.
export const young_stages = ['setting', 'departure', 'thawr', 'pursuit', 'tent', 'arrival']

// Young learners' captions, moments, and the stage notes, from content/journey/*.md and
// content/map.md.
export const young_paragraphs = Object.fromEntries(
    Object.values(stage_text).flatMap((stage) =>
        stage.paragraphs.filter((item) => item.young).map((item) => [item.id, item.young.text]),
    ),
)

export const young_details = Object.fromEntries(
    Object.entries(moments)
        .filter(([, moment]) => moment.young)
        .map(([id, moment]) => [id, moment.young.text]),
)

// For someone new to the story: why each stage matters.
export const why_it_matters = Object.fromEntries(
    Object.entries(stage_text)
        .filter(([, stage]) => stage.why)
        .map(([id, stage]) => [id, stage.why.text]),
)

// Terms explained for someone new to the story, from content/glossary.md. `match` finds
// them in either language.
export const glossary = glossary_terms
