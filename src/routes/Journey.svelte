<script>
    import { onMount } from 'svelte'
    import { change_language, saved_language } from '../lib/i18n.js'
    import { locales } from '../lib/locale-config.js'
    import { SvelteSet } from 'svelte/reactivity'
    import { fade, fly } from 'svelte/transition'
    import SceneCanvas from '../lib/SceneCanvas.svelte'
    import ChapterReader from '../lib/ChapterReader.svelte'
    import { chapters_for_place } from '../lib/chapters.svelte.js'
    import {
        chapter as source_chapter,
        cue_for,
        get_source,
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
    import { create_ambience } from '../lib/ambience.js'
    import { evidence_dot, evidence_kinds } from '../lib/evidence.js'
    import { timeline, timeline_days, timeline_start } from '../content/timeline.js'
    import { apply_timings, create_narrator } from '../lib/narration.js'
    import {
        change_mode,
        create_mode_chapter,
        mode_detail,
        modes,
        remap_position,
        saved_mode,
    } from '../lib/mode.js'
    import { glossary, kind_notes, why_it_matters } from '../content/lenses.js'
    import {
        create_practice,
        current_question,
        inspect_practice_source,
        next_practice,
        practice_feedback,
        practice_score,
        return_to_practice,
        submit_practice,
    } from '../lib/hijrah-practice.js'
    import {
        load_wording,
        mode_levels,
        packet,
        questions_for,
        worded,
    } from '../lib/practice-view.js'
    import {
        beat_actors,
        beat_passages,
        beat_shots,
        overview_shot,
        route_at,
        scene_pois,
        step_scenes,
        timelapse_beats,
    } from '../lib/scene-manifest.js'

    const poi_shots = Object.fromEntries(
        scene_pois.map((poi) => [poi.id, { height: 0.3, ...poi.camera, place: poi.place }]),
    )
    const suggested_questions = [
        source_chapter.question.prompt,
        'How long did they stay in the cave?',
        'Who brought them news?',
        'Is the exact route known?',
    ]
    const language = saved_language()
    let mode = $state(saved_mode())
    let chapter = $state(prepare_chapter(mode))
    let narrated = $derived(
        chapter.steps.some((step) => step.paragraphs.some((paragraph) => paragraph.narrated)),
    )
    const narrator = create_narrator(language)
    let total_minutes = $derived(
        Math.round(chapter.steps.reduce((sum, step) => sum + step.duration, 0) / 60),
    )
    const idle_route = [0, 0, 0]
    const ambience = create_ambience()
    const button_base =
        'inline-flex gap-2 items-center justify-center min-h-10 px-4 py-2 rounded-full text-[0.875rem] font-semibold no-underline whitespace-nowrap border border-solid transition-[background,border-color,color,transform] duration-150 ease-[ease] not-disabled:active:[transform:scale(0.97)]'
    const primary_button = `${button_base} text-gold-ink bg-gold border-gold-bright not-disabled:hover:bg-gold-bright`
    const ghost_button = `${button_base} text-ink bg-[rgba(255,244,222,0.05)] border-line-strong not-disabled:hover:bg-[rgba(255,244,222,0.12)] not-disabled:hover:border-gold`
    const round_button =
        'grid flex-none size-[38px] place-items-center p-0 text-ink-soft bg-[rgba(17,15,12,0.5)] border border-solid border-line-strong rounded-[50%] transition-[color,border-color] duration-150 ease-[ease] hover:text-white hover:border-gold'
    const kicker = 'text-gold text-[0.8125rem] font-semibold tracking-[0.1em] uppercase'
    const fine_print = 'text-muted text-[0.8125rem] leading-[1.5]'
    const caption =
        'text-ink font-serif text-[1.1875rem] leading-[1.5] text-pretty mobile:text-[1.0625rem]'
    const prose = 'text-ink font-serif text-[1.1875rem] leading-[1.6] text-pretty'
    const sheet_header =
        'flex gap-4 items-start justify-between px-6 pt-6 pb-[18px] border-0 border-b border-solid border-line mobile:px-[18px] mobile:pt-[18px] mobile:pb-[14px]'
    const sheet_title =
        'mt-[6px] font-serif text-[1.75rem] font-medium tracking-[-0.015em] leading-[1.1] mobile:text-[1.5rem]'
    const sheet_body =
        'grid flex-1 gap-4 content-start overflow-y-auto px-6 pt-[22px] pb-7 [scrollbar-color:#6d5529_transparent] [scrollbar-width:thin] mobile:px-[18px] mobile:pt-[18px] mobile:pb-6'
    const sheet_footer =
        'flex gap-2 items-center px-6 pt-[14px] pb-[18px] border-0 border-t border-solid border-line [&>*]:flex-[0_1_auto] [&>a+button]:mr-0 [&>a+button]:ml-auto mobile:px-[18px] mobile:flex-wrap mobile:[&>a]:flex-[1_1_100%] mobile:[&>a]:m-0 mobile:[&>a+button]:flex-[1_1_100%] mobile:[&>a+button]:m-0'
    const recap =
        'grid gap-[10px] justify-items-start p-[18px] bg-[rgba(232,178,87,0.09)] border border-solid border-line-strong rounded-[14px]'
    const card_row = 'flex flex-wrap gap-2 items-center'

    let journey = $state({ ...create_journey_state(), steps: chapter.steps })
    let active_poi = $state(null)
    let active_detail = $derived(active_poi?.detail ? mode_detail(active_poi.detail, mode) : null)
    let question = $state('')
    let question_input = $state()
    let recent_turns = $state([])
    let help_open = $state(false)
    let sound_on = $state(false)
    // In depth, the evidence and the timeline are open from the start.
    let evidence_on = $state(mode === 'deep')
    let timeline_open = $state(mode === 'deep')
    let open_term = $state(null)
    let timeline_pick = $state(null)
    const evidence_counts = Object.fromEntries(
        evidence_kinds.map((kind) => [
            kind,
            chapter.sources.filter((source) => source.kind === kind).length,
        ]),
    )
    const certainty_bar = {
        stated: 'bg-gold border-gold-bright',
        reckoned: 'bg-[rgba(232,178,87,0.18)] border-gold',
        differs:
            'bg-[repeating-linear-gradient(135deg,rgba(232,178,87,0.85)_0_5px,rgba(232,178,87,0.2)_5px_10px)] border-gold',
        undated: 'bg-transparent border-dashed border-[rgba(255,244,222,0.55)]',
    }
    const timeline_ticks = Array.from({ length: timeline_days + 1 }, (_, day) => day)
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
    // Practice: open-book questions from the Arabic bank, shown in place of the story card.
    let practice = $state(null)
    let practice_level = $state(null)
    let practice_step = $state(null)
    let practice_units = $state([])
    let practice_wording = $state(null)
    // The practice module mutates its object; a new key is not tracked, so changes bump this.
    let practice_tick = $state(0)
    load_wording(language).then((wording) => (practice_wording = wording))
    let stage_questions = $derived(questions_for(mode, { step_id: selected_step.id }))
    let practice_question = $derived(
        practice_tick >= 0 && practice ? current_question(practice) : null,
    )
    let practice_view = $derived(
        practice_question ? worded(practice_question, practice_wording) : null,
    )
    let practice_result = $derived(
        practice_tick >= 0 && practice && practice_question ? practice_feedback(practice) : null,
    )
    let practice_done = $derived(Boolean(practice) && !practice_question)
    // The chapter open in the reader, if any.
    let reading_chapter = $state(null)
    let card_visible = $derived(
        journey.started &&
            sheet !== 'reading' &&
            !(narrow && sheet) &&
            !practice &&
            !reading_chapter,
    )
    function find_source(source_id) {
        return (
            get_source(source_id) ??
            journey.answer?.sources?.find((source) => source.id === source_id)
        )
    }

    let active_source = $derived(journey.source_id ? find_source(journey.source_id) : null)
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
    // The route is drawn as the stage plays, so scrubbing moves the journey with it.
    let route = $derived(
        journey.started
            ? route_at(selected_step.id, on_guided_stop ? stop_progress : 1)
            : idle_route,
    )
    let cue_progress = $derived(
        !current_cue
            ? 0
            : current_cue.end === undefined
              ? (stop_progress * selected_step.paragraphs.length) % 1
              : (journey.guided_position.seconds - current_cue.start) /
                (current_cue.end - current_cue.start),
    )
    // Narration follows the clock: the paragraph and offset it is at, and whether it runs.
    $effect(() =>
        narrator.sync(current_cue, journey.guided_position.seconds, journey.is_playing && !sheet),
    )
    let cycle = $derived(
        current_cue && timelapse_beats[current_cue.id] && !active_poi
            ? stop_finished
                ? 1
                : cue_progress
            : null,
    )
    $effect(() => ambience.set_mood(mood))
    let night = $derived(Math.min(3, Math.floor((cycle ?? 0) * 3) + 1))
    let passage = $derived(
        current_cue && beat_passages[current_cue.id] && !active_poi
            ? get_source(beat_passages[current_cue.id])
            : null,
    )
    // The timeline entry in focus: the one picked, or the one for the stage on screen.
    let timeline_entry = $derived(
        timeline.find((item) => item.id === timeline_pick) ??
            timeline.find((item) => item.stage === journey.viewed_step_id) ??
            timeline[0],
    )
    // For someone new to the story: terms in the current caption, and why the stage matters.
    let caption_terms = $derived(
        mode === 'new'
            ? glossary.filter((item) => item.match.some((word) => story_text.includes(word)))
            : [],
    )
    let stage_why = $derived(
        mode === 'new' && current_cue?.id === selected_step.paragraphs.at(-1)?.id
            ? why_it_matters[selected_step.id]
            : null,
    )
    let insets = $derived(
        narrow
            ? { left: 0, right: 0, top: 120, bottom: journey.started ? card_height + 30 : 300 }
            : {
                  top: timeline_open ? 220 : 70,
                  left: journey.started ? rail_width + 28 : viewport_width * 0.34,
                  right: sheet ? sheet_width : active_poi?.detail || evidence_on ? 340 : 0,
                  bottom: card_visible ? card_height + 40 : 0,
              },
    )

    function prepare_chapter(next_mode, keep_steps = []) {
        const result = create_mode_chapter(source_chapter, next_mode, keep_steps)
        apply_timings(result, language)
        return result
    }

    function get_step(id) {
        const step = chapter.steps.find((item) => item.id === id)
        if (!step) throw new Error(`Unknown chapter step: ${id}`)
        return step
    }

    function select_mode(next_mode) {
        if (next_mode === mode) return
        const previous = get_step(journey.guided_position.step_id)
        const seconds = clock?.snapshot().seconds ?? journey.guided_position.seconds
        const was_playing = journey.is_playing
        pending_timers.forEach((timer) => window.clearTimeout(timer))
        pending_timers.clear()
        clock?.pause()
        cancel_advance()
        journey.navigation_generation += 1
        journey.navigation_pending = false
        if (journey.mode === 'pending_navigation') {
            journey.mode =
                journey.viewed_step_id === journey.guided_position.step_id ? 'guided' : 'detour'
            journey.phase = journey.mode
        }
        journey.guide_generation += 1
        journey.question_pending = false
        journey.answer = null
        change_mode(next_mode)
        mode = next_mode
        // A shortened tour retains the stop already being read and the saved guided stop.
        chapter = prepare_chapter(
            mode,
            journey.started ? [journey.viewed_step_id, journey.guided_position.step_id] : [],
        )
        journey.steps = chapter.steps
        journey.guided_position.seconds = remap_position(previous, get_step(previous.id), seconds)
        clock?.set_position(journey.guided_position.seconds)
        evidence_on = mode === 'deep'
        timeline_open = mode === 'deep'
        open_term = null
        if (was_playing && clock?.play()) journey.is_playing = true
        announce('Mode changed. Your place is saved.')
    }

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
        chapter = prepare_chapter(mode)
        journey.steps = chapter.steps
        start_journey(journey, presentation)
        recent_turns = []
        clock?.set_position(0)
        if (presentation === 'scene') {
            set_sound(true)
            play()
        }
    }

    function set_sound(next) {
        sound_on = next
        ambience.set_enabled(next)
        narrator.set_muted(!next)
        ambience.set_mood(mood)
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
        if (!chapter.steps.some((step) => step.id === step_id)) {
            announce('That chapter stop is not available.')
            return
        }
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
        narrator.seek()
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
        const submitted_question = question.trim()
        const context = {
            chapter_id: chapter.id,
            step_id: journey.viewed_step_id,
            source_ids: chapter.sources.map((source) => source.id),
            language: document.documentElement.lang,
            audience: mode,
            available_step_ids: chapter.steps.map((step) => step.id),
            recent_turns,
        }
        const response = await ask_guide(submitted_question, context)
        if (answer_permission(journey, ticket).text && publish_answer(journey, ticket, response)) {
            if (response.provider === 'openai-turath') {
                recent_turns = [
                    ...recent_turns,
                    { role: 'user', text: submitted_question },
                    { role: 'assistant', text: response.answer.slice(0, 4000) },
                ].slice(-4)
            }
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

    function toggle_evidence() {
        evidence_on = !evidence_on
        if (evidence_on) active_poi = null
        announce(
            evidence_on
                ? 'Evidence shown. Each point is a cited passage, coloured by kind.'
                : 'Evidence hidden.',
        )
    }

    function timeline_day(day) {
        const date = new Date(Date.UTC(2001, timeline_start.month - 1, timeline_start.day + day))
        return { day: date.getUTCDate(), september: date.getUTCMonth() === 8 }
    }

    function pick_entry(item, go = false) {
        timeline_pick = item.id
        // Young learners follow fewer stages; an entry whose stage is left out stays in view.
        const shown = chapter.steps.some((step) => step.id === item.stage)
        if (go && shown && item.stage !== journey.viewed_step_id)
            select_step(item.stage, 'guided', false)
    }

    // Scrubbing picks the entry under the handle; letting go moves the journey there.
    function scrub(event, go) {
        const day = +event.currentTarget.value
        const item =
            timeline.find((entry) => day >= entry.from && day <= entry.to) ??
            timeline.reduce((best, entry) =>
                Math.abs(entry.from - day) < Math.abs(best.from - day) ? entry : best,
            )
        pick_entry(item, go)
    }

    function open_practice({ step_id = null, level = null } = {}) {
        const questions = questions_for(mode, { step_id, level })
        if (!questions.length) return
        if (journey.is_playing) pause_playback()
        if (journey.presentation === 'reading') toggle_reading(journey)
        active_poi = null
        practice_step = step_id
        practice_level = level
        practice_units = []
        practice = create_practice(packet, questions)
        practice_tick += 1
        announce(`Practice opened. ${questions.length} questions.`)
    }

    function answer_practice(option_id) {
        submit_practice(practice, option_id)
        practice_tick += 1
        announce(practice_feedback(practice)?.correct ? 'Correct.' : 'Answer recorded.')
    }

    function toggle_passage() {
        if (practice.source_open) {
            return_to_practice(practice)
            practice_units = []
        } else practice_units = inspect_practice_source(practice, packet)
        practice_tick += 1
    }

    function next_question() {
        next_practice(practice)
        practice_units = []
        practice_tick += 1
    }

    function close_practice() {
        practice = null
        practice_units = []
    }

    // Stages whose questions were missed or skipped, to reread.
    function stages_to_reread() {
        const missed = practice.questions.filter(
            (question) => practice.answers[question.question_id] !== question.correct_option_id,
        )
        return chapter.steps.filter((step) =>
            missed.some((question) => question.step_id === step.id),
        )
    }

    // Chapters for the stage on screen, and for a selected place.
    let stage_chapters = $derived(chapters_for_place(selected_step.id))
    let place_chapters = $derived(active_poi ? chapters_for_place(active_poi.place) : [])

    function open_chapter(chapter_id) {
        cancel_advance()
        if (journey.is_playing) pause_playback()
        reading_chapter = chapter_id
    }

    function select_poi(poi) {
        active_poi = active_poi?.id === poi.id ? null : poi
        if (active_poi?.detail && journey.is_playing) pause_playback()
        announce(
            active_poi
                ? `${poi.label}. ${active_detail?.text ?? poi.description}`
                : 'Returned to the guided view.',
        )
    }

    function view_source(source_id) {
        if (!source_id || !find_source(source_id)) return
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
            else if (reading_chapter) reading_chapter = null
            else if (sheet) close_sheet()
            return
        }
        // Keys typed while the chapter is open belong to it, not to playback.
        if (reading_chapter) return
        if (!journey.started || event.metaKey || event.ctrlKey || event.altKey) return
        if (event.target.closest?.('input, textarea, select, button, a, [contenteditable]')) return
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
            can_advance: () => narrator.can_advance(),
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
            ambience.dispose()
            narrator.dispose()
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
    <svg
        class="flex-none size-[1.15em] fill-none stroke-current [stroke-width:1.8] [stroke-linecap:round] [stroke-linejoin:round]"
        viewBox="0 0 24 24"
        aria-hidden="true"
    >
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
        {:else if name === 'sound'}
            <path
                d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"
            />
        {:else if name === 'muted'}
            <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM16 9.5l5 5M21 9.5l-5 5" />
        {:else if name === 'evidence'}
            <circle cx="6" cy="8" r="2" /><circle cx="15" cy="6" r="2" /><circle
                cx="17"
                cy="15"
                r="2"
            /><circle cx="8" cy="17" r="2" />
        {:else if name === 'timeline'}
            <path d="M3 12h18M6 9v6M11 7v10M16 10v4M20 8v8" />
        {/if}
    </svg>
{/snippet}

{#snippet place_chapter_buttons()}
    {#each place_chapters as item (item.chapter_id)}
        <button
            class="{primary_button} justify-self-start"
            onclick={() => open_chapter(item.chapter_id)}
        >
            {@render icon('read')} Read the chapter
            <span class="font-arabic text-[0.9375rem]" lang="ar" dir="rtl">{item.title_ar}</span>
        </button>
    {/each}
{/snippet}

{#snippet citations(source_ids)}
    <div class="flex flex-wrap gap-2">
        {#each source_ids as source_id (source_id)}
            {@const source = find_source(source_id)}
            <button
                class="inline-flex max-w-full min-w-0 gap-[7px] items-center py-[3px] pr-[11px] pl-1 text-start text-ink-soft bg-[rgba(232,178,87,0.08)] border border-solid border-line rounded-full text-[0.8125rem] transition-[border-color,color] duration-150 ease-[ease] hover:text-white hover:border-gold aria-pressed:text-white aria-pressed:border-gold"
                aria-pressed={journey.source_id === source_id}
                onclick={() => view_source(source_id)}
                aria-label={`Source ${source.number}: ${source.reference}`}
            >
                <span
                    class="grid shrink-0 min-w-5 h-5 place-items-center px-[5px] text-gold-ink bg-gold rounded-full text-[0.75rem] font-bold"
                    >{source.number}</span
                ><span class="min-w-0 break-words" dir="auto">{source.reference}</span>
            </button>
        {/each}
    </div>
{/snippet}

<div
    class="group/stage fixed inset-0 overflow-hidden [--rail:0px] [--sheet:0px] [--sheet-width:min(480px,42vw)] data-[started=true]:[--rail:324px] data-[sheet-open=true]:[--sheet:calc(var(--sheet-width)+16px)] mobile:data-[started=true]:[--rail:0px] mobile:data-[sheet-open=true]:[--sheet:0px]"
    data-started={journey.started}
    data-sheet-open={!!sheet}
>
    <div class="absolute inset-0 bg-[linear-gradient(#2f5f8a,#f2c58c_62%,#8d6b4b_62%)]">
        <SceneCanvas
            label="Schematic relief of the route from Makkah to Madinah"
            {shot}
            {mood}
            {route}
            {cycle}
            actor={current_cue && !active_poi ? (beat_actors[current_cue.id] ?? null) : null}
            {insets}
            active_poi_id={active_poi?.id ?? null}
            on_poi={select_poi}
            evidence={evidence_on}
            on_source={view_source}
        />
    </div>
    <div
        class="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(9,8,6,0.72)_0,transparent_150px),linear-gradient(0deg,rgba(9,8,6,0.78)_0,transparent_46%),linear-gradient(90deg,rgba(9,8,6,0.86)_0,rgba(9,8,6,0.5)_30%,transparent_58%)] group-data-[started=true]/stage:bg-[linear-gradient(180deg,rgba(9,8,6,0.6)_0,transparent_130px),linear-gradient(0deg,rgba(9,8,6,0.74)_0,transparent_42%),linear-gradient(90deg,rgba(9,8,6,0.5)_0,transparent_30%)] mobile:bg-[linear-gradient(180deg,rgba(9,8,6,0.8)_0,transparent_190px),linear-gradient(0deg,rgba(9,8,6,0.92)_0,rgba(9,8,6,0.5)_38%,transparent_62%)]!"
        aria-hidden="true"
    ></div>

    <header
        class="absolute z-30 top-0 right-0 left-0 flex justify-between items-center h-[68px] px-6 mobile:h-14 mobile:px-[14px]"
    >
        <a
            class="inline-flex items-center gap-[14px] text-ink font-serif text-[1.25rem] font-semibold no-underline"
            href="/"
            aria-label="Sirah Journey home"
        >
            <span
                class="size-3 ml-1 bg-gold rounded-[2px] shadow-[0_0_0_4px_rgba(232,178,87,0.22)] rotate-45"
                aria-hidden="true"
            ></span>
            Sirah Journey
        </a>
        <div class="flex items-center gap-3">
            <select
                class="min-w-0 max-w-[12rem] rounded-full border border-line bg-panel-solid px-3 py-2 text-ink text-sm mobile:max-w-[8rem]"
                aria-label="Interface language"
                value={saved_language()}
                onchange={(event) => change_language(event.currentTarget.value)}
            >
                {#each locales as locale (locale.code)}
                    <option value={locale.code} lang={locale.code} dir={locale.direction}
                        >{locale.label}</option
                    >
                {/each}
            </select>
            <button
                class={round_button}
                aria-label={sound_on ? 'Turn sound off' : 'Turn sound on'}
                aria-pressed={sound_on}
                onclick={() => set_sound(!sound_on)}
            >
                {@render icon(sound_on ? 'sound' : 'muted')}
            </button>
            {#if journey.started}
                <button
                    class="{round_button} aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright mobile:hidden"
                    aria-label={evidence_on
                        ? 'Hide evidence on the map'
                        : 'Show evidence on the map'}
                    aria-pressed={evidence_on}
                    onclick={toggle_evidence}
                >
                    {@render icon('evidence')}
                </button>
                <button
                    class="{round_button} aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright mobile:hidden"
                    aria-label={timeline_open ? 'Hide timeline' : 'Show timeline'}
                    aria-pressed={timeline_open}
                    onclick={() => {
                        timeline_open = !timeline_open
                        timeline_pick = null
                    }}
                >
                    {@render icon('timeline')}
                </button>
            {/if}
            <button
                class={round_button}
                aria-label="How this works"
                aria-expanded={help_open}
                onclick={() => (help_open = !help_open)}>?</button
            >
        </div>
    </header>

    {#if card_visible && !sheet && (passage || cycle !== null)}
        <div
            class="absolute z-10 top-[88px] right-6 left-[calc(var(--rail)+24px)] grid justify-items-center gap-2 text-center pointer-events-none mobile:top-[112px] mobile:left-6"
            style:top={timeline_open ? (narrow ? '300px' : '250px') : null}
            transition:fade={{ duration: 900 }}
        >
            {#if passage}
                <p
                    class="max-w-[46rem] font-arabic text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.9] text-[#fff6e3] [text-shadow:0_2px_24px_rgba(0,0,0,0.75)]"
                    dir="rtl"
                    lang="ar"
                >
                    {passage.excerpt}
                </p>
                <p class={kicker}>{passage.reference}</p>
            {:else}
                <p class={kicker}>Night {night} of 3</p>
            {/if}
        </div>
    {/if}

    {#if timeline_open && journey.started && !(narrow && sheet) && !practice}
        <section
            class="absolute z-20 top-[76px] right-6 left-[calc(var(--rail)+40px)] grid gap-2 px-5 pt-3 pb-3 bg-panel border border-solid border-line rounded-[18px] shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur-[18px] mobile:top-[104px] mobile:right-3 mobile:left-3 mobile:px-3"
            style:right={sheet ? 'calc(var(--sheet) + 8px)' : null}
            aria-labelledby="timeline-title"
            transition:fly={{ y: -10, duration: 220 }}
        >
            <div class="flex flex-wrap gap-x-4 gap-y-1 items-center">
                <h2 class="{kicker} me-auto" id="timeline-title">
                    The journey day by day · September 622
                </h2>
                <ul
                    class="flex flex-wrap gap-x-3 gap-y-1 list-none text-ink-soft text-[0.75rem] mobile:hidden"
                    aria-label="How each date is known"
                >
                    <li class="flex gap-[6px] items-center">
                        <i class="w-4 h-2 border border-solid rounded-sm {certainty_bar.stated}"
                        ></i>Stated in the account
                    </li>
                    <li class="flex gap-[6px] items-center">
                        <i class="w-4 h-2 border border-solid rounded-sm {certainty_bar.reckoned}"
                        ></i>Reckoned later
                    </li>
                    <li class="flex gap-[6px] items-center">
                        <i class="w-4 h-2 border border-solid rounded-sm {certainty_bar.differs}"
                        ></i>Accounts differ
                    </li>
                    <li class="flex gap-[6px] items-center">
                        <i class="w-4 h-2 border rounded-sm {certainty_bar.undated}"></i>Not dated
                    </li>
                </ul>
            </div>
            <div class="relative h-[58px] mx-1">
                {#each timeline_ticks as day (day)}
                    {@const date = timeline_day(day)}
                    <div
                        class="absolute top-0 bottom-[16px] w-px bg-[rgba(255,244,222,0.1)]"
                        style:left={`${(day / timeline_days) * 100}%`}
                    ></div>
                    {#if day % 3 === 0 || day === 15}
                        <span
                            class="absolute bottom-0 text-muted text-[0.6875rem] tabular-nums whitespace-nowrap [translate:-50%_0]"
                            style:left={`${(day / timeline_days) * 100}%`}
                            >{date.day}{date.september ? '' : ' Oct'}</span
                        >
                    {/if}
                {/each}
                {#each timeline as item (item.id)}
                    {#if item.longest > item.to}
                        <div
                            class="absolute h-[12px] border border-solid rounded-[4px] opacity-35 pointer-events-none {certainty_bar[
                                item.certainty
                            ]}"
                            style:top={`${4 + item.lane * 18}px`}
                            style:left={`${(item.to / timeline_days) * 100}%`}
                            style:width={`${((item.longest - item.to) / timeline_days) * 100}%`}
                        ></div>
                    {/if}
                    <button
                        class="absolute h-[14px] min-w-[14px] p-0 border border-solid rounded-[4px] transition-[outline-color] duration-150 outline-2 outline-offset-2 outline-transparent hover:outline-[rgba(255,244,222,0.6)] aria-pressed:outline-gold-bright {certainty_bar[
                            item.certainty
                        ]}"
                        style:top={`${3 + item.lane * 18}px`}
                        style:left={`${(item.from / timeline_days) * 100}%`}
                        style:width={`${((item.to - item.from) / timeline_days) * 100}%`}
                        aria-pressed={timeline_entry.id === item.id}
                        aria-label={`${item.title}: ${item.when}`}
                        onclick={() => pick_entry(item, true)}
                    ></button>
                {/each}
                <input
                    class="absolute start-0 end-0 bottom-[14px] h-[4px] w-full m-0 opacity-0 hover:opacity-100 focus-visible:opacity-100 accent-[#e8b257] cursor-ew-resize"
                    type="range"
                    min="0"
                    max={timeline_days}
                    step="0.1"
                    value={(timeline_entry.from + timeline_entry.to) / 2}
                    oninput={(event) => scrub(event, false)}
                    onchange={(event) => scrub(event, true)}
                    aria-label="Scrub through the days of the journey"
                />
            </div>
            <div class="grid gap-1" aria-live="polite">
                <p class="flex flex-wrap gap-x-3 items-baseline">
                    <strong class="font-serif text-[1.125rem] font-medium"
                        >{timeline_entry.title}</strong
                    >
                    <span class="text-ink-soft text-[0.875rem]">{timeline_entry.when}</span>
                </p>
                <p class="text-ink-soft text-[0.875rem] leading-[1.5] text-pretty">
                    {timeline_entry.note}
                </p>
                <div class="flex flex-wrap gap-2 items-center">
                    {#if timeline_entry.source_id}
                        {@render citations([timeline_entry.source_id])}
                    {/if}
                    {#if timeline_entry.stage !== journey.viewed_step_id && chapter.steps.some((step) => step.id === timeline_entry.stage)}
                        <button
                            class="{ghost_button} min-h-8 py-1"
                            onclick={() => pick_entry(timeline_entry, true)}
                        >
                            Go to this stage {@render icon('next')}
                        </button>
                    {/if}
                </div>
            </div>
        </section>
    {/if}

    {#if evidence_on && journey.started && !sheet && !practice}
        <section
            class="absolute z-20 right-6 w-[300px] grid gap-3 px-5 pt-4 pb-4 bg-panel border border-solid border-line rounded-[18px] shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur-[18px] mobile:hidden"
            style:top={timeline_open ? '262px' : '84px'}
            aria-labelledby="evidence-title"
            transition:fly={{ x: 16, duration: 220 }}
        >
            <h2 class={kicker} id="evidence-title">Evidence on the map</h2>
            <p class="text-ink-soft text-[0.875rem] leading-[1.5]">
                Each point of light is a passage this chapter cites, placed where it speaks of.
                Select one to read it.
            </p>
            <ul class="grid gap-2 list-none">
                {#each evidence_kinds as kind (kind)}
                    <li class="flex gap-3 items-center text-[0.9375rem]">
                        <i
                            class="size-[11px] rounded-full border border-solid border-[rgba(255,255,255,0.7)] {evidence_dot[
                                kind
                            ]}"
                        ></i>
                        <span class="me-auto">
                            {#if kind === 'quran'}The Quran{:else if kind === 'hadith'}Hadith
                                collections{:else if kind === 'report'}Classical sirah and history{:else}Modern
                                authors{/if}
                        </span>
                        <span class="text-muted tabular-nums">{evidence_counts[kind]}</span>
                    </li>
                {/each}
            </ul>
        </section>
    {/if}

    {#if active_poi?.detail && !sheet}
        <section
            class="absolute z-20 top-[88px] right-6 grid gap-3 w-[min(380px,calc(100%-48px))] px-6 pt-5 pb-[18px] bg-panel border border-solid border-line-strong rounded-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-[18px] backdrop-saturate-[1.2] mobile:top-[112px] mobile:right-3 mobile:left-3 mobile:w-auto mobile:px-4 mobile:pt-4"
            aria-labelledby="detail-title"
            transition:fly={{ x: 24, duration: 260 }}
        >
            <div class="flex gap-4 items-start justify-between">
                <div>
                    <p class={kicker}>Along the way</p>
                    <h2
                        class="mt-[6px] font-serif text-[1.5rem] font-medium leading-[1.15]"
                        id="detail-title"
                    >
                        {active_poi.detail.title}
                    </h2>
                </div>
                <button
                    class={round_button}
                    onclick={() => (active_poi = null)}
                    aria-label="Close detail"
                >
                    {@render icon('close')}
                </button>
            </div>
            <p class="text-ink font-serif text-[1.0625rem] leading-[1.55] text-pretty">
                {active_detail.text}
            </p>
            {@render citations([active_poi.detail.source_id])}
            {@render place_chapter_buttons()}
        </section>
    {/if}

    {#if active_poi && !active_poi.detail && place_chapters.length && !sheet && !reading_chapter}
        <section
            class="absolute z-20 top-[88px] right-6 grid gap-3 w-[min(380px,calc(100%-48px))] px-6 pt-5 pb-[18px] bg-panel border border-solid border-line-strong rounded-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-[18px] mobile:top-[112px] mobile:right-3 mobile:left-3 mobile:w-auto mobile:px-4 mobile:pt-4"
            aria-labelledby="place-title"
            transition:fly={{ x: 24, duration: 260 }}
        >
            <div class="flex gap-4 items-start justify-between">
                <h2 class="font-serif text-[1.5rem] font-medium leading-[1.15]" id="place-title">
                    {active_poi.label}
                </h2>
                <button
                    class={round_button}
                    onclick={() => (active_poi = null)}
                    aria-label="Close detail"
                >
                    {@render icon('close')}
                </button>
            </div>
            <p class="text-ink-soft leading-[1.55]">{active_poi.description}</p>
            {@render place_chapter_buttons()}
        </section>
    {/if}

    {#if reading_chapter}
        <ChapterReader chapter_id={reading_chapter} on_close={() => (reading_chapter = null)} />
    {/if}

    {#if help_open}
        <section
            class="absolute z-40 top-16 right-6 w-[min(400px,calc(100%-32px))] p-[22px] bg-panel-solid border border-solid border-line-strong rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-[16px] mobile:top-14 mobile:right-3"
            aria-labelledby="help-title"
            transition:fly={{ y: -8, duration: 180 }}
        >
            <h2 class="mb-3 font-serif text-[1.4rem] font-medium" id="help-title">
                How this works
            </h2>
            <ul
                class="grid gap-[9px] mb-[14px] list-none [&>li]:text-ink-soft [&>li]:text-[0.875rem] [&>li]:leading-[1.5] [&_strong]:text-ink [&_kbd]:py-px [&_kbd]:px-[6px] [&_kbd]:bg-[rgba(255,244,222,0.1)] [&_kbd]:border [&_kbd]:border-solid [&_kbd]:border-line [&_kbd]:rounded-[5px] [&_kbd]:font-sans [&_kbd]:text-[0.8125rem]"
            >
                <li>
                    {#if narrated}
                        <strong>Play</strong> walks the chapter stage by stage with AI-generated narration.
                    {:else}
                        <strong>Play</strong> walks the chapter stage by stage. The captions keep time
                        over a quiet wind.
                    {/if}
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
                    <strong>Ask</strong> uses the chapter’s context to research in Turath and answer with
                    source citations.
                </li>
                <li>
                    <kbd>Space</kbd> play or pause · <kbd>←</kbd> <kbd>→</kbd> change stage ·
                    <kbd>Esc</kbd> close
                </li>
            </ul>
            <p class="{kicker} mb-2">Mode</p>
            <div class="flex flex-wrap gap-2 mb-[14px]">
                {#each modes as item (item)}
                    <button
                        class="{ghost_button} min-h-8 py-1 aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright"
                        aria-pressed={item === mode}
                        onclick={() => select_mode(item)}
                    >
                        {#if item === 'young'}Young learners{:else if item === 'new'}New to the
                            story{:else}In depth{/if}
                    </button>
                {/each}
            </div>
        </section>
    {/if}

    {#if !journey.started}
        <section
            class="absolute z-20 top-1/2 left-[clamp(24px,7vw,112px)] w-[min(560px,calc(100%-48px))] [transform:translateY(-50%)] animate-rise mobile:top-auto mobile:bottom-[26px] mobile:left-5 mobile:w-[calc(100%-40px)] mobile:transform-none"
            aria-labelledby="hero-title"
            out:fade={{ duration: 250 }}
        >
            <p class={kicker}>Chapter one</p>
            <h1
                class="mt-[10px] mb-5 font-serif text-[clamp(3.6rem,9vw,7rem)] font-medium tracking-[-0.035em] leading-[0.95] [text-shadow:0_2px_30px_rgba(0,0,0,0.45)]"
                id="hero-title"
            >
                The Hijrah
            </h1>
            <p
                class="max-w-[31rem] text-ink font-serif text-[clamp(1.15rem,1.6vw,1.4rem)] leading-[1.45]"
            >
                Follow the migration from Makkah to Madinah stage by stage, with every paragraph
                linked to the passage it rests on.
            </p>
            <p
                class="flex flex-wrap gap-x-0 gap-y-[6px] mt-5 mb-7 text-ink-soft text-[0.875rem] [&>span+span]:before:mx-[10px] [&>span+span]:before:text-gold [&>span+span]:before:content-['·'] mobile:mt-[14px] mobile:mb-5"
            >
                <span>{chapter.steps.length} stages</span>
                <span>about {total_minutes} minutes</span>
                <span>{chapter.sources.length} cited passages</span>
            </p>
            <div
                class="grid grid-cols-3 gap-2 mb-5 mobile:grid-cols-1 mobile:mb-4"
                role="radiogroup"
                aria-label="How would you like to follow the journey?"
            >
                {#each modes as item (item)}
                    <button
                        class="grid gap-1 content-start py-3 px-4 text-start text-ink bg-[rgba(17,15,12,0.45)] border border-solid border-line-strong rounded-2xl backdrop-blur-[8px] transition-[border-color,background] duration-150 hover:border-gold aria-checked:bg-[rgba(232,178,87,0.16)] aria-checked:border-gold mobile:py-2"
                        role="radio"
                        aria-checked={item === mode}
                        onclick={() => select_mode(item)}
                    >
                        <strong class="font-serif text-[1.0625rem] font-medium">
                            {#if item === 'young'}Young learners{:else if item === 'new'}New to the
                                story{:else}In depth{/if}
                        </strong>
                        <span class="text-ink-soft text-[0.8125rem] leading-[1.4] mobile:hidden">
                            {#if item === 'young'}Six short stages, in simple words.{:else if item === 'new'}Terms
                                explained, and why each stage matters.{:else}Every detail, with the
                                evidence and the timeline open.{/if}
                        </span>
                    </button>
                {/each}
            </div>
            <div class="flex flex-wrap gap-3 mb-6 mobile:mb-4 mobile:[&>button]:flex-[1_1_auto]">
                <button
                    class="{primary_button} min-h-[52px] px-6 py-3 text-[1rem]"
                    onclick={() => start('scene')}
                >
                    {@render icon('play')} Begin the journey
                </button>
                <button
                    class="{ghost_button} min-h-[52px] px-6 py-3 text-[1rem]"
                    onclick={() => start('reading')}
                >
                    {@render icon('read')} Read instead
                </button>
            </div>
        </section>
    {:else}
        <aside
            class="absolute z-20 top-[84px] left-5 flex flex-col w-[284px] max-h-[calc(100%-104px)] px-4 pt-[22px] pb-[18px] bg-panel border border-solid border-line rounded-[18px] backdrop-blur-[18px] backdrop-saturate-[1.2] mobile:top-14 mobile:right-0 mobile:left-0 mobile:w-auto mobile:px-[14px] mobile:pt-[6px] mobile:pb-[10px] mobile:bg-transparent mobile:border-0 mobile:rounded-none mobile:backdrop-filter-none"
            aria-label="Chapter stages"
            bind:clientWidth={rail_width}
            in:fade
        >
            <p class="{kicker} px-2 mobile:hidden">Chapter one</p>
            <h1
                class="px-2 mt-1 mb-[18px] font-serif text-[2rem] font-medium tracking-[-0.02em] leading-[1.05] mobile:hidden"
            >
                The Hijrah
            </h1>
            <ol class="grid gap-[2px] list-none mobile:flex mobile:gap-0 mobile:items-center">
                {#each chapter.steps as step, index (step.id)}
                    {@const active = journey.viewed_step_id === step.id}
                    <li
                        class="group/stop relative [&+li]:before:absolute [&+li]:before:top-[-9px] [&+li]:before:start-[21px] [&+li]:before:w-px [&+li]:before:h-[18px] [&+li]:before:bg-line-strong [&+li]:before:content-[''] mobile:[&+li]:before:hidden mobile:data-[active=true]:flex-1 mobile:data-[active=true]:min-w-0"
                        data-active={active}
                        data-done={index < selected_index}
                    >
                        <button
                            class="grid grid-cols-[28px_1fr_auto] gap-3 items-center w-full py-[9px] px-2 text-muted text-start bg-transparent border-0 rounded-[10px] transition-[background,color] duration-150 ease-[ease] hover:text-ink hover:bg-[rgba(255,244,222,0.07)] group-data-[done=true]/stop:text-ink-soft group-data-[done=true]/stop:hover:text-ink-soft group-data-[active=true]/stop:text-ink group-data-[active=true]/stop:hover:text-ink group-data-[active=true]/stop:bg-[rgba(232,178,87,0.13)] group-data-[active=true]/stop:hover:bg-[rgba(232,178,87,0.13)] mobile:flex mobile:gap-2 mobile:p-1 mobile:rounded-full mobile:group-data-[active=true]/stop:pr-[14px] mobile:group-data-[active=false]/stop:grid-cols-1 mobile:group-data-[active=false]/stop:gap-0 mobile:group-data-[active=false]/stop:p-[9px]"
                            onclick={() => select_step(step.id)}
                            aria-current={active ? 'step' : undefined}
                            aria-label={`Stage ${index + 1}: ${step.title}`}
                        >
                            <span
                                class="relative z-1 grid size-7 place-items-center text-ink-soft bg-[#1b1813] border border-solid border-line-strong rounded-[50%] text-[0.8125rem] font-semibold group-data-[done=true]/stop:text-gold group-data-[done=true]/stop:border-gold group-data-[active=true]/stop:text-gold-ink group-data-[active=true]/stop:bg-gold group-data-[active=true]/stop:border-gold-bright group-data-[active=true]/stop:shadow-[0_0_0_4px_rgba(232,178,87,0.2)] mobile:group-data-[active=false]/stop:size-[10px] mobile:group-data-[active=false]/stop:text-[0px] mobile:group-data-[active=false]/stop:[&>svg]:hidden mobile:group-data-[done=true]/stop:bg-gold"
                            >
                                {#if index < selected_index}{@render icon('check')}{:else}{index +
                                        1}{/if}
                            </span>
                            <span
                                class="font-serif text-[1.0625rem] leading-[1.25] mobile:truncate mobile:text-[1rem] mobile:group-data-[active=false]/stop:hidden"
                                >{step.title}</span
                            >
                            <span class="text-[0.8125rem] tabular-nums mobile:hidden"
                                >{format_time(step.duration)}</span
                            >
                        </button>
                    </li>
                {/each}
            </ol>
        </aside>
    {/if}

    {#if practice && journey.started}
        <section
            class="absolute z-20 bottom-[22px] left-[calc(var(--rail)+(100%-var(--rail)-var(--sheet))/2)] grid gap-3 w-[min(680px,calc(100%-var(--rail)-var(--sheet)-40px))] max-h-[calc(100%-110px)] overflow-y-auto px-6 pt-5 pb-[18px] bg-panel-solid border border-solid border-line-strong rounded-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.4)] backdrop-blur-[18px] [translate:-50%_0] mobile:right-3 mobile:bottom-3 mobile:left-3 mobile:w-auto mobile:max-h-[calc(100%-130px)] mobile:px-4 mobile:pt-4 mobile:translate-none"
            aria-labelledby="practice-title"
            in:fly={{ y: 24, duration: 300 }}
        >
            <header class="flex gap-4 items-start justify-between">
                <div class="grid gap-2">
                    <p class={kicker} id="practice-title">
                        Check your understanding
                        {#if practice_question}
                            · {practice.index + 1} / {practice.questions.length}{/if}
                    </p>
                    {#if mode_levels[mode].levels.length > 1 && !practice_step}
                        <div class="flex flex-wrap gap-2" role="group" aria-label="Level">
                            {#each mode_levels[mode].levels as level (level)}
                                <button
                                    class="py-[2px] px-[10px] text-ink-soft text-[0.8125rem] bg-transparent border border-solid border-line-strong rounded-full aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright"
                                    aria-pressed={practice_level === level}
                                    onclick={() =>
                                        open_practice({
                                            level: practice_level === level ? null : level,
                                        })}
                                >
                                    {#if level === 'beginner'}Beginner{:else if level === 'intermediate'}Intermediate{:else}Expert{/if}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
                <button class={round_button} onclick={close_practice} aria-label="Close practice">
                    {@render icon('close')}
                </button>
            </header>

            {#if practice_view}
                {#key practice_question.question_id}
                    <div class="grid gap-3" in:fade={{ duration: 220 }}>
                        <p
                            class="text-ink font-serif text-[1.1875rem] leading-[1.5] text-pretty"
                            dir="auto"
                        >
                            {practice_view.prompt}
                        </p>
                        <div class="grid gap-2" role="group" aria-label="Answers">
                            {#each practice_view.options as option (option.id)}
                                {@const chosen =
                                    practice_tick >= 0 &&
                                    practice.answers[practice_question.question_id] === option.id}
                                {@const right = option.id === practice_question.correct_option_id}
                                <button
                                    class="py-[10px] px-4 text-start text-ink bg-[rgba(255,244,222,0.05)] border border-solid border-line-strong rounded-xl transition-[background,border-color] duration-150 not-disabled:hover:border-gold not-disabled:hover:bg-[rgba(255,244,222,0.1)] disabled:cursor-default disabled:opacity-100 data-[state=right]:border-[#7fd1a0] data-[state=right]:bg-[rgba(127,209,160,0.14)] data-[state=wrong]:border-[#e8a857] data-[state=wrong]:bg-[rgba(232,168,87,0.14)]"
                                    data-state={practice_result
                                        ? right
                                            ? 'right'
                                            : chosen
                                              ? 'wrong'
                                              : 'idle'
                                        : 'idle'}
                                    disabled={Boolean(practice_result)}
                                    aria-pressed={chosen}
                                    dir="auto"
                                    onclick={() => answer_practice(option.id)}
                                >
                                    {option.text}
                                </button>
                            {/each}
                        </div>
                        {#if !practice_result}
                            <div class="flex flex-wrap gap-2 items-center">
                                <button
                                    class="{ghost_button} min-h-8 py-1"
                                    onclick={toggle_passage}
                                >
                                    {@render icon('sources')}
                                    {#if practice.source_open}Hide the passage{:else}Read the passage{/if}
                                </button>
                                <button
                                    class="min-h-8 py-1 px-3 text-ink-soft bg-transparent border-0 underline underline-offset-4"
                                    onclick={() => answer_practice(null)}
                                >
                                    I don’t know
                                </button>
                            </div>
                        {/if}
                        {#if practice_units.length}
                            <div class="grid gap-2" in:fade>
                                {#each practice_units as unit (unit.unit_id)}
                                    <blockquote
                                        class="max-h-[180px] overflow-y-auto py-3 px-4 text-[#fff6e3] bg-[rgba(0,0,0,0.36)] border-0 border-r-[3px] border-solid border-gold rounded-xl font-arabic text-[1.1875rem] leading-[1.9]"
                                        dir="rtl"
                                        lang="ar"
                                    >
                                        {unit.text_ar}
                                    </blockquote>
                                {/each}
                                <p class={fine_print}>
                                    Open book: reading the passage is part of learning.
                                </p>
                            </div>
                        {/if}
                        {#if practice_result}
                            {@const picked = practice_view.options.find(
                                (option) =>
                                    option.id === practice.answers[practice_question.question_id],
                            )}
                            <div
                                class="grid gap-2"
                                aria-live="polite"
                                in:fly={{ y: 8, duration: 220 }}
                            >
                                <p class="font-semibold text-[0.9375rem]">
                                    {#if practice_result.skipped}<span class="text-ink-soft"
                                            >Skipped. Here is what the passage says.</span
                                        >{:else if practice_result.correct}<span
                                            class="text-[#7fd1a0]">Correct.</span
                                        >{:else}<span class="text-[#e8a857]">Not quite.</span>{/if}
                                </p>
                                {#if picked}
                                    <p class="text-ink-soft leading-[1.5]" dir="auto">
                                        {picked.feedback}
                                    </p>
                                {/if}
                                <p class="text-ink leading-[1.55]" dir="auto">
                                    {practice_view.explanation}
                                </p>
                                <p class={fine_print} dir="auto">{practice_view.scope_note}</p>
                                {#if practice_result.used_source}
                                    <p class={fine_print}>You read the passage before answering.</p>
                                {/if}
                                <div>
                                    <button class={primary_button} onclick={next_question}>
                                        {#if practice.index + 1 < practice.questions.length}Next question{:else}See how you did{/if}
                                        {@render icon('next')}
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/key}
            {:else if practice_done}
                {@const score = practice_tick >= 0 && practice_score(practice)}
                {@const reread = stages_to_reread()}
                <div class="grid gap-3" in:fade>
                    <p class="font-serif text-[1.5rem] leading-[1.25]">
                        {score.correct} / {score.total}
                    </p>
                    <p class="text-ink-soft">
                        Correct answers, out of the questions in this set.
                        {#if score.skipped}
                            Left for later: {score.skipped}{/if}
                    </p>
                    {#if reread.length}
                        <p class={kicker}>Worth rereading</p>
                        <div class="flex flex-wrap gap-2">
                            {#each reread as step (step.id)}
                                <button
                                    class="{ghost_button} min-h-8 py-1"
                                    onclick={() => {
                                        close_practice()
                                        select_step(step.id, 'guided', false)
                                        open_reading()
                                    }}
                                >
                                    {step.title}
                                </button>
                            {/each}
                        </div>
                    {/if}
                    <div class="flex flex-wrap gap-2">
                        <button class={primary_button} onclick={close_practice}>
                            {@render icon('back')} Back to the journey
                        </button>
                        {#if !practice_step}
                            <button class={ghost_button} onclick={() => open_practice()}>
                                {@render icon('replay')} Practise again
                            </button>
                        {/if}
                    </div>
                </div>
            {/if}
        </section>
    {/if}

    {#if card_visible}
        <section
            class="absolute z-20 bottom-[22px] left-[calc(var(--rail)+(100%-var(--rail)-var(--sheet))/2)] grid gap-3 w-[min(680px,calc(100%-var(--rail)-var(--sheet)-40px))] px-6 pt-5 pb-[18px] bg-panel border border-solid border-line rounded-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-[18px] backdrop-saturate-[1.2] [translate:-50%_0] transition-[left] duration-300 ease-[ease] data-[detour=true]:border-gold compact:group-data-[sheet-open=true]/stage:hidden mobile:right-3 mobile:bottom-3 mobile:left-3 mobile:w-auto mobile:px-4 mobile:pt-4 mobile:pb-[14px] mobile:translate-none"
            data-detour={journey.mode === 'detour'}
            aria-label="Guided journey"
            bind:clientHeight={card_height}
            in:fly={{ y: 24, duration: 350 }}
        >
            {#if journey.mode === 'detour'}
                <p class={kicker}>Side trip · {selected_step.title}</p>
                <p class={caption}>{story_text}</p>
                <div class={card_row}>
                    <button
                        class="{primary_button} mr-auto mobile:flex-[1_1_100%]"
                        onclick={resume_from_detour}
                    >
                        {@render icon('back')} Return to where you were
                    </button>
                    <button
                        class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                        onclick={open_reading}
                    >
                        {@render icon('read')} Read this stage
                    </button>
                </div>
            {:else}
                <p class={kicker}>
                    Stage {selected_index + 1} of {chapter.steps.length} · {selected_step.title}
                </p>
                <div
                    class="grid min-h-[6.6rem] content-start [&>*]:[grid-area:1/1] mobile:min-h-[8.6rem]"
                    aria-live="polite"
                >
                    {#key current_cue?.id ?? selected_step.paragraphs[0]?.id}
                        <p class={caption} in:fade={{ duration: 450 }}>{story_text}</p>
                    {/key}
                </div>
                {#if current_cue && mode !== 'young'}
                    {@render citations(current_cue.source_ids)}
                {/if}
                {#if stage_why}
                    <p
                        class="py-2 px-3 text-ink-soft text-[0.9375rem] leading-[1.5] bg-[rgba(232,178,87,0.09)] border-0 border-s-2 border-solid border-gold rounded-e-lg"
                        in:fade
                    >
                        <strong class="text-gold font-semibold">Why this matters:</strong>
                        {stage_why}
                    </p>
                {/if}
                {#if caption_terms.length}
                    <div class="grid gap-2">
                        <div class="flex flex-wrap gap-2 items-center text-[0.8125rem]">
                            <span class="text-muted">Terms</span>
                            {#each caption_terms as item (item.id)}
                                <button
                                    class="py-[2px] px-[10px] text-ink-soft bg-transparent border border-dashed border-line-strong rounded-full aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-solid"
                                    aria-pressed={open_term === item.id}
                                    onclick={() =>
                                        (open_term = open_term === item.id ? null : item.id)}
                                    >{item.word}</button
                                >
                            {/each}
                        </div>
                        {#if caption_terms.some((item) => item.id === open_term)}
                            <p class="text-ink-soft text-[0.875rem] leading-[1.5]" in:fade>
                                {glossary.find((item) => item.id === open_term).meaning}
                            </p>
                        {/if}
                    </div>
                {/if}
                <div class="flex gap-[14px] items-center" dir="ltr">
                    <button
                        class="grid flex-none size-[46px] place-items-center p-0 text-gold-ink bg-gold border border-solid border-gold-bright rounded-[50%] text-[1.2rem] shadow-[0_0_0_5px_rgba(232,178,87,0.16)] transition-[background,transform] duration-150 ease-[ease] hover:bg-gold-bright active:[transform:scale(0.94)]"
                        onclick={toggle_play}
                        aria-label={journey.is_playing ? 'Pause' : 'Play'}
                    >
                        {@render icon(journey.is_playing ? 'pause' : 'play')}
                    </button>
                    <div class="relative flex-1 h-6" style:--fill={`${stop_progress * 100}%`}>
                        <input
                            class="absolute inset-0 w-full h-full m-0 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:h-[5px] [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,var(--color-gold)_var(--fill),rgba(255,244,222,0.2)_var(--fill))] [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-track]:h-[5px] [&::-moz-range-track]:bg-[rgba(255,244,222,0.2)] [&::-moz-range-track]:rounded-full [&::-moz-range-progress]:h-[5px] [&::-moz-range-progress]:bg-gold [&::-moz-range-progress]:rounded-full [&::-webkit-slider-thumb]:size-[15px] [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:bg-gold-bright [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:size-[15px] [&::-moz-range-thumb]:bg-gold-bright [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full"
                            type="range"
                            min="0"
                            max={guided_step.duration}
                            step="0.1"
                            value={journey.guided_position.seconds}
                            oninput={(event) => seek_to(+event.currentTarget.value)}
                            aria-label="Position in this stage"
                            aria-valuetext={`${format_time(journey.guided_position.seconds)} of ${format_time(guided_step.duration)}`}
                        />
                        <div
                            class="absolute top-1/2 right-0 left-0 pointer-events-none"
                            aria-hidden="true"
                        >
                            {#each guided_step.paragraphs.slice(1) as paragraph, index (paragraph.id)}
                                <i
                                    class="absolute top-[-2.5px] w-[2px] h-[5px] bg-[rgba(17,15,12,0.85)]"
                                    style:left={`${((paragraph.start ?? ((index + 1) * guided_step.duration) / guided_step.paragraphs.length) / guided_step.duration) * 100}%`}
                                ></i>
                            {/each}
                        </div>
                    </div>
                    <span class="text-ink-soft text-[0.8125rem] tabular-nums whitespace-nowrap"
                        >{format_time(journey.guided_position.seconds)} / {format_time(
                            guided_step.duration,
                        )}</span
                    >
                </div>
                <div class={card_row}>
                    {#if stop_finished && !journey.is_playing && stage_questions.length}
                        <button
                            class="{ghost_button} border-gold mobile:flex-[1_1_100%]"
                            onclick={() => open_practice({ step_id: selected_step.id })}
                        >
                            {@render icon('ask')} Check your understanding
                            <span
                                class="min-w-5 px-[6px] py-px text-gold-bright bg-[rgba(232,178,87,0.16)] rounded-full text-[0.75rem]"
                                >{stage_questions.length}</span
                            >
                        </button>
                    {/if}
                    {#if stop_finished && !journey.is_playing}
                        <button
                            class="{primary_button} mr-auto mobile:flex-[1_1_100%]"
                            onclick={continue_chapter}
                        >
                            {#if is_last_step}
                                {@render icon('check')} Complete the chapter
                            {:else}
                                Continue: {chapter.steps[selected_index + 1].title}
                                {@render icon('next')}
                            {/if}
                        </button>
                    {/if}
                    <button
                        class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                        onclick={open_reading}
                    >
                        {@render icon('read')} Read
                    </button>
                    <button
                        class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                        onclick={() => view_source(visible_sources[0]?.id)}
                    >
                        {@render icon('sources')} Sources
                        <span
                            class="min-w-5 py-px px-[6px] text-gold-bright bg-[rgba(232,178,87,0.16)] rounded-full text-[0.75rem]"
                            >{visible_sources.length}</span
                        >
                    </button>
                    <button
                        class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                        onclick={open_question}
                    >
                        {@render icon('ask')} Ask
                    </button>
                    {#each stage_chapters as item (item.chapter_id)}
                        <button
                            class="{ghost_button} border-gold mobile:flex-[1_1_100%]"
                            onclick={() => open_chapter(item.chapter_id)}
                        >
                            {@render icon('read')} Read the chapter
                            <span class="font-arabic text-[0.9375rem]" lang="ar" dir="rtl"
                                >{item.title_ar}</span
                            >
                        </button>
                    {/each}
                </div>
            {/if}
        </section>
    {/if}

    {#if sheet}
        <aside
            class="absolute z-25 top-[76px] right-4 bottom-4 flex flex-col w-(--sheet-width) bg-panel-solid border border-solid border-line-strong rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-[20px] mobile:top-14 mobile:right-0 mobile:bottom-0 mobile:left-0 mobile:w-auto mobile:border-x-0 mobile:border-b-0 mobile:rounded-b-none"
            aria-labelledby="sheet-title"
            bind:clientWidth={sheet_width}
            transition:fly={{ x: 40, duration: 260 }}
        >
            {#if sheet === 'reading'}
                <header class={sheet_header}>
                    <div>
                        <p class={kicker}>
                            Reading · stage {selected_index + 1} of {chapter.steps.length}
                        </p>
                        <h2 class={sheet_title} id="sheet-title">{selected_step.title}</h2>
                    </div>
                    <button class={round_button} onclick={close_sheet} aria-label="Close reading">
                        {@render icon('close')}
                    </button>
                </header>
                {#key selected_step.id}
                    <div
                        class="{sheet_body} [&>div.flex]:mt-[-6px] [&>div.flex]:mb-[10px]"
                        in:fade={{ duration: 250 }}
                    >
                        {#if journey.phase === 'completed' && selected_step.recap}
                            <div class={recap}>
                                <p class={kicker}>Chapter complete</p>
                                <h3 class="font-serif text-[1.4rem] font-medium">
                                    What to carry forward
                                </h3>
                                <p class="text-ink-soft leading-[1.55]">{selected_step.recap}</p>
                                <div class="flex flex-wrap gap-2">
                                    <button class={primary_button} onclick={() => open_practice()}>
                                        {@render icon('ask')} Practise what you learned
                                    </button>
                                    <button class={ghost_button} onclick={() => start('scene')}>
                                        {@render icon('replay')} Start again
                                    </button>
                                </div>
                            </div>
                        {/if}
                        {#if journey.mode === 'detour'}
                            <div class={recap}>
                                <p class={kicker}>Side trip</p>
                                <p class="text-ink-soft leading-[1.55]">
                                    Your place in “{guided_step.title}” is saved.
                                </p>
                                <button class={primary_button} onclick={resume_from_detour}>
                                    {@render icon('back')} Return to where you were
                                </button>
                            </div>
                        {/if}
                        {#each selected_step.paragraphs as paragraph (paragraph.id)}
                            <p class={prose}>{paragraph.text}</p>
                            {@render citations(paragraph.source_ids)}
                        {/each}
                        {#if mode === 'new' && why_it_matters[selected_step.id]}
                            <p
                                class="py-2 px-3 text-ink-soft leading-[1.55] bg-[rgba(232,178,87,0.09)] border-0 border-s-2 border-solid border-gold rounded-e-lg"
                            >
                                <strong class="text-gold font-semibold">Why this matters:</strong>
                                {why_it_matters[selected_step.id]}
                            </p>
                        {/if}
                    </div>
                {/key}
                <footer class={sheet_footer}>
                    <button
                        class={ghost_button}
                        onclick={() => move_step(-1)}
                        disabled={selected_index === 0}
                        aria-label="Previous stage"
                    >
                        {@render icon('back')}
                    </button>
                    {#if is_last_step && journey.phase !== 'completed'}
                        <button class="{primary_button} min-w-0 mr-auto" onclick={continue_chapter}>
                            {@render icon('check')} Complete the chapter
                        </button>
                    {:else if !is_last_step}
                        <button
                            class="{primary_button} min-w-0 mr-auto"
                            onclick={() => move_step(1)}
                        >
                            <span class="truncate"
                                >Next: {chapter.steps[selected_index + 1].title}</span
                            >
                            {@render icon('next')}
                        </button>
                    {/if}
                    <button class={ghost_button} onclick={open_question}>
                        {@render icon('ask')} Ask
                    </button>
                </footer>
            {:else if sheet === 'question'}
                <header class={sheet_header}>
                    <div>
                        <p class={kicker}>Ask the sources</p>
                        <h2 class={sheet_title} id="sheet-title">What would you like to know?</h2>
                    </div>
                    <button class={round_button} onclick={close_sheet} aria-label="Close question">
                        {@render icon('close')}
                    </button>
                </header>
                <div class={sheet_body}>
                    <p class="text-ink-soft text-[0.875rem] leading-[1.5]">
                        Ask follows this chapter’s context and can research further in Turath.
                        Answers cite opened passages and explain gaps in the evidence.
                    </p>
                    <p class={fine_print}>
                        OpenAI and Turath process questions and research text. This app does not
                        save chats.
                    </p>
                    <form class="grid gap-[10px] justify-items-end" onsubmit={submit_question}>
                        <label
                            class="absolute size-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap"
                            for="guide-question">Your question</label
                        >
                        <textarea
                            class="block w-full py-[13px] px-[15px] bg-[rgba(0,0,0,0.35)] border border-solid border-line-strong rounded-xl text-[1rem] leading-[1.45] resize-y placeholder:text-muted"
                            id="guide-question"
                            bind:this={question_input}
                            bind:value={question}
                            onkeydown={question_keydown}
                            maxlength="1200"
                            dir="auto"
                            rows="2"
                            placeholder="Ask about this chapter…"></textarea>
                        <button
                            class={primary_button}
                            type="submit"
                            disabled={journey.question_pending || !question.trim()}
                        >
                            {journey.question_pending ? 'Researching in Turath…' : 'Ask'}
                        </button>
                    </form>
                    <div class="flex flex-wrap gap-2" aria-label="Suggested questions">
                        {#each suggested_questions as prompt (prompt)}
                            <button
                                class="py-[7px] px-[13px] text-ink-soft text-start bg-[rgba(255,244,222,0.05)] border border-solid border-line rounded-full text-[0.875rem] transition-[border-color,color] duration-150 ease-[ease] hover:text-white hover:border-gold"
                                disabled={journey.question_pending}
                                onclick={() => ask_suggested(prompt)}>{prompt}</button
                            >
                        {/each}
                    </div>
                    <div aria-live="polite">
                        {#if journey.answer}
                            <div class={recap} in:fly={{ y: 10, duration: 250 }}>
                                <p class={kicker}>
                                    {journey.answer.provider === 'openai-turath'
                                        ? 'From the sources'
                                        : 'Chapter notes · offline'}
                                </p>
                                <p class="{prose} whitespace-pre-wrap" dir="auto">
                                    {journey.answer.answer}
                                </p>
                                {@render citations(journey.answer.citations ?? [])}
                                {#if journey.answer.action && chapter.steps.some((step) => step.id === journey.answer.action.step_id)}
                                    <button class={primary_button} onclick={show_action}>
                                        {journey.answer.action.label}
                                        {@render icon('next')}
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            {:else if active_source}
                <header class={sheet_header}>
                    <div>
                        <p class={kicker}>Source {active_source.number} · evidence</p>
                        <h2 class={sheet_title} id="sheet-title">{active_source.reference}</h2>
                    </div>
                    <button class={round_button} onclick={close_sheet} aria-label="Close source">
                        {@render icon('close')}
                    </button>
                </header>
                {#if drawer_sources.length > 1}
                    <div
                        class="flex flex-wrap gap-2 px-6 pt-[14px] mobile:px-[18px]"
                        role="group"
                        aria-label="Sources for this stage"
                    >
                        {#each drawer_sources as source (source.id)}
                            <button
                                class="min-w-[34px] h-[34px] px-2 py-0 text-ink-soft bg-transparent border border-solid border-line-strong rounded-full text-[0.875rem] font-semibold hover:border-gold aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright aria-pressed:hover:border-gold-bright"
                                aria-pressed={source.id === active_source.id}
                                aria-label={`Source ${source.number}: ${source.reference}`}
                                onclick={() => view_source(source.id)}>{source.number}</button
                            >
                        {/each}
                    </div>
                {/if}
                {#key active_source.id}
                    <div class={sheet_body} in:fade={{ duration: 220 }}>
                        <blockquote
                            class="py-5 px-[22px] text-[#fff6e3] bg-[rgba(0,0,0,0.36)] border-0 border-r-[3px] border-solid border-gold rounded-xl font-arabic text-[1.5rem] leading-[2]"
                            dir="rtl"
                            lang="ar"
                        >
                            {active_source.excerpt}
                        </blockquote>
                        <p class="mt-[-6px] text-muted text-[0.875rem]">
                            <span
                                class="text-ink-soft font-arabic text-[1.0625rem]"
                                lang="ar"
                                dir="rtl">{active_source.work}</span
                            >
                            {#if active_source.volume}
                                · vol. {active_source.volume}, p. {active_source.page}{/if}
                        </p>
                        {#if mode === 'new' && kind_notes[active_source.kind]}
                            <p class={fine_print}>{kind_notes[active_source.kind]}</p>
                        {/if}
                        {#if !active_source.retrieved}
                            <dl
                                class="grid gap-[14px] [&>div]:pl-[14px] [&>div]:border-0 [&>div]:border-l-2 [&>div]:border-solid [&>div]:border-[#7fae7a] [&_dt]:mb-1 [&_dt]:text-muted [&_dt]:text-[0.8125rem] [&_dt]:font-semibold [&_dt]:tracking-[0.06em] [&_dt]:uppercase [&_dd]:text-ink [&_dd]:leading-[1.55]"
                            >
                                <div>
                                    <dt>What this passage supports</dt>
                                    <dd>{active_source.explanation}</dd>
                                </div>
                                <div class="border-l-[#d98a5a]!">
                                    <dt>What it does not establish</dt>
                                    <dd>{active_source.limits}</dd>
                                </div>
                            </dl>
                        {:else if active_source.truncated}
                            <p class={fine_print}>
                                This passage is shortened. Open the original page for its full
                                context.
                            </p>
                        {/if}
                    </div>
                {/key}
                <footer class={sheet_footer}>
                    <a
                        class={ghost_button}
                        href={active_source.url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open the page on Turath {@render icon('external')}
                    </a>
                    <button class="{primary_button} min-w-0 mr-auto" onclick={close_sheet}>
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

<p
    class="absolute size-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap"
    role="status"
    aria-live="polite"
>
    {journey.announcement}
</p>
