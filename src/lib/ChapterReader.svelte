<script>
    // Localized wording is separate from the unchanged Arabic source evidence.
    import { onMount, tick } from 'svelte'
    import { journey_href } from './journey-links.js'
    const { route } = window.navgo
    import { fade, fly } from 'svelte/transition'
    import {
        available_chapters,
        chapter_content_locale,
        chapter_title,
        citation,
        display_text,
        part_role,
    } from './chapters.svelte.js'
    import { reading_for_note, reading_groups, source_part_display } from './chapter-editions.js'
    import { language_direction } from './locale-config.js'
    import { source_details } from './source-details.js'
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

    // Numbers in the chapter's own digits (Arabic-Indic for an Arabic chapter).
    const local_number = (value) =>
        value.toLocaleString(chapter?.locale === 'ar' ? 'ar-u-nu-arab' : chapter?.locale)

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

    // Chapters in story order, for the links that close each one.
    let neighbours = $derived.by(() => {
        const list = available_chapters(destination.lang)
        const index = list.findIndex((item) => item.chapter_id === chapter_id)
        return {
            previous: index > 0 ? list[index - 1] : null,
            next: index >= 0 ? (list[index + 1] ?? null) : null,
        }
    })

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
            lang={destination.lang}
            dir={language_direction(destination.lang)}
            aria-label={`Source ${note.number}`}
            href={href('readings', note_reading(note))}>{local_number(note.number)}</a
        >
    {/if}
{/snippet}

