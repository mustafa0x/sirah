<script>
    // The twelve chapter stories on one page, in order: a reading view for writing and
    // reviewing the foundation. Not linked from the app; open /book.
    import index from '../content/chapters/index.json'

    const stories = import.meta.glob('../content/chapters/*.en.json', {
        eager: true,
        import: 'default',
    })
    const chapters = index.map((item) => stories[`../content/chapters/${item.chapter_id}.en.json`])

    // A paragraph with its footnote numbers where they stand in the text.
    function parts(block) {
        const out = []
        let from = 0
        for (const mark of block.marks ?? []) {
            out.push({ text: block.text.slice(from, mark.at) })
            out.push({ note: mark.note })
            from = mark.at
        }
        out.push({ text: block.text.slice(from) })
        return out
    }

    const note_title = (chapter, number) =>
        chapter.readings.find((reading) => reading.number === number)?.title ?? ''
    const words = (chapter) =>
        chapter.account
            .flatMap((section) => section.paragraphs)
            .reduce((sum, block) => sum + block.text.split(/\s+/).length, 0)
</script>

<svelte:head><title>The chapters · Sirah Journey</title></svelte:head>

{#snippet prose(chapter, block)}
    <p class="font-serif text-[1.1875rem] leading-[1.85] text-ink text-pretty">
        {#each parts(block) as part, index (index)}{#if part.note}<a
                    class="ms-0.5 align-super px-[5px] text-[0.7rem] font-sans font-semibold text-gold bg-[rgba(232,178,87,0.12)] rounded-full no-underline hover:bg-gold hover:text-gold-ink"
                    href={`/chapters/${chapter.chapter_id}/readings/${chapter.chapter_id}_n${part.note}?lang=en`}
                    title={note_title(chapter, part.note)}>{part.note}</a
                >{:else}{part.text}{/if}{/each}
    </p>
{/snippet}

<div class="min-h-screen bg-[#120d08] text-ink">
    <article class="max-w-[46rem] mx-auto px-4 py-16 grid gap-16">
        <header class="grid gap-4">
            <p class="text-gold text-[0.75rem] font-semibold tracking-[0.12em] uppercase">
                The Hijrah · the chapters
            </p>
            <nav class="grid gap-1">
                {#each chapters as chapter, index (chapter.chapter_id)}
                    <a
                        class="flex gap-3 font-serif text-[1.125rem] text-ink-soft no-underline hover:text-gold-bright"
                        href={`#${chapter.chapter_id}`}
                        ><span class="w-6 text-gold font-sans text-[0.875rem]">{index + 1}</span
                        >{chapter.title}<span
                            class="ms-auto text-[0.8125rem] font-sans text-ink-soft"
                            >{words(chapter)} words</span
                        ></a
                    >
                {/each}
            </nav>
        </header>

        {#each chapters as chapter, index (chapter.chapter_id)}
            <section class="grid gap-6 scroll-mt-8" id={chapter.chapter_id}>
                <header class="grid gap-2 pt-10 border-0 border-t border-solid border-line">
                    <p class="text-gold text-[0.75rem] font-semibold tracking-[0.12em] uppercase">
                        Chapter {index + 1} ·
                        <a class="text-gold" href={`/chapters/${chapter.chapter_id}/story?lang=en`}
                            >open in the app</a
                        >
                    </p>
                    <h2 class="font-serif text-[2.25rem] leading-[1.15] font-medium">
                        {chapter.title}
                    </h2>
                    <p class="text-ink-soft text-[1.0625rem] leading-[1.6]">
                        {chapter.reader_question}
                    </p>
                </header>
                <div class="grid gap-4 py-5 px-6 bg-[rgba(255,244,222,0.04)] rounded-xl">
                    {#each chapter.overview as block (block.paragraph_id)}
                        {@render prose(chapter, block)}
                    {/each}
                </div>
                {#each chapter.account as section (section.section_id)}
                    <h3 class="font-serif text-[1.375rem] font-medium text-gold-bright pt-2">
                        {section.title}
                    </h3>
                    {#each section.paragraphs as block (block.paragraph_id)}
                        {@render prose(chapter, block)}
                    {/each}
                {/each}
                {#if chapter.in_depth.length}
                    <details class="grid gap-4 pt-4">
                        <summary class="cursor-pointer text-gold font-semibold">In depth</summary>
                        <div class="grid gap-4 pt-4">
                            {#each chapter.in_depth as section (section.section_id)}
                                <h4 class="font-serif text-[1.1875rem] font-medium text-ink">
                                    {section.title}
                                </h4>
                                {#each section.paragraphs as block (block.paragraph_id)}
                                    {@render prose(chapter, block)}
                                {/each}
                            {/each}
                        </div>
                    </details>
                {/if}
            </section>
        {/each}
    </article>
</div>
