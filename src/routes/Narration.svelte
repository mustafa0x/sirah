<script>
    // The narrated journey on one page, in order, as it is heard: for reading and listening to
    // it as a whole (the listener's test in docs/CONTENT_SPEC.md). Not linked from the app;
    // open /narration.
    import { stage_text } from '../content/text.generated.js'
    import index from '../assets/narration/index.json'

    const files = import.meta.glob('../assets/narration/**/*.mp3', {
        query: '?url',
        import: 'default',
    })
    const young_stages = ['setting', 'departure', 'thawr', 'pursuit', 'tent', 'arrival']

    let young = $state(new URL(location.href).searchParams.get('audience') === 'young')
    let stages = $derived(
        Object.entries(stage_text)
            .filter(([id]) => !young || young_stages.includes(id))
            .map(([id, stage]) => ({
                id,
                title: stage.title,
                captions: stage.paragraphs.map((paragraph) => ({
                    id: paragraph.id,
                    text: young ? paragraph.young?.text : paragraph.text,
                })),
            })),
    )
    const words = (text) => text?.split(/\s+/).length ?? 0
    let total = $derived(
        stages.reduce(
            (sum, stage) => sum + stage.captions.reduce((n, c) => n + words(c.text), 0),
            0,
        ),
    )
    const seconds = (id) => (young ? index.young?.en : index.en)?.[id]?.seconds

    // One clip at a time; a caption's clip plays only if it was recorded from this wording.
    let audio = null
    let playing = $state(null)
    async function listen(caption) {
        audio?.pause()
        if (playing === caption.id) return (playing = null)
        const entry = (young ? index.young?.en : index.en)?.[caption.id]
        const load = files[`../assets/narration/${young ? 'young/' : ''}en/${caption.id}.mp3`]
        if (!load || entry?.text !== caption.text) return
        audio = new Audio(await load())
        audio.onended = () => (playing = null)
        playing = caption.id
        audio.play()
    }
    function set_young(next) {
        audio?.pause()
        playing = null
        young = next
        const url = new URL(location.href)
        if (next) url.searchParams.set('audience', 'young')
        else url.searchParams.delete('audience')
        history.replaceState(history.state, '', url)
    }
</script>

<svelte:head><title>The narration · Sirah Journey</title></svelte:head>

<!-- The app locks page scrolling for the scene, so this view scrolls itself. -->
<div class="fixed inset-0 overflow-y-auto bg-[#120d08] text-ink">
    <article class="max-w-[42rem] mx-auto px-4 py-16 grid gap-12">
        <header class="grid gap-4">
            <p class="text-gold text-[0.75rem] font-semibold tracking-[0.12em] uppercase">
                The Hijrah · the narration
            </p>
            <div class="flex flex-wrap gap-2 items-center">
                {#each [false, true] as option (option)}
                    <button
                        class="py-1 px-3 text-[0.875rem] text-ink-soft bg-transparent border border-solid border-line-strong rounded-full aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright"
                        aria-pressed={young === option}
                        onclick={() => set_young(option)}
                        >{#if option}Young learners{:else}Main narration{/if}</button
                    >
                {/each}
                <span class="ms-auto text-[0.8125rem] text-ink-soft"
                    >{stages.length} stages · {total} words</span
                >
            </div>
        </header>

        {#each stages as stage, number (stage.id)}
            <section class="grid gap-5">
                <h2 class="font-serif text-[1.5rem] font-medium text-ink">
                    <span class="me-2 text-gold font-sans text-[0.875rem]">{number + 1}</span>{stage.title}
                </h2>
                {#each stage.captions as caption (caption.id)}
                    <div class="group grid grid-cols-[1fr_auto] gap-x-4 items-start">
                        <p class="font-serif text-[1.1875rem] leading-[1.75] text-ink text-pretty">
                            {caption.text}
                        </p>
                        <div class="grid gap-1 justify-items-end pt-1">
                            <button
                                class="w-8 h-8 grid place-items-center text-gold bg-transparent border border-solid border-line-strong rounded-full hover:border-gold aria-pressed:bg-gold aria-pressed:text-gold-ink"
                                aria-pressed={playing === caption.id}
                                aria-label={playing === caption.id ? 'Stop' : 'Listen'}
                                title={seconds(caption.id)
                                    ? `${Math.round(seconds(caption.id))} s`
                                    : 'No recording'}
                                onclick={() => listen(caption)}
                                >{playing === caption.id ? '■' : '▶'}</button
                            >
                            <a
                                class="text-[0.75rem] text-ink-soft no-underline hover:text-gold"
                                href={`/journey/hijrah/${stage.id}/${caption.id}?lang=en${young ? '&audience=young' : ''}`}
                                >{caption.id}</a
                            >
                        </div>
                    </div>
                {/each}
            </section>
        {/each}
    </article>
</div>
