<script>
    import { onMount } from 'svelte'
    import { SvelteSet } from 'svelte/reactivity'
    import { fade, fly } from 'svelte/transition'
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
        return_to_guided,
        start_journey,
        toggle_reading,
    } from '../lib/journey-state.js'
    import { ask_guide } from '../lib/guide-provider.js'
    import { create_media_clock } from '../lib/media-clock.js'
    import { beat_shots, overview_shot, scene_pois, step_scenes } from '../lib/scene-manifest.js'

    const poi_shots = Object.fromEntries(
        scene_pois.map((poi) => [poi.id, { ...poi.camera, place: poi.place, height: 0.3 }]),
    )
    const suggested_questions = [
        chapter.question.prompt,
        'How long did they stay in the cave?',
        'Who brought them news?',
        'Is the exact route known?',
    ]
    const total_minutes = Math.round(
        chapter.steps.reduce((sum, step) => sum + step.duration, 0) / 60,
    )
    const idle_route = [0, 0]

    let journey = $state(create_journey_state())
    let active_poi = $state(null)
    let question = $state('')
    let question_input = $state()
    let help_open = $state(false)
    let source_origin = $state('none')
    let clock
    let advance_timer = 0
    let pending_timers = new SvelteSet()

    let viewport_width = $state(1280)
    let rail_width = $state(0)
    let sheet_width = $state(0)
    let card_height = $state(0)
    let narrow = $derived(viewport_width <= 760)

    let selected_step = $derived(get_step(journey.viewed_step_id))
    let guided_step = $derived(get_step(journey.guided_position.step_id))
    let visible_sources = $derived(sources_for(selected_step))
    let selected_index = $derived(chapter.steps.findIndex((step) => step.id === selected_step.id))
    let is_last_step = $derived(selected_index === chapter.steps.length - 1)
    let on_guided_stop = $derived(journey.guided_position.step_id === journey.viewed_step_id)
    let current_cue = $derived(
        on_guided_stop ? cue_for(selected_step, journey.guided_position.seconds) : null,
    )
    let story_text = $derived(current_cue?.text ?? selected_step.paragraphs[0]?.text ?? '')
    let stop_progress = $derived(journey.guided_position.seconds / guided_step.duration)
    let stop_finished = $derived(on_guided_stop && stop_progress >= 0.999)
    let sheet = $derived(
        journey.panel === 'source' && journey.source_id
            ? 'source'
            : journey.panel === 'question'
              ? 'question'
              : journey.started && journey.presentation === 'reading'
                ? 'reading'
                : null,
    )
    let card_visible = $derived(journey.started && sheet !== 'reading' && !(narrow && sheet))
    let active_source = $derived(journey.source_id ? get_source(journey.source_id) : null)
    let drawer_sources = $derived(
        !active_source || visible_sources.includes(active_source)
            ? visible_sources
            : [active_source, ...visible_sources],
    )

    let shot = $derived(
        active_poi
            ? poi_shots[active_poi.id]
            : journey.started
              ? beat_shots[(current_cue ?? selected_step.paragraphs[0]).id]
              : overview_shot,
    )
    let mood = $derived(journey.started ? step_scenes[selected_step.id].mood : 'gold')
    let route = $derived(journey.started ? step_scenes[selected_step.id].route : idle_route)
    let insets = $derived(
        narrow
            ? { left: 0, right: 0, top: 120, bottom: journey.started ? card_height + 30 : 300 }
            : {
                  top: 70,
                  left: journey.started ? rail_width + 28 : viewport_width * 0.34,
                  right: sheet ? sheet_width : 0,
                  bottom: card_visible ? card_height + 40 : 0,
              },
    )

    function announce(message) {
        journey.announcement = message
    }

    function format_time(seconds) {
        const whole = Math.floor(seconds)
        return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
    }

    function cancel_advance() {
        window.clearTimeout(advance_timer)
        advance_timer = 0
    }

    function start(presentation) {
        cancel_advance()
        active_poi = null
        start_journey(journey, presentation)
        clock?.set_position(0)
        if (presentation === 'scene') play()
    }

    function play() {
        cancel_advance()
        active_poi = null
        if (!journey.started || journey.mode === 'completed') return start('scene')
        return_to_guided(journey)
        try {
            begin_play(journey)
        } catch {
            announce('Return to the guided position before playback.')
            return
        }
        if (journey.guided_position.seconds >= guided_step.duration) clock?.set_position(0)
        if (clock?.play()) {
            journey.is_playing = true
            announce('Guided presentation is playing.')
        } else {
            journey.is_playing = false
            announce('Playback has not started. Continue with the text.')
        }
    }

    function pause_playback() {
        cancel_advance()
        const seconds = clock?.snapshot().seconds ?? journey.guided_position.seconds
        clock?.pause()
        pause(journey, seconds)
        announce('Guided presentation paused. Your position is saved.')
    }

    function toggle_play() {
        if (journey.is_playing) pause_playback()
        else play()
    }

    function select_step(step_id, purpose = 'guided', autoplay = journey.is_playing) {
        if (step_id === journey.viewed_step_id && !journey.navigation_pending) return
        cancel_advance()
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
            if (!commit_navigation(journey, ticket, journey.presentation)) return
            if (purpose === 'detour') {
                announce('Onward stage opened. Your guided position is preserved.')
                return
            }
            clock?.set_position(0)
            announce(`${get_step(step_id).title} opened.`)
            if (autoplay && journey.presentation === 'scene') play()
        }, 120)
        pending_timers.add(timer)
    }

    function move_step(offset) {
        const next_index = clamp_index(selected_index + offset)
        select_step(chapter.steps[next_index].id)
    }

    function clamp_index(index) {
        return Math.max(0, Math.min(chapter.steps.length - 1, index))
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
                announce('You are back where you left the guided journey. Press Play to continue.')
            }
        }, 120)
        pending_timers.add(timer)
    }

    function seek_to(seconds) {
        cancel_advance()
        active_poi = null
        clock?.seek(seconds)
        journey.guided_position.seconds = seconds
    }

    function finish_stop() {
        if (is_last_step) {
            announce('The last stage is complete.')
            return
        }
        announce('Stage complete. Continuing to the next stage.')
        const next_id = chapter.steps[selected_index + 1].id
        advance_timer = window.setTimeout(() => select_step(next_id, 'guided', true), 1600)
    }

    function open_question() {
        if (journey.navigation_pending) return
        cancel_advance()
        clock?.pause()
        begin_question(journey, clock?.snapshot().seconds ?? journey.guided_position.seconds)
        tick().then(() => question_input?.focus())
    }

    async function submit_question(event) {
        event?.preventDefault()
        if (!question.trim() || journey.question_pending) return
        const ticket = begin_question(
            journey,
            clock?.snapshot().seconds ?? journey.guided_position.seconds,
        )
        journey.answer = null
        journey.question_pending = true
        const context = {
            chapter_id: chapter.id,
            step_id: journey.viewed_step_id,
            source_ids: chapter.sources.map((source) => source.id),
            objective: chapter.objective,
        }
        const response = await ask_guide(question.trim(), context)
        if (answer_permission(journey, ticket).text && publish_answer(journey, ticket, response)) {
            announce('Answer ready. Its cited passages are listed with it.')
        }
    }

    function ask_suggested(prompt) {
        question = prompt
        submit_question()
    }

    function question_keydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) submit_question(event)
    }

    function select_poi(poi) {
        active_poi = active_poi?.id === poi.id ? null : poi
        announce(active_poi ? `${poi.label}. ${poi.description}` : 'Returned to the guided view.')
    }

    function view_source(source_id) {
        if (!source_id) return
        cancel_advance()
        if (journey.panel !== 'source') source_origin = journey.panel
        clock?.pause()
        open_source(
            journey,
            source_id,
            clock?.snapshot().seconds ?? journey.guided_position.seconds,
        )
    }

    function close_sheet() {
        if (sheet === 'reading') {
            toggle_reading(journey)
            return
        }
        const reopen_question = sheet === 'source' && source_origin === 'question'
        close_panel(journey)
        if (reopen_question) journey.panel = 'question'
        else return_to_guided(journey)
        source_origin = 'none'
        announce('Panel closed.')
    }

    function open_reading() {
        if (journey.is_playing) pause_playback()
        if (journey.presentation !== 'reading') toggle_reading(journey)
    }

    function show_action() {
        if (journey.answer?.action?.step_id) select_step(journey.answer.action.step_id, 'detour')
    }

    function continue_chapter() {
        if (is_last_step) {
            cancel_advance()
            clock?.pause()
            complete_chapter(journey)
            return
        }
        select_step(
            chapter.steps[selected_index + 1].id,
            'guided',
            journey.presentation === 'scene',
        )
    }

    function keydown(event) {
        if (event.key === 'Escape') {
            if (help_open) help_open = false
            else if (sheet) close_sheet()
            return
        }
        if (!journey.started || event.metaKey || event.ctrlKey || event.altKey) return
        if (event.target.closest?.('input, textarea, button, a, [contenteditable]')) return
        if (event.key === ' ') {
            event.preventDefault()
            if (sheet !== 'reading') toggle_play()
        } else if (event.key === 'ArrowRight') move_step(1)
        else if (event.key === 'ArrowLeft') move_step(-1)
    }

    function tick() {
        return new Promise((resolve) => window.setTimeout(resolve))
    }

    onMount(() => {
        clock = create_media_clock({
            duration: () => get_step(journey.guided_position.step_id).duration,
            on_tick(seconds, playing) {
                if (journey.mode !== 'guided' || journey.navigation_pending) return
                const was_playing = journey.is_playing
                journey.guided_position.seconds = seconds
                journey.is_playing = playing
                if (was_playing && !playing && seconds >= guided_step.duration) finish_stop()
            },
        })
        return () => {
            cancel_advance()
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

<svelte:window bind:innerWidth={viewport_width} onkeydown={keydown} />

{#snippet icon(name)}
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        {#if name === 'play'}
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
        {:else if name === 'pause'}
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" />
        {:else if name === 'read'}
            <path
                d="M4 5.5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5v12.5c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5zM12 7v12.5"
            />
        {:else if name === 'sources'}
            <path d="M7 3.5h8l4 4V20.5H7zM14.5 3.5V8H19M10 12.5h6M10 16h6" />
        {:else if name === 'ask'}
            <path d="M4.5 5.5h15v10.5H11l-4.5 3.5V16h-2z" />
        {:else if name === 'close'}
            <path d="M6 6l12 12M18 6L6 18" />
        {:else if name === 'next'}
            <path d="M5 12h14M13 6l6 6-6 6" />
        {:else if name === 'back'}
            <path d="M19 12H5M11 6l-6 6 6 6" />
        {:else if name === 'check'}
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        {:else if name === 'external'}
            <path d="M10 5H5v14h14v-5M14 4h6v6M20 4l-9 9" />
        {:else if name === 'replay'}
            <path d="M4.5 12a7.5 7.5 0 1 0 2.5-5.600M4 4.5V9h4.5" />
        {/if}
    </svg>
{/snippet}

{#snippet citations(source_ids)}
    <div class="citations">
        {#each source_ids as source_id (source_id)}
            {@const source = get_source(source_id)}
            <button
                class="citation"
                class:active={journey.source_id === source_id}
                onclick={() => view_source(source_id)}
                aria-label={`Source ${source.number}: ${source.reference}`}
            >
                <span>{source.number}</span>{source.reference}
            </button>
        {/each}
    </div>
{/snippet}

<div class="stage" class:started={journey.started} class:sheet-open={sheet}>
    <div class="world">
        <SceneCanvas
            label="Schematic relief of the route from Makkah to Madinah"
            {shot}
            {mood}
            {route}
            {insets}
            active_poi_id={active_poi?.id ?? null}
            on_poi={select_poi}
        />
    </div>
    <div class="scrim" aria-hidden="true"></div>

    <header class="topbar">
        <a class="brand" href="/" aria-label="Sirah Journey home">
            <span class="brand-mark" aria-hidden="true"></span>
            Sirah Journey
        </a>
        <div class="topbar-tools">
            <span class="draft-badge">Demo · draft wording</span>
            <button
                class="round-button"
                aria-label="How this works"
                aria-expanded={help_open}
                onclick={() => (help_open = !help_open)}>?</button
            >
        </div>
    </header>

    {#if help_open}
        <section
            class="help"
            aria-labelledby="help-title"
            transition:fly={{ y: -8, duration: 180 }}
        >
            <h2 id="help-title">How this works</h2>
            <ul>
                <li>
                    <strong>Play</strong> walks the chapter stage by stage. There is no audio in this
                    demo; the captions keep time.
                </li>
                <li>
                    <strong>Drag</strong> to look around, <strong>scroll</strong> to zoom, and select
                    a place name to fly there.
                </li>
                <li>
                    <strong>Sources</strong> shows the passage behind each paragraph, and what it does
                    not establish.
                </li>
                <li>
                    <strong>Ask</strong> answers only from this chapter’s {chapter.sources.length} cited
                    passages.
                </li>
                <li>
                    <kbd>Space</kbd> play or pause · <kbd>←</kbd> <kbd>→</kbd> change stage ·
                    <kbd>Esc</kbd> close
                </li>
            </ul>
            <p class="fine-print">
                The landscape is an illustration, not a measured map, and depicts no person. Release
                {chapter.release_id}: wording and citations await {chapter.review_status}.
            </p>
        </section>
    {/if}

    {#if !journey.started}
        <section class="hero" aria-labelledby="hero-title" out:fade={{ duration: 250 }}>
            <p class="kicker">Chapter one</p>
            <h1 id="hero-title">The Hijrah</h1>
            <p class="hero-lede">
                Follow the migration from Makkah to Madinah in five stages, with every paragraph
                linked to the passage it rests on.
            </p>
            <p class="hero-meta">
                <span>{chapter.steps.length} stages</span>
                <span>about {total_minutes} minutes</span>
                <span>{chapter.sources.length} cited passages</span>
            </p>
            <div class="hero-actions">
                <button class="primary-button large" onclick={() => start('scene')}>
                    {@render icon('play')} Begin the journey
                </button>
                <button class="ghost-button large" onclick={() => start('reading')}>
                    {@render icon('read')} Read instead
                </button>
            </div>
            <p class="fine-print">
                Hackathon demo. The scene is illustrative and the wording is a draft pending
                scholarly review.
            </p>
        </section>
    {:else}
        <aside class="rail" aria-label="Chapter stages" bind:clientWidth={rail_width} in:fade>
            <p class="kicker">Chapter one</p>
            <h1>The Hijrah</h1>
            <ol class="stops">
                {#each chapter.steps as step, index (step.id)}
                    {@const active = journey.viewed_step_id === step.id}
                    <li class:active class:done={index < selected_index}>
                        <button
                            onclick={() => select_step(step.id)}
                            aria-current={active ? 'step' : undefined}
                            aria-label={`Stage ${index + 1}: ${step.title}`}
                        >
                            <span class="stop-marker">
                                {#if index < selected_index}{@render icon('check')}{:else}{index +
                                        1}{/if}
                            </span>
                            <span class="stop-title">{step.title}</span>
                            <span class="stop-time">{format_time(step.duration)}</span>
                        </button>
                    </li>
                {/each}
            </ol>
            <p class="fine-print rail-note">
                Illustrative scene, not a measured map. Draft wording pending scholarly review.
            </p>
        </aside>
    {/if}

    {#if card_visible}
        <section
            class="card"
            class:detour={journey.mode === 'detour'}
            aria-label="Guided journey"
            bind:clientHeight={card_height}
            in:fly={{ y: 24, duration: 350 }}
        >
            {#if journey.mode === 'detour'}
                <p class="kicker">Side trip · {selected_step.title}</p>
                <p class="caption">{story_text}</p>
                <div class="card-row">
                    <button class="primary-button" onclick={resume_from_detour}>
                        {@render icon('back')} Return to where you were
                    </button>
                    <button class="ghost-button" onclick={open_reading}>
                        {@render icon('read')} Read this stage
                    </button>
                </div>
            {:else}
                <p class="kicker">
                    Stage {selected_index + 1} of {chapter.steps.length} · {selected_step.title}
                </p>
                <div class="caption-box" aria-live="polite">
                    {#key story_text}
                        <p class="caption" in:fade={{ duration: 450 }}>{story_text}</p>
                    {/key}
                </div>
                {#if current_cue}
                    {@render citations(current_cue.source_ids)}
                {/if}
                <div class="transport">
                    <button
                        class="play-button"
                        onclick={toggle_play}
                        aria-label={journey.is_playing ? 'Pause' : 'Play'}
                    >
                        {@render icon(journey.is_playing ? 'pause' : 'play')}
                    </button>
                    <div class="scrubber" style:--fill={`${stop_progress * 100}%`}>
                        <input
                            type="range"
                            min="0"
                            max={guided_step.duration}
                            step="0.1"
                            value={journey.guided_position.seconds}
                            oninput={(event) => seek_to(+event.currentTarget.value)}
                            aria-label="Position in this stage"
                            aria-valuetext={`${format_time(journey.guided_position.seconds)} of ${format_time(guided_step.duration)}`}
                        />
                        <div class="scrubber-ticks" aria-hidden="true">
                            {#each guided_step.paragraphs.slice(1) as paragraph, index (paragraph.id)}
                                <i
                                    style:left={`${((index + 1) / guided_step.paragraphs.length) * 100}%`}
                                ></i>
                            {/each}
                        </div>
                    </div>
                    <span class="time"
                        >{format_time(journey.guided_position.seconds)} / {format_time(
                            guided_step.duration,
                        )}</span
                    >
                </div>
                <div class="card-row">
                    {#if stop_finished && !journey.is_playing}
                        <button class="primary-button" onclick={continue_chapter}>
                            {#if is_last_step}
                                {@render icon('check')} Complete the chapter
                            {:else}
                                Continue: {chapter.steps[selected_index + 1].title}
                                {@render icon('next')}
                            {/if}
                        </button>
                    {/if}
                    <button class="ghost-button" onclick={open_reading}>
                        {@render icon('read')} Read
                    </button>
                    <button
                        class="ghost-button"
                        onclick={() => view_source(visible_sources[0]?.id)}
                    >
                        {@render icon('sources')} Sources
                        <span class="count">{visible_sources.length}</span>
                    </button>
                    <button class="ghost-button" onclick={open_question}>
                        {@render icon('ask')} Ask
                    </button>
                </div>
            {/if}
        </section>
    {/if}

    {#if sheet}
        <aside
            class="sheet"
            aria-labelledby="sheet-title"
            bind:clientWidth={sheet_width}
            transition:fly={{ x: 40, duration: 260 }}
        >
            {#if sheet === 'reading'}
                <header class="sheet-header">
                    <div>
                        <p class="kicker">
                            Reading · stage {selected_index + 1} of {chapter.steps.length}
                        </p>
                        <h2 id="sheet-title">{selected_step.title}</h2>
                    </div>
                    <button class="round-button" onclick={close_sheet} aria-label="Close reading">
                        {@render icon('close')}
                    </button>
                </header>
                {#key selected_step.id}
                    <div class="sheet-body" in:fade={{ duration: 250 }}>
                        {#if journey.phase === 'completed' && selected_step.recap}
                            <div class="recap">
                                <p class="kicker">Chapter complete</p>
                                <h3>What to carry forward</h3>
                                <p>{selected_step.recap}</p>
                                <button class="ghost-button" onclick={() => start('scene')}>
                                    {@render icon('replay')} Start again
                                </button>
                            </div>
                        {/if}
                        {#if journey.mode === 'detour'}
                            <div class="recap">
                                <p class="kicker">Side trip</p>
                                <p>Your place in “{guided_step.title}” is saved.</p>
                                <button class="primary-button" onclick={resume_from_detour}>
                                    {@render icon('back')} Return to where you were
                                </button>
                            </div>
                        {/if}
                        {#each selected_step.paragraphs as paragraph (paragraph.id)}
                            <p class="prose">{paragraph.text}</p>
                            {@render citations(paragraph.source_ids)}
                        {/each}
                    </div>
                {/key}
                <footer class="sheet-footer">
                    <button
                        class="ghost-button"
                        onclick={() => move_step(-1)}
                        disabled={selected_index === 0}
                        aria-label="Previous stage"
                    >
                        {@render icon('back')}
                    </button>
                    {#if is_last_step && journey.phase !== 'completed'}
                        <button class="primary-button" onclick={continue_chapter}>
                            {@render icon('check')} Complete the chapter
                        </button>
                    {:else if !is_last_step}
                        <button class="primary-button" onclick={() => move_step(1)}>
                            <span class="truncate"
                                >Next: {chapter.steps[selected_index + 1].title}</span
                            >
                            {@render icon('next')}
                        </button>
                    {/if}
                    <button class="ghost-button" onclick={open_question}>
                        {@render icon('ask')} Ask
                    </button>
                </footer>
            {:else if sheet === 'question'}
                <header class="sheet-header">
                    <div>
                        <p class="kicker">Ask the sources</p>
                        <h2 id="sheet-title">What would you like to know?</h2>
                    </div>
                    <button class="round-button" onclick={close_sheet} aria-label="Close question">
                        {@render icon('close')}
                    </button>
                </header>
                <div class="sheet-body">
                    <p class="sheet-note">
                        Answers are limited to this chapter’s {chapter.sources.length} cited passages.
                        When they do not settle a question, the answer says so.
                    </p>
                    <form class="ask-form" onsubmit={submit_question}>
                        <label class="sr-only" for="guide-question">Your question</label>
                        <textarea
                            id="guide-question"
                            bind:this={question_input}
                            bind:value={question}
                            onkeydown={question_keydown}
                            maxlength="1200"
                            rows="2"
                            placeholder="Ask about this chapter…"></textarea>
                        <button
                            class="primary-button"
                            type="submit"
                            disabled={journey.question_pending || !question.trim()}
                        >
                            {journey.question_pending ? 'Checking the passages…' : 'Ask'}
                        </button>
                    </form>
                    <div class="suggestions" aria-label="Suggested questions">
                        {#each suggested_questions as prompt (prompt)}
                            <button class="chip" onclick={() => ask_suggested(prompt)}
                                >{prompt}</button
                            >
                        {/each}
                    </div>
                    <div aria-live="polite">
                        {#if journey.answer}
                            <div class="answer" in:fly={{ y: 10, duration: 250 }}>
                                <p class="kicker">From the cited passages</p>
                                <p class="prose">{journey.answer.answer}</p>
                                {@render citations(journey.answer.citations ?? [])}
                                {#if journey.answer.action}
                                    <button class="primary-button" onclick={show_action}>
                                        {journey.answer.action.label}
                                        {@render icon('next')}
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            {:else if active_source}
                <header class="sheet-header">
                    <div>
                        <p class="kicker">Source {active_source.number} · evidence</p>
                        <h2 id="sheet-title">{active_source.reference}</h2>
                    </div>
                    <button class="round-button" onclick={close_sheet} aria-label="Close source">
                        {@render icon('close')}
                    </button>
                </header>
                {#if drawer_sources.length > 1}
                    <div class="source-tabs" role="group" aria-label="Sources for this stage">
                        {#each drawer_sources as source (source.id)}
                            <button
                                class:active={source.id === active_source.id}
                                aria-pressed={source.id === active_source.id}
                                aria-label={`Source ${source.number}: ${source.reference}`}
                                onclick={() => view_source(source.id)}>{source.number}</button
                            >
                        {/each}
                    </div>
                {/if}
                {#key active_source.id}
                    <div class="sheet-body" in:fade={{ duration: 220 }}>
                        <blockquote class="excerpt" dir="rtl" lang="ar">
                            {active_source.excerpt}
                        </blockquote>
                        <p class="excerpt-origin">
                            <span lang="ar" dir="rtl">{active_source.work}</span>
                            {#if active_source.volume}
                                · vol. {active_source.volume}, p. {active_source.page}{/if}
                        </p>
                        <dl class="evidence">
                            <div>
                                <dt>What this passage supports</dt>
                                <dd>{active_source.explanation}</dd>
                            </div>
                            <div class="limit">
                                <dt>What it does not establish</dt>
                                <dd>{active_source.limits}</dd>
                            </div>
                        </dl>
                        <p class="fine-print">Status: {active_source.review_status}.</p>
                    </div>
                {/key}
                <footer class="sheet-footer">
                    <a
                        class="ghost-button"
                        href={active_source.url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open the page on Turath {@render icon('external')}
                    </a>
                    <button class="primary-button" onclick={close_sheet}>
                        {@render icon('back')}
                        {source_origin === 'question'
                            ? 'Back to the answer'
                            : 'Back to the journey'}
                    </button>
                </footer>
            {/if}
        </aside>
    {/if}
</div>

<p class="sr-only" role="status" aria-live="polite">{journey.announcement}</p>
