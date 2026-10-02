<script>
    import { onMount } from 'svelte'
    import { SvelteSet } from 'svelte/reactivity'
    import SceneCanvas from '../lib/SceneCanvas.svelte'
    import {
        chapter,
        cue_for,
        get_source,
        get_step,
        sources_for,
    } from '../content/first-chapter.js'
    import {
        answer_permission,
        begin_navigation,
        begin_play,
        begin_question,
        close_panel,
        commit_navigation,
        complete_chapter,
        create_journey_state,
        open_source,
        pause,
        publish_answer,
        start_journey,
        toggle_reading,
    } from '../lib/journey-state.js'
    import { ask_guide } from '../lib/guide-provider.js'
    import { create_media_clock } from '../lib/media-clock.js'
    import { scene_beat_pois, scene_pois } from '../lib/scene-manifest.js'

    let journey = $state(create_journey_state())
    let active_poi = $state(null)
    let question = $state(chapter.question.prompt)
    let question_input = $state()
    let clock
    let pending_timers = new SvelteSet()
    let selected_step = $derived(get_step(journey.viewed_step_id))
    let visible_sources = $derived(sources_for(selected_step))
    let selected_index = $derived(chapter.steps.findIndex((step) => step.id === selected_step.id))
    let current_cue = $derived(
        journey.guided_position.step_id === journey.viewed_step_id
            ? cue_for(selected_step, journey.guided_position.seconds)
            : null,
    )
    let auto_poi_id = $derived(current_cue ? scene_beat_pois[current_cue.id] : null)
    let selected_poi_id = $derived(active_poi?.id ?? auto_poi_id)
    let is_last_step = $derived(selected_step.id === 'arrival')
    let story_text = $derived(current_cue?.text ?? selected_step.paragraphs[0]?.text ?? '')

    function announce(message) {
        journey.announcement = message
    }

    function start(presentation) {
        active_poi = null
        start_journey(journey, presentation)
        clock?.set_position(0)
        if (presentation === 'scene') play()
    }

    function play() {
        active_poi = null
        if (!journey.started) start('scene')
        try {
            const ticket = begin_play(journey)
            if (clock?.play()) {
                journey.is_playing = true
                announce('Guided presentation is playing.')
            } else {
                journey.is_playing = false
                announce('Audio has not started. Continue with the text.')
            }
            return ticket
        } catch {
            announce('Restore the guided position before playback.')
            return null
        }
    }

    function pause_playback() {
        const seconds = clock?.snapshot().seconds ?? journey.guided_position.seconds
        clock?.pause()
        pause(journey, seconds)
        announce('Guided presentation paused. Your position is saved.')
    }

    function select_step(step_id, purpose = 'guided') {
        if (step_id === journey.viewed_step_id && !journey.navigation_pending) return
        active_poi = null
        let ticket
        try {
            ticket = begin_navigation(journey, step_id, purpose, 0)
        } catch {
            announce('That chapter stop is not available.')
            return
        }
        clock?.pause()
        const timer = window.setTimeout(() => {
            pending_timers.delete(timer)
            if (commit_navigation(journey, ticket, journey.presentation)) {
                announce(
                    purpose === 'detour'
                        ? 'Onward reading opened. Your guided position is preserved.'
                        : `${get_step(step_id).title} opened.`,
                )
            }
        }, 120)
        pending_timers.add(timer)
    }

    function move_step(offset) {
        const next_index = Math.max(0, Math.min(chapter.steps.length - 1, selected_index + offset))
        select_step(chapter.steps[next_index].id)
    }

    function resume_from_detour() {
        const ticket = begin_navigation(
            journey,
            journey.guided_position.step_id,
            'restore',
            journey.guided_position.seconds,
        )
        const timer = window.setTimeout(() => {
            pending_timers.delete(timer)
            if (commit_navigation(journey, ticket, journey.presentation)) {
                clock?.set_position(journey.guided_position.seconds)
                announce(
                    'The original guided position is restored. Playback remains paused until Play.',
                )
            }
        }, 120)
        pending_timers.add(timer)
    }

    async function submit_question(event) {
        event.preventDefault()
        if (!question.trim() || journey.question_pending) return
        clock?.pause()
        const ticket = begin_question(
            journey,
            clock?.snapshot().seconds ?? journey.guided_position.seconds,
        )
        journey.question_pending = true
        const context = {
            chapter_id: chapter.id,
            step_id: journey.viewed_step_id,
            source_ids: [
                ...new Set([...selected_step.source_ids, ...chapter.question.expected_sources]),
            ],
            objective: chapter.objective,
        }
        const response = await ask_guide(question.trim(), context)
        if (answer_permission(journey, ticket).text && publish_answer(journey, ticket, response)) {
            announce('Bounded answer ready. Its cited evidence is available below.')
        }
    }

    function ask_about_this() {
        if (journey.viewed_step_id !== 'thawr') {
            announce('The authored question is placed at the Thawr stop.')
            return
        }
        begin_question(journey, clock?.snapshot().seconds ?? journey.guided_position.seconds)
        question = chapter.question.prompt
        tick().then(() => question_input?.focus())
    }

    function select_poi(poi) {
        active_poi = poi
        announce(`${poi.label} view selected.`)
    }

    function view_source(source_id) {
        if (!source_id) return
        open_source(
            journey,
            source_id,
            clock?.snapshot().seconds ?? journey.guided_position.seconds,
        )
    }

    function close_source() {
        close_panel(journey)
    }

    function show_action() {
        if (journey.answer?.action?.step_id) select_step(journey.answer.action.step_id, 'detour')
    }

    function continue_chapter() {
        if (is_last_step) {
            complete_chapter(journey)
            return
        }
        select_step(chapter.steps[selected_index + 1].id)
    }

    function tick() {
        return new Promise((resolve) => window.setTimeout(resolve))
    }

    onMount(() => {
        clock = create_media_clock({
            duration: () => get_step(journey.guided_position.step_id).duration,
            on_tick(seconds, playing) {
                if (journey.mode === 'guided' && !journey.navigation_pending) {
                    journey.guided_position.seconds = seconds
                    journey.is_playing = playing
                    if (!playing && seconds >= get_step(journey.guided_position.step_id).duration)
                        announce('Stop complete. Continue when you are ready.')
                }
            },
        })
        return () => {
            pending_timers.forEach((timer) => window.clearTimeout(timer))
            pending_timers.clear()
            clock?.dispose()
        }
    })
