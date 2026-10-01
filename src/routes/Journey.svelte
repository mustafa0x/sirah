<script>
    import { onMount } from 'svelte'
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

    let journey = $state(create_journey_state())
    let question = $state(chapter.question.prompt)
    let question_input = $state()
    let clock
    let pending_timers = new Set()
    let selected_step = $derived(get_step(journey.viewed_step_id))
    let visible_sources = $derived(sources_for(selected_step))
    let current_cue = $derived(
        journey.guided_position.step_id === journey.viewed_step_id
            ? cue_for(selected_step, journey.guided_position.seconds)
            : null,
    )
    let is_last_step = $derived(selected_step.id === 'arrival')

    function announce(message) {
        journey.announcement = message
    }

    function start(presentation) {
        start_journey(journey, presentation)
        clock?.set_position(0)
        if (presentation === 'scene') play()
    }

    function play() {
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
        let ticket
        try {
            ticket = begin_navigation(journey, step_id, purpose, purpose === 'detour' ? 0 : 0)
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
            source_ids: selected_step.source_ids,
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

    function view_source(source_id) {
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
        const index = chapter.steps.findIndex((step) => step.id === selected_step.id)
        select_step(chapter.steps[index + 1].id)
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
        content="A draft, source-linked first learner journey through selected stages of the Hijrah."
    />
</svelte:head>

<header class="site-header">
    <a class="wordmark" href="/" aria-label="Sirah Journey home">Sirah Journey</a>
    <span class="status-label">First chapter · draft content</span>
</header>

{#if !journey.started}
    <section class="hero" aria-labelledby="journey-title">
        <p class="eyebrow">A guided interactive documentary · working draft</p>
        <h1 id="journey-title">The Hijrah,<br /><em>in stages.</em></h1>
        <p class="intro-copy">
            Follow a selected account from preparations to arrival. Pause, read, ask a bounded
            question, inspect the evidence, and return to your place.
        </p>
        <div class="hero-actions">
            <button class="primary" onclick={() => start('scene')}>Start guided journey</button>
            <button class="secondary" onclick={() => start('reading')}>Read instead</button>
        </div>
        <p class="draft-note">
            <strong>Working draft.</strong> Learner wording, scene art, and source selection remain pending
            scholarly and publication review. No narration is included.
        </p>
    </section>
{:else}
    <section class="journey-intro" aria-labelledby="journey-title">
        <div>
            <p class="eyebrow">
                {journey.phase === 'completed' ? 'Chapter complete' : 'Selected chapter · draft'}
            </p>
            <h1 id="journey-title">{chapter.title}</h1>
            <p>{chapter.objective}</p>
        </div>
        <div class="mode-note" aria-label="Content status">
            <span class="status-dot"></span> Text and evidence available · voice not approved
        </div>
    </section>

    <div class="journey-layout">
        <aside class="path-card" aria-labelledby="path-heading">
            <div class="section-heading">
                <p class="eyebrow">Chapter path</p>
                <h2 id="path-heading">Five stages</h2>
            </div>
            <ol class="stop-list">
                {#each chapter.steps as step, index (step.id)}
                    <li>
                        <button
                            class:active={journey.viewed_step_id === step.id}
                            class:pending={journey.navigation_pending &&
                                journey.viewed_step_id !== step.id}
                            class="stop"
                            onclick={() => select_step(step.id)}
                            aria-current={journey.viewed_step_id === step.id ? 'step' : undefined}
                        >
                            <span class="stop-number">0{index + 1}</span>
                            <span
                                ><strong>{step.title}</strong><small
                                    >{step.scene === 'thawr'
                                        ? 'Illustrated shelter'
                                        : 'Schematic overview'}</small
                                ></span
                            >
                        </button>
                    </li>
                {/each}
            </ol>
            <p class="path-help">
                You can revisit a stage without changing the selected evidence boundary.
            </p>
        </aside>

        <main class="journey-main">
            <section class="presentation-card" aria-labelledby="stop-title">
                <div class="card-topline">
                    <span>{journey.presentation === 'reading' ? 'Reading mode' : 'Scene mode'}</span
                    ><span>Illustration draft · review pending</span>
                </div>
                {#if journey.presentation === 'scene'}
                    {#key `${journey.viewed_step_id}-${selected_step.scene}`}
                        <SceneCanvas
                            kind={selected_step.scene}
                            label={`${selected_step.title} draft illustration`}
                        />
                    {/key}
                    <p class="illustration-note">
                        The scene is a schematic illustration. People, exact architecture, measured
                        routes, and the unseen are not depicted.
                    </p>
                {/if}
                <div class="reading-content">
                    <p class="eyebrow">{selected_step.title}</p>
                    <h2 id="stop-title">{selected_step.title}</h2>
                    {#each selected_step.paragraphs as paragraph (paragraph.id)}
                        <p class="narration-paragraph">{paragraph.text}</p>
                        <div class="paragraph-sources">
                            {#each paragraph.source_ids as source_id (source_id)}
                                <button class="citation-link" onclick={() => view_source(source_id)}
                                    >Source {source_id}</button
                                >
                            {/each}
                        </div>
                    {/each}
                    {#if journey.phase === 'completed' && selected_step.recap}
                        <div class="recap" aria-labelledby="recap-title">
                            <p class="eyebrow">Recap</p>
                            <h3 id="recap-title">What to carry forward</h3>
                            <p>{selected_step.recap}</p>
                        </div>
                    {/if}
                </div>
            </section>

            <section class="control-card" aria-labelledby="controls-heading">
                <div class="control-heading">
                    <div>
                        <p class="eyebrow">
                            {journey.presentation === 'reading'
                                ? 'Readable without audio'
                                : 'Guided presentation'}
                        </p>
                        <h2 id="controls-heading">
                            {journey.is_playing
                                ? 'Playing the draft track'
                                : 'Paused at ' + journey.guided_position.seconds.toFixed(1) + 's'}
                        </h2>
                    </div>
                    <span class="cue-label"
                        >{journey.guided_position.step_id === journey.viewed_step_id
                            ? 'Cue: ' + (current_cue?.id ?? selected_step.paragraphs[0].id)
                            : 'Guided cue paused'}</span
                    >
                </div>
                <div class="control-actions">
                    {#if journey.is_playing}<button class="secondary" onclick={pause_playback}
                        >Pause</button
                    >{:else}<button
                        class="primary"
                        onclick={play}>Play</button
                    >{/if}
                    <button class="secondary" onclick={() => toggle_reading(journey)}
                        >{journey.presentation === 'reading'
                            ? 'Show scene'
                            : 'Read instead'}</button
                    >
                    {#if journey.viewed_step_id === 'thawr'}<button
                            class="secondary"
                            onclick={ask_about_this}>Ask about this</button
                        >{/if}
                    <button class="text-button" onclick={() => view_source(visible_sources[0]?.id)}
                        >View sources</button
                    >
                </div>
                <label class="seek-label" for="journey-seek"
                    >Guided position <span
                        >{journey.guided_position.seconds.toFixed(1)} / {get_step(journey.guided_position.step_id)
                            .duration}s</span
                    ></label
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
                <p class="media-note">
                    Narration is not shipped while voice rights and pronunciation are under review.
                    This deterministic clock keeps pause, seek, cues, and resume testable.
                </p>
            </section>

            {#if journey.viewed_step_id === 'thawr' && !journey.answer && journey.panel === 'none'}
                <div class="question-invite">
                    <div>
                        <p class="eyebrow">Your question</p>
                        <h2>What happened next?</h2>
                        <p>
                            Ask the authored chapter question and inspect the evidence before
                            choosing an onward detour.
                        </p>
                    </div>
                    <button class="primary" onclick={ask_about_this}>Ask about this</button>
                </div>
            {/if}

            {#if journey.panel === 'question'}
                <section class="guide-card" aria-labelledby="guide-heading">
                    <p class="eyebrow">
                        Bounded chapter guide · {journey.question_pending
                            ? 'checking evidence'
                            : 'draft local provider'}
                    </p>
                    <h2 id="guide-heading">Ask about this stop</h2>
                    <form onsubmit={submit_question}>
                        <label for="guide-question">Your question</label>
                        <textarea
                            id="guide-question"
                            bind:this={question_input}
                            bind:value={question}
                            maxlength="1200"
                            rows="3"></textarea>
                        <div class="form-actions">
                            <button
                                class="primary"
                                type="submit"
                                disabled={journey.question_pending}
                                >{journey.question_pending
                                    ? 'Checking…'
                                    : 'Answer from this chapter'}</button
                            ><button class="text-button" type="button" onclick={close_source}
                                >Close</button
                            >
                        </div>
                    </form>
                    {#if journey.answer}{@render Answer({
                            answer: journey.answer,
                            on_source: view_source,
                            on_action: show_action,
                        })}{/if}
                </section>
            {/if}

            {#if journey.answer && journey.panel !== 'source'}
                <section class="answer-card" aria-live="polite">
                    <p class="eyebrow">Answer · {journey.answer.status}</p>
                    <p>{journey.answer.answer}</p>
                    <div class="answer-actions">
                        {#each journey.answer.citations ?? [] as source_id}<button
                                class="citation-link"
                                onclick={() => view_source(source_id)}>View {source_id}</button
                            >{/each}{#if journey.answer.action}<button
                                class="primary"
                                onclick={show_action}>{journey.answer.action.label}</button
                            >{/if}
                    </div>
                </section>
            {/if}

            {#if journey.viewed_step_id === 'onward' && journey.mode === 'detour'}
                <section class="detour-card" aria-labelledby="detour-heading">
                    <p class="eyebrow">Onward overview · detour</p>
                    <h2 id="detour-heading">Your Thawr position is saved.</h2>
                    <p>
                        Explore this selected next stage, then return explicitly. The schematic
                        coastal connection does not claim an exact route.
                    </p>
                    <button class="primary" onclick={resume_from_detour}>Resume journey</button>
                </section>
            {/if}

            <div class="continue-row">
                <span>{is_last_step ? 'Finish with the recap' : 'Continue when ready'}</span><button
                    class="secondary"
                    onclick={continue_chapter}
                    >{is_last_step ? 'Complete chapter' : 'Next stage'}</button
                >
            </div>
        </main>
    </div>
{/if}

{#if journey.panel === 'source' && journey.source_id}
    {@const active_source = get_source(journey.source_id)}
    <aside class="source-drawer" aria-labelledby="source-title">
        <div class="drawer-heading">
            <div>
                <p class="eyebrow">Evidence · {active_source?.review_status}</p>
                <h2 id="source-title">{active_source?.work}</h2>
                <p class="source-locator">{active_source?.locator}</p>
            </div>
            <button class="close-button" onclick={close_source} aria-label="Close source">×</button>
        </div>
        <p class="citation-status">
            {active_source?.citation_status}. This source slot is visible for honest draft review;
            it is not a publication approval.
        </p>
        <blockquote dir="rtl">{active_source?.excerpt}</blockquote>
        <p>{active_source?.explanation}</p>
        <p class="source-limits"><strong>Limit:</strong> {active_source?.limits}</p>
        <a href={active_source?.url} target="_blank" rel="noreferrer"
            >Open the working record <span aria-hidden="true">↗</span></a
        >
        <button class="secondary drawer-close" onclick={close_source}>Close source</button>
    </aside>
{/if}

{#if journey.phase === 'completed'}
    <section class="completion-banner" aria-labelledby="completion-title">
        <p class="eyebrow">Journey complete</p>
        <h2 id="completion-title">You reached the recap.</h2>
        <p>
            The chapter remains a selected, draft account. You can revisit any stage and its source
            trail.
        </p>
    </section>
{/if}

<p class="announcement" role="status" aria-live="polite">{journey.announcement}</p>

<footer class="site-footer">
    <span>First playable chapter · content and visuals remain draft.</span><span
        >Sources are shown with their limits.</span
    >
</footer>

{#snippet Answer({ answer, on_source, on_action })}
    <div class="inline-answer">
        <p><strong>{answer.answer}</strong></p>
        <p class="answer-meta">Status: {answer.status} · Confidence: {answer.confidence}</p>
        <div class="answer-actions">
            {#each answer.citations ?? [] as source_id}<button
                    class="citation-link"
                    onclick={() => on_source(source_id)}>View {source_id}</button
                >{/each}{#if answer.action}<button class="primary" onclick={on_action}
                    >{answer.action.label}</button
                >{/if}
        </div>
    </div>
{/snippet}