<!-- A paragraph with its footnote markers where they stand in the text. -->
{#snippet prose(block)}
    {#if block.marks?.length}
        {#each block.marks as mark, index (index)}{block.text.slice(
                index
                    ? block.marks[index - 1].at
                    : 0,
                mark.at,
            )}<a
                class="ms-0.5 align-super px-[5px] border-0 text-[0.75rem] font-sans font-semibold text-gold bg-[rgba(232,178,87,0.12)] rounded-full hover:bg-gold hover:text-gold-ink"
                lang={destination.lang}
                dir={language_direction(destination.lang)}
                aria-label={`Source ${mark.note}`}
                href={href('readings', `${chapter_id}_n${mark.note}`)}>{local_number(mark.note)}</a
            >{/each}{block.text.slice(block.marks.at(-1).at)}
    {:else}
        {block.text}{@render marker(block.paragraph_id)}
    {/if}
{/snippet}

{#snippet source_part(unit, reading_mode = null)}
    {@const role = part_role(unit)}
    {@const source = source_part_display(unit, chapter?.locale, reading_mode)}
    <div
        class="grid gap-2 scroll-mt-4"
        data-unit={unit.unit_id}
        lang={chapter?.locale}
        dir={language_direction(chapter?.locale)}
    >
        {#if source.text && display_text(source.text)}
            {#if source.original}<p class="text-ink-soft">Arabic original</p>{/if}
            <div
                lang={source.locale}
                dir={language_direction(source.locale)}
                class:font-arabic={source.original}
            >
                {#if role === 'note' || role === 'chain'}
                    <p class="font-serif text-[1rem] leading-[1.8] text-ink-soft">
                        {display_text(source.text)}
                    </p>
                {:else}
                    <blockquote
                        class="font-serif text-[1.1875rem] leading-[1.9] text-[#fff6e3] data-[quran=true]:text-[#fff1c4]"
                        data-quran={role === 'quran'}
                    >
                        {display_text(source.text)}
                    </blockquote>
                {/if}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet original_details(units)}
    {@const details = source_details(units)}
    {#if units.length}
        <details class="text-ink-soft text-[0.875rem] leading-[1.7]" data-source-details>
            <summary
                class="cursor-pointer text-gold"
                lang={destination.lang}
                dir={language_direction(destination.lang)}
                >Arabic original and source details</summary
            >
            <div class="grid gap-5 pt-3">
                {#each details as scope, index (index)}
                    <div
                        class="grid gap-4"
                        data-source-scope={scope.groups
                            .flat()
                            .map((unit) => unit.unit_id)
                            .join(' ')}
                    >
                        {#each scope.groups as group, group_index (group_index)}
                            <div class="grid gap-2">
                                <p>{group[0].kind} · {group[0].speaker}</p>
                                <a
                                    class="justify-self-start text-gold underline underline-offset-4"
                                    href={citation(group[0]).url}
                                    target="_blank"
                                    rel="noreferrer">{citation(group[0]).label}</a
                                >
                                {#if chapter.locale !== 'ar'}
                                    <p lang="ar" dir="rtl" class="font-arabic">
                                        {group[0].kind_ar} · {group[0].speaker_ar}
                                    </p>
                                    <p lang="ar" dir="rtl" class="font-arabic break-words">
                                        {group[0].citation_ar}
                                    </p>
                                {/if}
                                {#each group as unit (unit.unit_id)}
                                    <pre
                                        data-original-unit={unit.unit_id}
                                        lang="ar"
                                        dir="rtl"
                                        class="m-0 whitespace-pre-wrap break-words font-arabic text-[1.0625rem] leading-[1.9]">{unit.text_ar}</pre>
                                {/each}
                            </div>
                        {/each}
                        {#if scope.context_note}<p>{scope.context_note}</p>{/if}
                        {#if chapter.locale !== 'ar' && scope.context_note_ar}
                            <p lang="ar" dir="rtl" class="font-arabic">{scope.context_note_ar}</p>
                        {/if}
                    </div>
                {/each}
            </div>
        </details>
    {/if}
{/snippet}

<aside
    class="fixed z-50 top-[76px] right-4 bottom-4 flex flex-col w-[min(760px,calc(100vw-32px))] bg-panel-solid border border-solid border-line-strong rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-[20px] mobile:top-14 mobile:right-0 mobile:bottom-0 mobile:w-full mobile:rounded-b-none"
    lang={destination.lang}
    dir={language_direction(destination.lang)}
    style:--font-serif={language_direction(chapter?.locale) === 'rtl'
        ? 'Amiri, Kitab, serif'
        : 'Newsreader, Georgia, serif'}
    aria-labelledby={chapter?.introduction && tab === 'story'
        ? 'orientation-title'
        : 'chapter-title'}
    transition:fly={{ x: 40, duration: 260 }}
>
    <header class="flex gap-4 items-start justify-between px-7 pt-6 pb-3 mobile:px-5">
        <div class="grid min-w-0 flex-1 gap-2">
            <h2
                class="font-serif text-[2rem] font-medium leading-[1.15]"
                id={chapter?.introduction && tab === 'story' ? 'orientation-title' : 'chapter-title'}
                lang={chapter?.locale}
                dir={language_direction(chapter?.locale)}
            >
                {chapter?.introduction && tab === 'story'
                    ? chapter.introduction.title
                    : (chapter?.title ?? '')}
            </h2>
            {#if chapter && (!chapter.introduction || tab !== 'story')}
                <p
                    class="text-ink-soft text-[1rem] leading-[1.6]"
                    lang={chapter?.locale}
                    dir={language_direction(chapter?.locale)}
                    data-reader-question
                >
                    {chapter.reader_question}
                </p>
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
            A chapter edition is not ready in this language. Showing the English edition.
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
                {#if chapter.introduction}
                    <section aria-labelledby="orientation-title" class="grid gap-5">
                        {#each chapter.introduction.paragraphs as block (block.paragraph_id)}
                            <p
                                class="font-serif text-[1.1875rem] leading-[1.9] text-ink text-pretty"
                                id={block.paragraph_id}
                                lang={chapter.locale}
                                dir={language_direction(chapter.locale)}
                            >
                                {@render prose(block)}
                            </p>
                        {/each}
                    </section>
                    <section class="grid gap-3" aria-labelledby="chapter-title">
                        <h2
                            class="font-serif text-[2rem] font-medium leading-[1.15]"
                            id="chapter-title"
                            lang={chapter.locale}
                            dir={language_direction(chapter.locale)}
                        >
                            {chapter.title}
                        </h2>
                        <p
                            class="text-ink-soft text-[1rem] leading-[1.6]"
                            lang={chapter.locale}
                            dir={language_direction(chapter.locale)}
                            data-reader-question
                        >
                            {chapter.reader_question}
                        </p>
                    </section>
                {/if}
                {#each chapter.overview as block (block.paragraph_id)}
                    <p
                        class="font-serif text-[1.3125rem] leading-[1.85] text-ink py-4 px-5 bg-[rgba(232,178,87,0.08)] border-0 border-s-[3px] border-solid border-gold rounded-e-xl"
                        id={block.paragraph_id}
                        lang={chapter?.locale}
                        dir={language_direction(chapter?.locale)}
                    >
                        {@render prose(block)}
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
                                        >{local_number(index + 1)}</span
                                    >
                                    <span
                                        class="font-serif text-[1.0625rem] leading-[1.45]"
                                        lang={chapter?.locale}
                                        dir={language_direction(chapter?.locale)}>{point.text}</span
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
                    <section
                        class="grid gap-3 scroll-mt-4"
                        data-section={section.section_id}
                        lang={chapter?.locale}
                        dir={language_direction(chapter?.locale)}
                    >
                        <h3 class={heading}>{section.title}</h3>
                        {#each section.paragraphs as block (block.paragraph_id)}
                            <p class={paragraph} id={block.paragraph_id}>
                                {@render prose(block)}
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
                                lang={chapter?.locale}
                                dir={language_direction(chapter?.locale)}
                            >
                                <h3 class={heading}>{section.title}</h3>
                                {#each section.paragraphs as block (block.paragraph_id)}
                                    <p class={paragraph} id={block.paragraph_id}>
                                        {@render prose(block)}
                                    </p>
                                {/each}
                            </section>
                        {/each}
                    </div>
                {/if}
                {#if neighbours.previous || neighbours.next}
                    <nav
                        class="grid grid-cols-2 gap-4 pt-6 border-0 border-t border-solid border-line"
                        aria-label="More chapters"
                    >
                        {#each [neighbours.previous, neighbours.next] as item, index (index)}
                            {#if item}
                                <a
                                    class="grid gap-1 content-start text-ink hover:text-gold-bright data-[next=true]:col-start-2 data-[next=true]:text-end"
                                    href={journey_href(
                                        `/chapters/${item.chapter_id}/story`,
                                        destination,
                                        destination.at,
                                    )}
                                    data-next={index === 1}
                                >
                                    <span class="text-muted text-[0.8125rem] font-semibold"
                                        >{#if index === 0}Previous chapter{:else}Next chapter{/if}</span
                                    >
                                    <span
                                        class="font-serif text-[1.0625rem] leading-[1.35]"
                                        lang={chapter_content_locale(item, destination.lang)}
                                        dir={language_direction(
                                            chapter_content_locale(item, destination.lang),
                                        )}>{chapter_title(item, destination.lang)}</span
                                    >
                                </a>
                            {/if}
                        {/each}
                    </nav>
                {/if}
            </div>
        {:else if tab === 'sources'}
            <div class="grid" in:fade={{ duration: 200 }}>
                {#each readings as reading (reading.reading_id)}
                    <!-- Plain entries between rules; the one a footnote points to gets a gold edge. -->
                    <article
                        class="grid gap-4 py-6 ps-4 border-0 border-t border-s-2 border-solid border-line border-s-transparent first:border-t-0 first:pt-1 scroll-mt-4 transition-[border-color] duration-500 data-[lit=true]:border-s-gold"
                        data-reading={reading.reading_id}
                        data-lit={lit.includes(reading.reading_id)}
                    >
                        <h3
                            class="font-serif text-[1.1875rem] font-medium text-ink"
                            lang={chapter?.locale}
                            dir={language_direction(chapter?.locale)}
                        >
                            {#if reading.number}<span
                                    class="text-gold font-sans text-[0.875rem] me-2">{local_number(
                                        reading.number,
                                    )}</span
                                >{/if}{reading.title}
                        </h3>
                        {#if reading.strength === 'weak'}
                            <p
                                class="justify-self-start px-2 py-0.5 text-[0.8125rem] text-ink-soft border border-solid border-line rounded-full"
                            >
                                Weaker report
                            </p>
                        {/if}
                        {#if reading.mode === 'arabic_with_gloss'}
                            <p class="text-ink-soft">Summary — not a translation</p>
                            <p
                                class="leading-[1.7]"
                                lang={chapter?.locale}
                                dir={language_direction(chapter?.locale)}
                            >
                                {reading.gloss}
                            </p>
                        {/if}
                        {#each reading.blocks as block, index (index)}
                            {#if block.repeat}
                                {#if reading.blocks.findIndex((item) => item.repeat === block.repeat) === index}
                                    <a
                                        class="text-gold underline underline-offset-4"
                                        href={href('readings', block.repeat)}
                                        >This selection is shown in an earlier reading.</a
                                    >
                                {/if}
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
                                            {#each chain as unit (unit.unit_id)}{@render source_part(unit, reading.mode)}{/each}
                                        </div>
                                    </details>
                                {/if}
                                {#each block.parts.filter((unit) => part_role(unit) !== 'chain') as unit (unit.unit_id)}
                                    {@render source_part(unit, reading.mode)}
                                {/each}
                            {/if}
                        {/each}
                        {@render original_details(
                            reading.blocks.flatMap((block) => block.parts ?? []),
                        )}
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
                                Question {local_number(practice.index + 1)} of {local_number(
                                    practice.questions.length,
                                )}
                                · {level_name[question.difficulty]}
                            </p>
                            <p
                                class="font-serif text-[1.3125rem] leading-[1.7] text-ink"
                                lang={chapter?.locale}
                                dir={language_direction(chapter?.locale)}
                            >
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
                                    lang={chapter?.locale}
                                    dir={language_direction(chapter?.locale)}
                                    disabled={Boolean(result)}
                                    onclick={() => answer(option.option_id)}>{option.text}</button
                                >
                            {/each}
                            <div class="flex flex-wrap gap-4 items-center">
                                <button
                                    class="py-2 px-4 text-ink bg-transparent border border-solid border-line-strong rounded-full hover:border-gold"
                                    onclick={open_passage}>Read the passage</button
                                >
                                {#if !result}
                                    <button
                                        class="text-ink-soft bg-transparent border-0 underline underline-offset-4"
                                        onclick={() => answer(null)}>I don’t know</button
                                    >
                                {/if}
                            </div>
                            {#if result}
                                {@const picked = question.options.find(
                                    (option) =>
                                        option.option_id === practice.answers[question.question_id],
                                )}
                                <div
                                    data-practice-feedback
                                    class="grid gap-2"
                                    in:fly={{ y: 8, duration: 200 }}
                                >
                                    {#if !result.skipped}
                                        <p class="font-semibold">
                                            {#if result.correct}<span class="text-[#7fd1a0]"
                                                    >Correct.</span
                                                >{:else}<span class="text-[#e8a857]"
                                                    >Not quite.</span
                                                >{/if}
                                        </p>
                                    {/if}
                                    {#if picked}<p
                                            class="text-ink-soft leading-[1.7]"
                                            lang={chapter?.locale}
                                            dir={language_direction(chapter?.locale)}
                                        >
                                            {picked.feedback}
                                        </p>{/if}
                                    <p
                                        class="text-ink leading-[1.7]"
                                        lang={chapter?.locale}
                                        dir={language_direction(chapter?.locale)}
                                    >
                                        {question.explanation}
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
                            {#each passage as unit (unit.unit_id)}
                                {@render source_part(unit)}
                            {/each}
                            {@render original_details(passage)}
                        </div>
                    {/key}
                {:else if practice}
                    {@const score = tick_count >= 0 && practice_score(practice)}
                    <div class="grid gap-3">
                        <p class="font-serif text-[2rem]">
                            {local_number(score.correct)} of {local_number(score.total)}
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
