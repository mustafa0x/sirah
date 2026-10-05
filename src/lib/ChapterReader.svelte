<script>
    // Localized wording is separate from the unchanged Arabic source evidence.
    import { onMount, tick } from 'svelte'
    import { journey_href } from './journey-links.js'
    const { route } = window.navgo
    import { fade, fly } from 'svelte/transition'
    import { catalog, chapter_title, citation, display_text, part_role } from './chapters.svelte.js'
    import { reading_for_note, reading_groups } from './chapter-editions.js'
    import {
        create_practice,
        current_question,
        inspect_practice_source,
        next_practice,
        practice_feedback,
        practice_questions,
        practice_score,
        submit_practice,
    } from './hijrah-practice.js'

    let {
        chapter_id,
        chapter,
        destination,
        session = $bindable(),
        on_close,
        on_navigate,
    } = $props()
    let tab = $derived(
        ['readings', 'sources'].includes(destination.tab) ? 'sources' : destination.tab,
    )
    let body = $state()
    let lit = $derived(destination.tab === 'readings' ? [destination.target_id] : [])

    const tabs = [
        ['story', 'Story'],
        ['sources', 'Sources'],
        ['practice', 'Check your understanding'],
    ]

    // Footnote number for each paragraph or outline point, in reading order.
    let notes = $derived.by(() => {
        const map = new Map()
        ;(chapter?.footnotes ?? []).forEach((note, index) => {
            for (const target of note.targets)
                map.set(target.target_id, { ...note, number: index + 1 })
        })
        return map
    })

    let readings = $derived(chapter ? reading_groups(chapter) : [])

    function path(tab, id = null) {
        return `/chapters/${chapter_id}/${tab}${id ? `/${encodeURIComponent(id)}` : ''}`
    }

    function href(tab, id = null) {
        return journey_href(path(tab, id), destination, destination.at)
    }

    function note_reading(note) {
        return reading_for_note(readings, note)
    }

    function select_tab(next) {
        on_navigate(path(next))
    }

    // Practice, on the same deterministic engine as the journey.
    // Lesson questions first; questions on reading the texts are offered after them.
    let study = $derived(Boolean(session.study))
    let practice = $derived(session.practice ?? null)
    let tick_count = $state(0)
    let passage = $derived(session.passage ?? [])
    let question = $derived(tick_count >= 0 && practice ? current_question(practice) : null)
    let result = $derived(tick_count >= 0 && question ? practice_feedback(practice) : null)

    function rank(text) {
        let hash = 2166136261
        for (const character of text) hash = Math.imul(hash ^ character.codePointAt(0), 16777619)
        return hash >>> 0
    }
    let options = $derived(
        question
            ? [...question.options].sort(
                  (a, b) =>
                      rank(`${question.question_id}:${a.option_id}`) -
                      rank(`${question.question_id}:${b.option_id}`),
              )
            : [],
    )

    function questions_of(source_study) {
        return ['beginner', 'intermediate', 'expert']
            .flatMap((level) =>
                practice_questions(chapter, level, {
                    step_id: chapter.chapter_id,
                    include_source_study: source_study,
                }),
            )
            .filter((item) => (item.practice_scope === 'source_study') === source_study)
    }
    let study_count = $derived(chapter ? questions_of(true).length : 0)

    function start_practice(source_study = false, navigate = true) {
        session.study = source_study
        const questions = questions_of(source_study)
        session.practice = questions.length ? create_practice(chapter, questions) : null
        session.passage = []
        tick_count += 1
        if (navigate) on_navigate(path('practice', questions[0]?.question_id))
    }

    function answer(option_id) {
        submit_practice(practice, option_id)
        tick_count += 1
    }

    function open_passage() {
        session.passage = inspect_practice_source(practice, chapter)
        tick_count += 1
    }

    function next() {
        next_practice(practice)
        session.passage = []
        tick_count += 1
        on_navigate(path('practice', current_question(practice)?.question_id))
    }

    onMount(() => {
        let disposed = false
        const unsubscribe = route.subscribe(async (current) => {
            const key = current.url.href
            await tick()
            if (disposed || key !== location.href || !chapter) return
            const target = destination.target_id
            if (tab === 'practice') {
                const linked = chapter.questions.find((q) => q.question_id === target)
                if (!practice || (linked && study !== (linked.practice_scope === 'source_study')))
                    start_practice(linked?.practice_scope === 'source_study', false)
                if (linked)
                    practice.index = practice.questions.findIndex((q) => q.question_id === target)
                tick_count += 1
            }
            const selector =
                destination.tab === 'story'
                    ? 'data-section'
                    : destination.tab === 'readings'
                      ? 'data-reading'
                      : 'data-unit'
            const fragment = decodeURIComponent(current.url.hash.slice(1))
            await tick()
            if (disposed || key !== location.href) return
            const element = fragment
                ? document.getElementById(fragment)
                : target
                  ? body?.querySelector(`[${selector}="${CSS.escape(target)}"]`)
                  : null
            if (element) {
                const details = element.closest('details')
                if (details) details.open = true
                element.scrollIntoView({ block: 'start' })
            } else if (!target) body?.scrollTo({ top: 0 })
        })
        return () => {
            disposed = true
            unsubscribe()
        }
    })

    const level_name = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }
    const paragraph = 'font-serif text-[1.1875rem] leading-[1.9] text-ink text-pretty'
    const heading = 'font-serif text-[1.375rem] font-medium text-gold-bright'