</script>

<svelte:head>
    <title>{chapter.title} · Sirah Journey</title>
    <meta
        name="description"
        content="A source-linked learner journey through selected stages of the Hijrah."
    />
</svelte:head>

<div class="experience-shell">
    <div class="world-stage" aria-label="Sirah Journey experience">
        <div class="world-layer">
            {#key `${journey.viewed_step_id}-${selected_step.scene}`}
                <SceneCanvas
                    kind={selected_step.scene}
                    label={`${selected_step.title} illustration`}
                    on_poi={select_poi}
                    {selected_poi_id}
                />
            {/key}
        </div>
        <div class="world-vignette" aria-hidden="true"></div>

        <header class="stage-header">
            <a class="stage-brand" href="/" aria-label="Sirah Journey home">
                <span class="brand-mark" aria-hidden="true">✦</span>
                <span>Sirah Journey</span>
            </a>
            <div class="stage-tools">
                <button class="icon-button" aria-label="Help">?</button>
                <button class="icon-button" aria-label="Experience settings">⋯</button>
            </div>
        </header>

        <aside class="story-rail" aria-label="Chapter navigation">
            <div class="rail-heading">
                <p class="rail-kicker">Historical log</p>
                <h1>The Hijrah</h1>
                <p class="rail-subtitle">A journey in stages</p>
                <div class="rail-nav">
                    <button
                        class="rail-nav-button"
                        onclick={() => move_step(-1)}
                        disabled={selected_index === 0}
                    >
                        ‹ Prev
                    </button>
                    <button
                        class="rail-nav-button"
                        onclick={() => move_step(1)}
                        disabled={is_last_step}
                    >
                        Next ›
                    </button>
                </div>
            </div>
            <div class="rail-current">
                <div class="rail-avatar" aria-hidden="true">SJ</div>
                <div>
                    <strong>{selected_step.title}</strong>
                    <span
                        >{selected_step.scene === 'thawr'
                            ? 'Illustrated shelter'
                            : 'Schematic overview'}</span
                    >
                </div>
            </div>
            <ol class="rail-stops">
                {#each chapter.steps as step, index (step.id)}
                    <li>
                        <button
                            class:active={journey.viewed_step_id === step.id}
                            class:pending={journey.navigation_pending &&
                                journey.viewed_step_id !== step.id}
                            onclick={() => select_step(step.id)}
                            aria-current={journey.viewed_step_id === step.id ? 'step' : undefined}
                        >
                            <span>{index + 1}</span>
                            <strong>{step.title}</strong>
                        </button>
                    </li>
                {/each}
            </ol>
            <p class="rail-note">A selected account with an explicit source trail.</p>
        </aside>

        <nav class="progress-rail" aria-label="Journey progress">
            {#each chapter.steps as step, index (step.id)}
                <button
                    class:active={journey.viewed_step_id === step.id}
                    class:complete={index < selected_index}
                    onclick={() => select_step(step.id)}
                    aria-label={`Go to stage ${index + 1}: ${step.title}`}
                    aria-current={journey.viewed_step_id === step.id ? 'step' : undefined}
                    >{index + 1}</button
                >
            {/each}
        </nav>

        {#if journey.started && journey.panel === 'none' && journey.presentation === 'scene'}
            <div class="scene-points" aria-label="Explore this scene">
                <span>Explore view</span>
                {#each scene_pois[selected_step.scene] ?? [] as poi (poi.id)}
                    <button
                        class:active={selected_poi_id === poi.id}
                        onclick={() => select_poi(poi)}
                        title={poi.description}>{poi.label}</button
                    >
                {/each}
            </div>
        {/if}

        {#if !journey.started}
            <section class="story-card entry-card" aria-labelledby="entry-title">
                <p class="card-label">Begin the chapter</p>
                <h2 id="entry-title">Follow the journey through five connected stages.</h2>
                <p>
                    Move through the scene, pause to read, and inspect evidence without losing your
                    place.
                </p>
                <div class="card-actions">
                    <button class="gold-button" onclick={() => start('scene')}
                        >Start guided journey</button
                    >
                    <button class="outline-button" onclick={() => start('reading')}
                        >Read instead</button
                    >
                </div>
            </section>
        {:else if journey.panel === 'none' && journey.presentation === 'scene'}
            <section class="story-card narrative-card" aria-live="polite">
                <p class="card-label">{selected_step.title}</p>
                <p class="narrative-text">{story_text}</p>
                <div class="card-actions">
                    {#if journey.is_playing}
                        <button class="outline-button" onclick={pause_playback}>Ⅱ Pause</button>
                    {:else}
                        <button class="gold-button" onclick={play}>▶ Play</button>
                    {/if}
                    <button class="outline-button" onclick={() => toggle_reading(journey)}
                        >Read this stop</button
                    >
                    {#if journey.viewed_step_id === 'thawr'}
                        <button class="outline-button" onclick={ask_about_this}
                            >Ask about this</button
                        >
                    {/if}
                </div>
            </section>
        {:else if journey.panel === 'none' && journey.mode === 'detour'}
            <section class="story-card narrative-card detour-card" aria-labelledby="detour-heading">
                <p class="card-label">Onward overview · detour</p>
                <h2 id="detour-heading">Your guided position is saved.</h2>
                <p class="narrative-text">
                    Explore this selected stage, then return explicitly to the original position.
                </p>
                <button class="gold-button" onclick={resume_from_detour}>Resume journey</button>
            </section>
        {/if}

        {#if journey.started && journey.panel === 'none' && journey.presentation === 'scene'}
            <div class="stage-footer-controls">
                <span
                    >{journey.guided_position.seconds.toFixed(1)} / {get_step(journey.guided_position.step_id)
                        .duration}s</span
                >
                <input
                    id="journey-seek"
                    type="range"
                    min="0"
                    max={get_step(journey.guided_position.step_id).duration}
                    step="0.1"
                    value={journey.guided_position.seconds}
                    oninput={(event) => {
                        clock?.seek(+event.currentTarget.value)
                        pause(journey, +event.currentTarget.value)
                    }}
                    aria-label="Seek guided position"
                />
                <button class="footer-control" onclick={() => toggle_reading(journey)}>Read</button>
                <button class="footer-control" onclick={() => view_source(visible_sources[0]?.id)}
                    >Sources</button
                >
            </div>
        {/if}

        {#if journey.started && journey.presentation === 'reading' && journey.panel === 'none'}
            <section class="overlay-panel reading-panel" aria-labelledby="reading-title">
                <div class="overlay-heading">
                    <div>
                        <p class="card-label">Reading mode · {selected_step.title}</p>
                        <h2 id="reading-title">{selected_step.title}</h2>
                    </div>
                    <button
                        class="close-overlay"
                        onclick={() => toggle_reading(journey)}
                        aria-label="Close reading mode">×</button
                    >
                </div>
                <div class="reading-scroll">
                    {#each selected_step.paragraphs as paragraph (paragraph.id)}
                        <p>{paragraph.text}</p>
                        <div class="paragraph-sources">
                            {#each paragraph.source_ids as source_id (source_id)}
                                <button class="citation-link" onclick={() => view_source(source_id)}
                                    >Source {source_id}</button
                                >
                            {/each}
                        </div>
                    {/each}
                    {#if journey.phase === 'completed' && selected_step.recap}
                        <div class="recap-block">
                            <p class="card-label">Recap</p>
                            <h3>What to carry forward</h3>
                            <p>{selected_step.recap}</p>
                        </div>
                    {/if}
                </div>
                <div class="overlay-actions">
                    {#if is_last_step}
                        <button class="gold-button" onclick={continue_chapter}
                            >Complete chapter</button
                        >
                    {:else}
                        <button class="outline-button" onclick={continue_chapter}
                            >Next stage →</button
                        >
                    {/if}
                    {#if selected_step.id === 'thawr'}
                        <button class="outline-button" onclick={ask_about_this}
                            >Ask about this</button
                        >
                    {/if}
                </div>
            </section>
        {/if}

        {#if journey.panel === 'question'}
            <section class="overlay-panel question-panel" aria-labelledby="guide-heading">
                <div class="overlay-heading">
                    <div>
                        <p class="card-label">Question layer</p>
                        <h2 id="guide-heading">Ask about this stop</h2>
                    </div>
                    <button class="close-overlay" onclick={close_source} aria-label="Close question"
                        >×</button
                    >
                </div>
                <form onsubmit={submit_question}>
                    <label for="guide-question">Your question</label>
                    <textarea
                        id="guide-question"
                        bind:this={question_input}
                        bind:value={question}
                        maxlength="1200"
                        rows="4"></textarea>
                    <div class="overlay-actions">
                        <button
                            class="gold-button"
                            type="submit"
                            disabled={journey.question_pending}
                        >
                            {journey.question_pending
                                ? 'Checking evidence…'
                                : 'Answer from this chapter'}
                        </button>
                        <button class="outline-button" type="button" onclick={close_source}
                            >Return to scene</button
                        >
                    </div>
                </form>
                {#if journey.answer}
                    <div class="answer-block" aria-live="polite">
                        <p class="card-label">Answer · {journey.answer.status}</p>
                        <p>{journey.answer.answer}</p>
                        <div class="overlay-actions">
                            {#each journey.answer.citations ?? [] as source_id (source_id)}
                                <button class="citation-link" onclick={() => view_source(source_id)}
                                    >View {source_id}</button
                                >
                            {/each}
                            {#if journey.answer.action}
                                <button class="gold-button" onclick={show_action}
                                    >{journey.answer.action.label}</button
                                >
                            {/if}
                        </div>
                    </div>
                {/if}
            </section>
        {/if}
    </div>

    {#if journey.panel === 'source' && journey.source_id}
        {@const active_source = get_source(journey.source_id)}
        <aside class="source-drawer" aria-labelledby="source-title">
            <div class="drawer-heading">
                <div>
                    <p class="card-label">Evidence</p>
                    <h2 id="source-title">{active_source?.work}</h2>
                    <p class="source-locator">{active_source?.locator}</p>
                </div>
                <button class="close-overlay" onclick={close_source} aria-label="Close source"
                    >×</button
                >
            </div>
            <blockquote dir="rtl">{active_source?.excerpt}</blockquote>
            <p>{active_source?.explanation}</p>
            <p class="source-limits"><strong>Limit:</strong> {active_source?.limits}</p>
            <a href={active_source?.url} target="_blank" rel="noreferrer"
                >Open the working record ↗</a
            >
            <button class="outline-button drawer-close" onclick={close_source}
                >Return to journey</button
            >
        </aside>
    {/if}
</div>

<p class="announcement" role="status" aria-live="polite">{journey.announcement}</p>

{#if journey.phase === 'completed'}
    <div class="completion-status">Chapter complete · recap available in Reading mode</div>
{/if}