</script>

{#snippet marker(id)}
    {@const note = notes.get(id)}
    {#if note}
        <a
            class="ms-1 align-super px-[5px] border-0 text-[0.75rem] font-sans font-semibold text-gold bg-[rgba(232,178,87,0.12)] rounded-full hover:bg-gold hover:text-gold-ink"
            aria-label={`Source ${note.number}`}
            href={href('readings', note_reading(note))}>{note.number}</a
        >
    {/if}
{/snippet}

{#snippet source_part(unit)}
    {@const role = part_role(unit)}
    <div class="grid gap-2 scroll-mt-4" data-unit={unit.unit_id}>
        <p class="text-[0.8125rem] leading-[1.6] text-ink-soft">{unit.kind} · {unit.speaker}</p>
        {#if unit.text && display_text(unit.text)}
            {#if role === 'note' || role === 'chain'}
                <p class="font-serif text-[1rem] leading-[1.8] text-ink-soft">
                    {display_text(unit.text)}
                </p>
            {:else}
                <blockquote
                    class="py-4 px-5 font-serif text-[1.1875rem] leading-[1.9] text-[#fff6e3] bg-[rgba(0,0,0,0.32)] border-0 border-s-[3px] border-solid rounded-e-xl data-[quran=true]:border-[#fff1c4] border-gold"
                    data-quran={role === 'quran'}
                >
                    {display_text(unit.text)}
                </blockquote>
            {/if}
            {#if chapter.locale === 'en' && role === 'quran'}
                <p class="text-[0.8125rem] leading-[1.6] text-ink-soft">
                    Translated from the supplied Qur’anic excerpt; not an official Qur’an
                    translation or an independent collation.
                </p>
            {/if}
        {/if}
        <details class="text-ink-soft text-[0.875rem] leading-[1.7]">
            <summary class="cursor-pointer text-gold">Arabic original and source details</summary>
            <div class="grid gap-2 pt-3">
                <p>{unit.context_note}</p>
                <a
                    class="text-gold underline underline-offset-4"
                    href={unit.source_url}
                    target="_blank"
                    rel="noreferrer">{citation(unit).label}</a
                >
                <p lang="ar" dir="rtl" class="font-arabic">{unit.kind_ar} · {unit.speaker_ar}</p>
                <pre
                    lang="ar"
                    dir="rtl"
                    class="m-0 whitespace-pre-wrap break-words font-arabic text-[1.0625rem] leading-[1.9]">{unit.text_ar}</pre>
                <p lang="ar" dir="rtl" class="font-arabic">{unit.citation_ar}</p>
                <p lang="ar" dir="rtl" class="font-arabic">{unit.context_note_ar}</p>
            </div>
        </details>
    </div>
{/snippet}

<aside
    class="fixed z-50 top-[76px] right-4 bottom-4 flex flex-col w-[min(760px,calc(100vw-32px))] bg-panel-solid border border-solid border-line-strong rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-[20px] mobile:top-14 mobile:right-0 mobile:bottom-0 mobile:w-full mobile:rounded-b-none"
    dir={chapter?.locale === 'ar' ? 'rtl' : 'ltr'}
    lang={chapter?.locale ?? 'en'}
    style:--font-serif={chapter?.locale === 'ar'
        ? 'Amiri, Kitab, serif'
        : 'Newsreader, Georgia, serif'}
    aria-labelledby="chapter-title"
    transition:fly={{ x: 40, duration: 260 }}
>
    <header class="flex gap-4 items-start justify-between px-7 pt-6 pb-3 mobile:px-5">
        <div class="grid min-w-0 flex-1 gap-2">
            <label class="sr-only" for="chapter-select">Choose a chapter</label>
            <div class="relative mb-1 min-w-0">
                <select
                    id="chapter-select"
                    class="w-full min-w-0 appearance-none rounded-lg border border-solid border-line-strong bg-panel-solid py-2 ps-3 pe-9 font-serif text-[1rem] text-gold-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    value={chapter_id}
                    onchange={(event) =>
                        on_navigate(`/chapters/${event.currentTarget.value}/story`)}
                >
                    {#each catalog.chapters as item (item.chapter_id)}
                        <option value={item.chapter_id}
                            >{chapter_title(item, chapter?.locale)}</option
                        >
                    {/each}
                </select>
                <svg
                    class="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 fill-none stroke-current text-gold-bright [stroke-width:2.2] [stroke-linecap:round] [stroke-linejoin:round]"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </div>
            <h2 class="font-serif text-[2rem] font-medium leading-[1.15]" id="chapter-title">
                {chapter?.title ?? ''}
            </h2>
            {#if chapter}
                <p class="text-ink-soft text-[1rem] leading-[1.6]">{chapter.reader_question}</p>
            {/if}
        </div>
        <button
            class="grid flex-none size-[38px] place-items-center text-ink-soft bg-transparent border border-solid border-line-strong rounded-full hover:text-white hover:border-gold"
            aria-label="Close chapter"
            onclick={on_close}
        >
            <svg
                class="size-[18px] stroke-current fill-none stroke-2"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
        </button>
    </header>

    {#if chapter && destination.lang !== chapter.locale}
        <p class="px-7 pb-3 text-ink-soft text-[0.9375rem] mobile:px-5">
            This chapter is available in Arabic and English. Showing the English edition.
        </p>
    {/if}

    <nav
        class="flex gap-1 px-6 border-0 border-b border-solid border-line overflow-x-auto mobile:px-4"
        aria-label="Chapter sections"
    >
        {#each tabs as [id, name] (id)}
            <a
                class="py-3 px-3 text-[0.9375rem] text-ink-soft whitespace-nowrap bg-transparent border-0 border-b-2 border-solid border-transparent hover:text-ink data-[active=true]:text-gold-bright data-[active=true]:border-gold"
                href={href(id)}
                aria-current={tab === id ? 'page' : undefined}
                data-active={tab === id}
                >{#if id === 'practice'}<svg
                        class="inline-block me-[6px] size-[1.05em] align-[-0.18em] fill-none stroke-current opacity-80 [stroke-width:1.8] [stroke-linecap:round] [stroke-linejoin:round]"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        ><circle cx="12" cy="12" r="8.5" /><path
                            d="M8.5 12.2l2.4 2.4 4.6-5.1"
                        /></svg
                    >{/if}{name}</a
            >
        {/each}
    </nav>

    <div
        class="flex-1 overflow-y-auto px-7 py-6 [scrollbar-width:thin] [scrollbar-color:#6d5529_transparent] mobile:px-5"
        bind:this={body}
        data-scroll-id="chapter-reader"
    >
        {#if !chapter}
            <p class="text-ink-soft">Loading…</p>
        {:else if tab === 'story'}
            <div class="grid gap-7" in:fade={{ duration: 200 }}>
                {#each chapter.overview as block (block.paragraph_id)}
                    <p
                        class="font-serif text-[1.3125rem] leading-[1.85] text-ink py-4 px-5 bg-[rgba(232,178,87,0.08)] border-0 border-s-[3px] border-solid border-gold rounded-e-xl"
                        id={block.paragraph_id}
                    >
                        {block.text}{@render marker(block.paragraph_id)}
                    </p>
                {/each}
                <!-- The outline doubles as the table of contents. -->
                <nav class="grid gap-1" aria-label="Chapter contents">
                    <p class="text-muted text-[0.875rem] font-semibold">In this chapter</p>
                    <ol class="grid list-none">
                        {#each chapter.outline as point, index (point.point_id)}
                            <li>
                                <a
                                    class="flex gap-3 items-baseline w-full py-[3px] px-0 text-start text-ink-soft bg-transparent border-0 hover:text-gold-bright"
                                    href={href('story', point.section_id)}
                                >
                                    <span class="min-w-5 text-gold font-semibold"
                                        >{(index + 1).toLocaleString(chapter.locale)}</span
                                    >
                                    <span class="font-serif text-[1.0625rem] leading-[1.45]"
                                        >{point.text}</span
                                    >
                                </a>
                            </li>
                        {/each}
                        {#if chapter.in_depth.length}
                            <li>
                                <a
                                    class="flex gap-3 items-baseline w-full py-[3px] px-0 text-start text-ink-soft bg-transparent border-0 hover:text-gold-bright"
                                    href={href('story', 'in_depth')}
                                >
                                    <span class="min-w-5 text-gold">+</span>
                                    <span class="font-serif text-[1.0625rem] leading-[1.45]"
                                        >In depth</span
                                    >
                                </a>
                            </li>
                        {/if}
                    </ol>
                </nav>
                {#each chapter.account as section (section.section_id)}
                    <section class="grid gap-3 scroll-mt-4" data-section={section.section_id}>
                        <h3 class={heading}>{section.title}</h3>
                        {#each section.paragraphs as block (block.paragraph_id)}
                            <p class={paragraph} id={block.paragraph_id}>
                                {block.text}{@render marker(block.paragraph_id)}
                            </p>
                        {/each}
                    </section>
                {/each}
                {#if chapter.in_depth.length}
                    <!-- Deeper discussion closes the story rather than taking its own tab. -->
                    <div
                        class="grid gap-7 pt-6 border-0 border-t border-solid border-line scroll-mt-4"
                        data-section="in_depth"
                    >
                        <p class="text-gold text-[0.875rem] font-semibold">In depth</p>
                        {#each chapter.in_depth as section (section.section_id)}
                            <section
                                class="grid gap-3 scroll-mt-4"
                                data-section={section.section_id}
                            >
                                <h3 class={heading}>{section.title}</h3>
                                {#each section.paragraphs as block (block.paragraph_id)}
                                    <p class={paragraph} id={block.paragraph_id}>
                                        {block.text}{@render marker(block.paragraph_id)}
                                    </p>
                                {/each}
                            </section>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else if tab === 'sources'}
            <div class="grid gap-6" in:fade={{ duration: 200 }}>
                {#if chapter.locale === 'en'}
                    <p class="text-ink-soft leading-[1.7]">
                        English translations of the selected excerpts. The original Arabic remains
                        available with each passage.
                    </p>
                {/if}
                {#each readings as reading (reading.reading_id)}
                    <article
                        class="grid gap-4 p-5 border border-solid border-line rounded-2xl scroll-mt-4 transition-[border-color,background] duration-500 data-[lit=true]:border-gold data-[lit=true]:bg-[rgba(232,178,87,0.07)]"
                        data-reading={reading.reading_id}
                        data-lit={lit.includes(reading.reading_id)}
                    >
                        <h3 class="font-serif text-[1.1875rem] font-medium text-ink">
                            {reading.title}
                        </h3>
                        {#if reading.mode === 'arabic_with_gloss'}
                            <p class="text-ink-soft">English summary — not a translation</p>
                            <p class="leading-[1.7]">{reading.gloss}</p>
                        {/if}
                        {#each reading.blocks as block, index (index)}
                            {#if block.repeat}
                                <a
                                    class="text-gold underline underline-offset-4"
                                    href={href('readings', block.repeat)}
                                    >This selection is shown in an earlier reading.</a
                                >
                            {:else}
                                {@const chain = block.parts.filter(
                                    (unit) => part_role(unit) === 'chain',
                                )}
                                {#if chain.length}
                                    <details class="text-ink-soft">
                                        <summary class="cursor-pointer text-[0.875rem]"
                                            >Chain of transmission</summary
                                        >
                                        <div class="grid gap-3 pt-3">
                                            {#each chain as unit (unit.unit_id)}{@render source_part(unit)}{/each}
                                        </div>
                                    </details>
                                {/if}
                                {#each block.parts.filter((unit) => part_role(unit) !== 'chain') as unit (unit.unit_id)}
                                    {@render source_part(unit)}
                                {/each}
                                <a
                                    class="justify-self-start text-[0.875rem] text-gold underline underline-offset-4"
                                    href={citation(block.parts[0]).url}
                                    target="_blank"
                                    rel="noreferrer">{citation(block.parts[0]).label}</a
                                >
                            {/if}
                        {/each}
                    </article>
                {/each}
            </div>
        {:else if tab === 'practice'}
            <div class="grid gap-4" in:fade={{ duration: 200 }}>
                {#if study && question}
                    <p class="text-ink-soft text-[0.9375rem]">
                        Source-study questions: read the passages and compare them.
                    </p>
                {/if}
                {#if question}
                    {#key question.question_id}
                        <div class="grid gap-3" in:fade={{ duration: 200 }}>
                            <p class="text-gold text-[0.875rem] font-semibold">
                                Question {(practice.index + 1).toLocaleString(chapter.locale)} of {practice.questions.length.toLocaleString(
                                    chapter.locale,
                                )}
                                · {level_name[question.difficulty]}
                            </p>
                            <p class="font-serif text-[1.3125rem] leading-[1.7] text-ink">
                                {question.prompt}
                            </p>
                            {#each options as option (option.option_id)}
                                {@const chosen =
                                    tick_count >= 0 &&
                                    practice.answers[question.question_id] === option.option_id}
                                {@const right = option.option_id === question.correct_option_id}
                                <button
                                    class="py-3 px-4 text-start text-[1.0625rem] leading-[1.6] text-ink bg-[rgba(255,244,222,0.05)] border border-solid border-line-strong rounded-xl not-disabled:hover:border-gold disabled:cursor-default disabled:opacity-100 data-[state=right]:border-[#7fd1a0] data-[state=right]:bg-[rgba(127,209,160,0.14)] data-[state=wrong]:border-[#e8a857] data-[state=wrong]:bg-[rgba(232,168,87,0.14)]"
                                    data-state={result
                                        ? right
                                            ? 'right'
                                            : chosen
                                              ? 'wrong'
                                              : 'idle'
                                        : 'idle'}
                                    disabled={Boolean(result)}
                                    onclick={() => answer(option.option_id)}>{option.text}</button
                                >
                            {/each}
                            {#if !result}
                                <div class="flex flex-wrap gap-4 items-center">
                                    <button
                                        class="py-2 px-4 text-ink bg-transparent border border-solid border-line-strong rounded-full hover:border-gold"
                                        onclick={open_passage}>Read the passage</button
                                    >
                                    <button
                                        class="text-ink-soft bg-transparent border-0 underline underline-offset-4"
                                        onclick={() => answer(null)}>I don’t know</button
                                    >
                                </div>
                            {/if}
                            {#each passage as unit (unit.unit_id)}
                                {@render source_part(unit)}
                            {/each}
                            {#if result}
                                {@const picked = question.options.find(
                                    (option) =>
                                        option.option_id === practice.answers[question.question_id],
                                )}
                                <div class="grid gap-2" in:fly={{ y: 8, duration: 200 }}>
                                    {#if !result.skipped}
                                        <p class="font-semibold">
                                            {#if result.correct}<span class="text-[#7fd1a0]"
                                                    >Correct.</span
                                                >{:else}<span class="text-[#e8a857]"
                                                    >Not quite.</span
                                                >{/if}
                                        </p>
                                    {/if}
                                    {#if picked}<p class="text-ink-soft leading-[1.7]">{picked.feedback}</p>{/if}
                                    <p class="text-ink leading-[1.7]">{question.explanation}</p>
                                    <p class="text-ink-soft text-[0.9375rem] leading-[1.7]">
                                        {question.scope_note}
                                    </p>
                                    <button
                                        class="justify-self-start mt-1 py-2 px-5 text-gold-ink font-semibold bg-gold border-0 rounded-full hover:bg-gold-bright"
                                        onclick={next}
                                        >{practice.index + 1 < practice.questions.length
                                            ? 'Next question'
                                            : 'See how you did'}</button
                                    >
                                </div>
                            {/if}
                        </div>
                    {/key}
                {:else if practice}
                    {@const score = tick_count >= 0 && practice_score(practice)}
                    <div class="grid gap-3">
                        <p class="font-serif text-[2rem]">
                            {score.correct.toLocaleString(chapter.locale)} of {score.total.toLocaleString(
                                chapter.locale,
                            )}
                        </p>
                        <p class="text-ink-soft">
                            Correct answers out of the questions in this set.
                        </p>
                        <div class="flex flex-wrap gap-3">
                            {#if !study && study_count}
                                <button
                                    class="py-2 px-5 text-gold-ink font-semibold bg-gold border-0 rounded-full"
                                    onclick={() => start_practice(true)}
                                    >Continue with source-study questions</button
                                >
                            {/if}
                            <button
                                class="py-2 px-5 text-ink bg-transparent border border-solid border-line-strong rounded-full"
                                onclick={() => start_practice(study)}>Try again</button
                            >
                            <button
                                class="py-2 px-5 text-ink bg-transparent border border-solid border-line-strong rounded-full"
                                onclick={() => select_tab('story')}>Back to the story</button
                            >
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</aside>
