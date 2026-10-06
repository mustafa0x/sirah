<script module>
    import {
        beat_position,
        chapter_stage,
        follow_link,
        journey_href,
        journey_paths,
        link_context,
        resolve_journey_link,
        valid_chapter_link,
    } from '../lib/journey-links.js'
    import {
        available_chapters,
        chapter_content_locale,
        chapter_title,
        chapters_for_place,
        load_chapter,
    } from '../lib/chapters.svelte.js'

    export const paths = journey_paths
    let checkpoint_view = () => {}
    export function before_route_leave() {
        checkpoint_view()
    }
    function resolve_link(url) {
        return resolve_journey_link(
            url,
            {
                steps: source_chapter.steps,
                sources: source_chapter.sources,
                pois: scene_pois,
                entries: timeline,
                terms: glossary,
                questions: questions_for,
            },
            { lang: saved_language(), audience: saved_mode() },
        )
    }
    export async function loader({ url }) {
        const target = resolve_link(url)
        if (!target) throw Object.assign(new Error('Page not found'), { status: 404 })
        let payload = null
        if (target.kind === 'chapter') {
            try {
                payload = await load_chapter(target.chapter_id, target.lang)
            } catch {
                throw Object.assign(new Error('Page not found'), { status: 404 })
            }
            if (!valid_chapter_link(target, payload))
                throw Object.assign(new Error('Page not found'), { status: 404 })
        }
        return { target, payload, href: url.href }
    }
</script>

<script>
    import { onMount } from 'svelte'
    import depth from 'virtual:depth-stats'
    import about_poster from '../assets/about/poster.jpg'
    import cave_license from '../../art/thawr/trellis/MODEL-LICENSE.md?url'
    import cave_provenance from '../../art/thawr/trellis/provenance.json'
    const hackathon_url = 'https://islamicaich.org/'
    // The video for "Behind the journey": any .mp4 or .webm placed in src/assets/about/.
    const about_video = Object.values(
        import.meta.glob('../assets/about/*.{mp4,webm}', {
            eager: true,
            query: '?url',
            import: 'default',
        }),
    )[0]
    const { route } = window.navgo
    import { change_language, fmt_num, saved_language } from '../lib/i18n.js'
    import { locales, language_direction } from '../lib/locale-config.js'
    import { verified_sources_once } from '../lib/practice-binding.js'
    import { toggle_practice_source } from '../lib/practice-source.js'
    import { SvelteSet } from 'svelte/reactivity'
    import { fade, fly } from 'svelte/transition'
    import SceneCanvas from '../lib/SceneCanvas.svelte'
    import { mergeProps } from 'bits-ui'
    import * as DropdownMenu from '$ui/dropdown-menu/index.js'
    import * as Tooltip from '$ui/tooltip/index.js'
    import ChapterReader from '../lib/ChapterReader.svelte'
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
        commit_navigation,
        complete_chapter,
        close_panel,
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
    import { evidence_category, evidence_dot, evidence_kinds } from '../lib/evidence.js'
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
    import { glossary, why_it_matters } from '../content/lenses.js'
    import { mentions } from '../lib/terms.js'
    import { details } from '../content/details.js'
    import {
        create_practice,
        current_question,
        next_practice,
        practice_feedback,
        practice_score,
        submit_practice,
    } from '../lib/hijrah-practice.js'
    import {
        load_wording,
        mode_levels,
        packet,
        questions_for,
        reading_for,
        worded,
    } from '../lib/practice-view.js'
    import {
        beat_actors,
        beat_passages,
        beat_shots,
        chapter_places,
        overview_shot,
        chapter_focus_shots,
        home_shot,
        route_at,
        scene_pois,
        step_scenes,
        timelapse_beats,
        timelapse_pace,
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
    let mode = $state(link_context(new URL(location.href), { audience: saved_mode() }).audience)
    let chapter = $state(prepare_chapter(mode))
    let narrated = $derived(
        chapter.steps.some((step) => step.paragraphs.some((paragraph) => paragraph.narrated)),
    )
    const narrator = create_narrator(language)
    // What lies beneath the home page, counted from the content at build time.
    const depth_keys = ['readings', 'passages', 'books', 'questions', 'languages']
    let depth_progress = $state(0)
    onMount(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            depth_progress = 1
            return
        }
        const begin = performance.now() + 900
        let frame = 0
        const count = (now) => {
            const t = Math.max(0, Math.min(1, (now - begin) / 1600))
            depth_progress = 1 - (1 - t) ** 3
            if (t < 1) frame = requestAnimationFrame(count)
        }
        frame = requestAnimationFrame(count)
        return () => cancelAnimationFrame(frame)
    })

    // On the home page the route draws itself once, Makkah to Madinah. The short first leg
    // (to Thawr) takes a small share of the time.
    let home_progress = $state(0)
    let idle_route = $derived([
        Math.min(1, home_progress / 0.06),
        Math.max(0, Math.min(1, (home_progress - 0.06) / 0.94)),
        0,
    ])
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
    let map_open = $state(false)
    let map_reset = $state(0)
    let guided_visible = $derived(journey.started && !map_open)
    let chapter_markers = $derived(
        available_chapters(language)
            .filter((item) => chapter_places[item.chapter_id])
            .map((item, index) => ({
                id: item.chapter_id,
                title: chapter_title(item, language),
                place: chapter_places[item.chapter_id],
                number: fmt_num(index + 1),
                href: href(`/chapters/${item.chapter_id}`, null),
            })),
    )
    let active_poi = $state(null)
    let active_detail = $derived(active_poi?.detail ? mode_detail(active_poi.detail, mode) : null)
    let question = $state('')
    let question_input = $state()
    let recent_turns = $state([])
    let help_open = $state(false)
    let about_open = $state(false)
    let sound_on = $state(false)
    // In depth, the evidence and the timeline are open from the start.
    let evidence_on = $state(mode === 'deep')
    let timeline_open = $state(mode === 'deep')
    let open_term = $state(null)
    let timeline_pick = $state(null)
    // Passages, as on the map: excerpts of one work at one place count once.
    const evidence_counts = Object.fromEntries(
        evidence_kinds.map((kind) => [
            kind,
            new Set(
                chapter.sources
                    .filter((source) => evidence_category(source.kind) === kind)
                    .map((source) => `${source.place}|${source.reference}`),
            ).size,
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
    let timeline_height = $state(0)
    let narrow = $derived(viewport_width <= 760)
    let timeline_bottom = $derived((narrow ? 104 : 76) + timeline_height)

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
    // The narrated paragraph in sentences. The narration records timings per paragraph, so the
    // sentence being spoken is estimated from its share of the paragraph's length.
    function sentences_of(text) {
        return text.match(/[^.!?؟]+(?:[.!?؟]+["”’)\]]*\s*|$)/g) ?? [text]
    }
    let story_sentences = $derived(sentences_of(story_text))
    let spoken_sentence = $derived.by(() => {
        if (!current_cue || stop_finished || (!journey.is_playing && cue_progress <= 0)) return -1
        const total = story_sentences.reduce((sum, sentence) => sum + sentence.length, 0)
        let reached = 0
        for (const [index, sentence] of story_sentences.entries()) {
            reached += sentence.length
            if (cue_progress < reached / total) return index
        }
        return story_sentences.length - 1
    })
    // The caption window keeps the spoken sentence in view.
    let caption_window = $state()
    $effect(() => {
        const index = spoken_sentence
        if (!caption_window) return
        const node = caption_window.querySelector('[data-spoken=true]')
        if (index <= 0 || !node) return caption_window.scrollTo({ top: 0 })
        const box = caption_window.getBoundingClientRect()
        const line = node.getBoundingClientRect()
        if (line.top < box.top || line.bottom > box.bottom)
            caption_window.scrollTo({
                top: caption_window.scrollTop + line.top - box.top - 4,
                behavior: 'smooth',
            })
    })
    let sheet = $derived(
        journey.panel === 'source' && journey.source_id
            ? 'source'
            : journey.panel === 'question'
              ? 'question'
              : // A selected place shows itself; the stage reading returns when it closes.
                guided_visible && journey.presentation === 'reading' && !active_poi
                ? 'reading'
                : null,
    )
    // Practice: open-book questions from the Arabic bank, shown in place of the story card.
    let practice = $state(null)
    let practice_level = $state(null)
    let practice_step = $state(null)
    let practice_units = $state([])
    let source_error = $state(false)
    let practice_wording = $state(null)
    let practice_ready = $state(false)
    // The practice module mutates its object; a new key is not tracked, so changes bump this.
    let practice_tick = $state(0)
    load_wording(language)
        .then((wording) => {
            practice_wording = wording
            practice_ready = true
        })
        .catch((error) => {
            console.error(error)
            source_error = true
            practice_units = []
        })
    let practice_question = $derived(
        practice_tick >= 0 && practice ? current_question(practice) : null,
    )
    let practice_view = $derived(
        practice_ready && practice_question ? worded(practice_question, practice_wording) : null,
    )
    let practice_result = $derived(
        practice_tick >= 0 && practice && practice_question ? practice_feedback(practice) : null,
    )
    let practice_done = $derived(Boolean(practice) && !practice_question)
    // The chapter open in the reader, if any.
    let reading_chapter = $state(null)

    // The written version of a stage: the narration as a summary, then the stage's
    // chapters in a language the reader can use, then the details found along the way.
    // Young learners keep to the short version and the details.
    let stage_reading_ids = $derived(
        [
            selected_step.reading_chapter_id,
            ...(selected_step.additional_reading_chapter_ids ?? []),
        ].filter(Boolean),
    )
    let stage_readings = $state([])
    $effect(() => {
        const ids = sheet === 'reading' && mode !== 'young' ? stage_reading_ids : []
        let current = true
        stage_readings = []
        Promise.all(ids.map((id) => load_chapter(id, language).catch(() => null))).then(
            (loaded) => {
                if (current) stage_readings = loaded.filter(Boolean)
            },
        )
        return () => {
            current = false
        }
    })
    let stage_details = $derived(
        details
            .filter((item) => item.stage === selected_step.id)
            .map((item) => mode_detail(item, mode)),
    )
    let reader_destination = $state(null)
    let reader_payload = $state(null)
    const reader_sessions = new Map()
    let reader_session = $state(null)
    const view_snapshots = new Map()
    let view_index = null
    let view_href = ''
    let applied_link = ''
    let mounted = $state(false)
    let applying_link = false
    let writing_link = false
    let card_visible = $derived(
        guided_visible &&
            (sheet !== 'reading' || !narrow) &&
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
    // Opening a source scrolls the list to it.
    let source_list = $state()
    $effect(() => {
        const id = journey.source_id
        if (!id || !source_list) return
        tick().then(
            () =>
                journey.source_id === id &&
                source_list
                    ?.querySelector(
                        // The whole list opens at the current stage's heading.
                        source_scope === 'all'
                            ? `[data-stage="${selected_step.id}"]`
                            : `[data-source="${id}"]`,
                    )
                    ?.scrollIntoView({ block: 'start' }),
        )
    })
    // The sources panel follows the source that was opened: the current stage when it cites
    // it, otherwise the stage that does (a map dot can belong to any stage), otherwise the
    // source on its own.
    let source_step = $derived(
        !active_source
            ? null
            : visible_sources.includes(active_source)
              ? selected_step
              : (chapter.steps.find((step) => step.source_ids.includes(active_source.id)) ?? null),
    )
    let drawer_sources = $derived(
        source_step ? sources_for(source_step) : active_source ? [active_source] : [],
    )
    // 'all' lists every passage the journey cites, by stage (from the evidence legend);
    // a chosen kind filters that list and the markers on the map.
    let source_scope = $state('stage')
    let evidence_kind = $state(null)
    let drawer_groups = $derived.by(() => {
        if (source_scope !== 'all') return [{ step: null, index: 0, sources: drawer_sources }]
        const seen = new Set()
        return chapter.steps
            .map((step, index) => ({
                step,
                index,
                // A stage's own passages, then those of its map details and timeline entries.
                sources: [
                    ...sources_for(step),
                    ...[...details, ...timeline]
                        .filter((item) => item.stage === step.id && item.source_id)
                        .map((item) => find_source(item.source_id))
                        .filter(Boolean),
                ].filter((source) => {
                    if (seen.has(source.id)) return false
                    seen.add(source.id)
                    return !evidence_kind || evidence_category(source.kind) === evidence_kind
                }),
            }))
            .filter((group) => group.sources.length)
    })

    function open_all_evidence() {
        const first =
            selected_step.source_ids.find((id) => find_source(id)) ?? chapter.sources[0]?.id
        view_source(first, 'all')
    }

    let shot = $derived(
        // On the map, an open chapter brings its place into view.
        map_open && reading_chapter && chapter_focus_shots[reading_chapter]
            ? chapter_focus_shots[reading_chapter]
            : active_poi
              ? poi_shots[active_poi.id]
              : guided_visible
                ? beat_shots[(current_cue ?? selected_step.paragraphs[0]).id]
                : journey.started
                  ? overview_shot
                  : home_shot,
    )
    let mood = $derived(guided_visible ? step_scenes[selected_step.id].mood : 'gold')
    // The route is drawn as the stage plays, so scrubbing moves the journey with it.
    let scene_route = $derived(
        map_open
            ? [1, 1, 1]
            : journey.started
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
    let cycle = $derived.by(() => {
        const lapse = current_cue && timelapse_beats[current_cue.id]
        if (!lapse || active_poi || map_open) return null
        if (stop_finished) return 1
        const [part, parts] = lapse
        return timelapse_pace((part + cue_progress) / parts)
    })
    $effect(() => ambience.set_mood(mood))
    let night = $derived(Math.min(3, Math.floor((cycle ?? 0) * 3) + 1))
    let passage = $derived(
        current_cue && beat_passages[current_cue.id] && !active_poi && !map_open
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
        mode === 'new' ? glossary.filter((item) => mentions(story_text, item)) : [],
    )
    let stage_why = $derived(
        mode === 'new' && current_cue?.id === selected_step.paragraphs.at(-1)?.id
            ? why_it_matters[selected_step.id]
            : null,
    )
    let insets = $derived(
        map_open
            ? {
                  left: 0,
                  // The chapter panel takes the right side while one is open.
                  right: reading_chapter && !narrow ? Math.min(776, viewport_width - 280) : 0,
                  top: narrow ? 190 : 184,
                  bottom: narrow ? 160 : 90,
              }
            : narrow
              ? { left: 0, right: 0, top: 120, bottom: journey.started ? card_height + 30 : 300 }
              : {
                    top: timeline_open ? timeline_bottom + 16 : 70,
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
        remember_view()
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
        let path = location.pathname + location.hash
        if (practice) {
            const question_id = current_question(practice)?.question_id
            if (!mode_levels[mode].levels.includes(practice_level)) practice_level = null
            const questions = questions_for(mode, { level: practice_level, step_id: practice_step })
            if (questions.length) {
                practice.questions = questions
                practice.index = Math.max(
                    0,
                    questions.findIndex((q) => q.question_id === question_id),
                )
            } else practice = null
            practice_units = []
            practice_tick += 1
            if (path.startsWith('/journey/hijrah/practice'))
                path = practice
                    ? `/journey/hijrah/practice/${current_question(practice).question_id}`
                    : scene_path()
        }
        write_link(path, { at: new URL(location.href).searchParams.get('at') })
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
        return fmt_num(`${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`)
    }

    function cancel_advance() {
        window.clearTimeout(advance_timer)
        advance_timer = 0
    }

    function clear_destinations() {
        practice = null
        practice_units = []
        reading_chapter = null
        help_open = false
        about_open = false
        open_term = null
    }

    function start(presentation) {
        remember_view()
        clear_destinations()
        cancel_advance()
        active_poi = null
        chapter = prepare_chapter(mode)
        journey.steps = chapter.steps
        start_journey(journey, presentation)
        recent_turns = []
        write_link(scene_path())
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

    function select_step(
        step_id,
        purpose = 'guided',
        autoplay = journey.is_playing,
        replace = false,
    ) {
        if (!chapter.steps.some((step) => step.id === step_id)) {
            announce('That stage is not available.')
            return
        }
        if (
            step_id === journey.viewed_step_id &&
            !journey.navigation_pending &&
            !practice &&
            !reading_chapter &&
            !sheet
        )
            return
        remember_view()
        clear_destinations()
        cancel_advance()
        active_poi = null
        let ticket
        try {
            ticket = begin_navigation(journey, step_id, purpose, 0)
        } catch {
            announce('That stage is not available.')
            return
        }
        clock?.pause()
        const timer = window.setTimeout(() => {
            pending_timers.delete(timer)
            if (!commit_navigation(journey, ticket, journey.presentation)) return
            write_link(scene_path(), { replace })
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
        remember_view()
        const ticket = begin_navigation(
            journey,
            journey.guided_position.step_id,
            'restore',
            journey.guided_position.seconds,
        )
        const timer = window.setTimeout(() => {
            pending_timers.delete(timer)
            if (commit_navigation(journey, ticket, journey.presentation)) {
                write_link(scene_path())
                clock?.set_position(journey.guided_position.seconds)
                announce('You are back where you left the guided journey. Press Play to continue.')
            }
        }, 120)
        pending_timers.add(timer)
    }

    function seek_to(seconds) {
        remember_view()
        cancel_advance()
        active_poi = null
        narrator.seek()
        journey.guided_position.seconds = seconds
        write_link(scene_path())
        clock?.seek(seconds)
    }

    function finish_stop() {
        if (is_last_step) {
            announce('The last stage is complete.')
            return
        }
        announce('Stage complete. Continuing to the next stage.')
        const next_id = chapter.steps[selected_index + 1].id
        advance_timer = window.setTimeout(() => select_step(next_id, 'guided', true, true), 1600)
    }

    function open_question() {
        if (journey.navigation_pending) return
        remember_view()
        clear_destinations()
        cancel_advance()
        clock?.pause()
        begin_question(journey, clock?.snapshot().seconds ?? journey.guided_position.seconds)
        write_link('/journey/hijrah/ask', { at: current_cue?.id })
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

    function toggle_help() {
        if (help_open) return return_link('help')
        remember_view()
        help_open = true
        if (journey.is_playing) pause_playback()
        write_link('/journey/hijrah/help', { at: current_cue?.id })
    }

    function toggle_about() {
        if (about_open) return return_link('about')
        remember_view()
        help_open = false
        about_open = true
        if (journey.is_playing) pause_playback()
        write_link('/journey/hijrah/about', { at: current_cue?.id })
    }

    function toggle_term(id) {
        if (open_term === id) return return_link('term')
        remember_view()
        open_term = id
        if (journey.is_playing) pause_playback()
        write_link(`/journey/hijrah/glossary/${id}`, { at: current_cue?.id })
    }

    function toggle_timeline() {
        if (timeline_open) {
            timeline_open = false
            if (location.pathname.includes('/timeline')) write_link(scene_path())
        } else {
            remember_view()
            timeline_open = true
            if (journey.is_playing) pause_playback()
            write_link(`/journey/hijrah/timeline${timeline_pick ? `/${timeline_pick}` : ''}`)
        }
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

    // Days in September need only the number; later days name their month, in the
    // interface language and its digits.
    const date_locale = language === 'ar' ? 'ar-u-nu-arab' : language
    const day_number = new Intl.DateTimeFormat(date_locale, { day: 'numeric', timeZone: 'UTC' })
    const day_label = new Intl.DateTimeFormat(date_locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    })
    function timeline_day(day) {
        const date = new Date(Date.UTC(2001, timeline_start.month - 1, timeline_start.day + day))
        const september = date.getUTCMonth() === 8
        return {
            label: (september ? day_number : day_label).format(date),
        }
    }

    function pick_entry(item, go = false) {
        if (go) {
            remember_view()
            clear_destinations()
            if (journey.is_playing) pause_playback()
            if (journey.panel !== 'none') close_panel(journey)
        }
        timeline_pick = item.id
        // Young learners follow fewer stages; an entry whose stage is left out stays in view.
        const shown = chapter.steps.some((step) => step.id === item.stage)
        if (go) {
            if (!shown) {
                chapter = prepare_chapter(mode, [item.stage, journey.guided_position.step_id])
                journey.steps = chapter.steps
            }
            if (item.stage !== journey.viewed_step_id) {
                const ticket = begin_navigation(journey, item.stage, 'guided', 0)
                commit_navigation(journey, ticket, journey.presentation)
                clock?.set_position(0)
            }
            write_link(`/journey/hijrah/timeline/${item.id}`)
        }
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
        remember_view()
        clear_destinations()
        if (journey.panel !== 'none') {
            close_panel(journey)
            return_to_guided(journey)
        }
        if (journey.is_playing) pause_playback()
        if (journey.presentation === 'reading') toggle_reading(journey)
        active_poi = null
        practice_step = step_id
        practice_level = level
        practice_units = []
        if (practice_ready) source_error = false
        practice = create_practice(packet, questions)
        practice_tick += 1
        write_link(`/journey/hijrah/practice/${questions[0].question_id}`, { at: current_cue?.id })
        announce(`Practice opened. ${questions.length} questions.`)
    }

    function answer_practice(option_id) {
        submit_practice(practice, option_id)
        practice_tick += 1
        announce(practice_feedback(practice)?.correct ? 'Correct.' : 'Answer recorded.')
    }

    async function toggle_passage() {
        if (!practice_ready || !practice) return
        const session = practice
        const question_id = current_question(session)?.question_id
        try {
            await toggle_practice_source(
                session,
                () => practice,
                packet,
                verified_sources_once,
                (units) => {
                    source_error = false
                    practice_units = units
                    practice_tick += 1
                },
            )
        } catch (error) {
            if (practice !== session || current_question(session)?.question_id !== question_id)
                return
            console.error(error)
            source_error = true
            practice_units = []
        }
    }

    function next_question() {
        remember_view()
        next_practice(practice)
        practice_units = []
        source_error = false
        practice_tick += 1
        const question_id = current_question(practice)?.question_id
        write_link(`/journey/hijrah/practice${question_id ? `/${question_id}` : ''}`, {
            at: current_cue?.id,
        })
    }

    function close_practice() {
        return_link('practice')
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

    // A teaching stage is not a geographical place (pursuit/tent both occur on the road).
    let stage_chapter = $derived(
        selected_step.reading_chapter_id
            ? available_chapters(language).find(
                  (item) => item.chapter_id === selected_step.reading_chapter_id,
              )
            : chapters_for_place(selected_step.id).find((item) =>
                  chapter_content_locale(item, language),
              ),
    )
    // What the current stage's chapter holds, for the strip on the stage card.
    let stage_facts = $state(null)
    $effect(() => {
        const item = stage_chapter
        if (!item) return
        let live = true
        load_chapter(item.chapter_id, language)
            .then((loaded) => {
                if (!live) return
                stage_facts = {
                    id: item.chapter_id,
                    sections: loaded.account.length,
                    passages: new Set(loaded.source_units.map((unit) => unit.text_ar.trim())).size,
                    questions: loaded.questions.length,
                }
            })
            .catch(() => {})
        return () => (live = false)
    })
    // A selected place with chapters gets its own card, top right.
    let place_card = $derived(
        Boolean(
            active_poi &&
            !active_poi.detail &&
            place_chapters.length &&
            !sheet &&
            !reading_chapter &&
            !map_open,
        ),
    )
    // The open chapter's entry in the map's strip scrolls into view.
    $effect(() => {
        if (!map_open || !reading_chapter) return
        tick().then(() =>
            document
                .querySelector('nav[aria-label] a[aria-current=page]')
                ?.scrollIntoView({ block: 'nearest', inline: 'center' }),
        )
    })
    let place_chapters = $derived(
        active_poi
            ? chapters_for_place(active_poi.place).filter((item) =>
                  chapter_content_locale(item, language),
              )
            : [],
    )

    function select_poi(poi) {
        remember_view()
        clear_destinations()
        if (journey.panel !== 'none') {
            close_panel(journey)
            return_to_guided(journey)
        }
        active_poi = active_poi?.id === poi.id ? null : poi
        if (active_poi?.detail && journey.is_playing) pause_playback()
        announce(
            active_poi
                ? `${poi.label}. ${active_detail?.text ?? poi.description}`
                : 'Returned to the guided view.',
        )
        write_link(active_poi ? `/places/${poi.id}` : scene_path(), {
            at: active_poi ? current_cue?.id : null,
        })
    }

    function view_source(source_id, scope = 'stage') {
        if (!source_id || !find_source(source_id)) return
        source_scope = scope
        remember_view()
        clear_destinations()
        journey.guide_generation += 1
        journey.question_pending = false
        cancel_advance()
        if (journey.panel !== 'source') source_origin = journey.panel
        clock?.pause()
        open_source(
            journey,
            source_id,
            clock?.snapshot().seconds ?? journey.guided_position.seconds,
        )
        // Live citations use their original Turath page, not answer-local ids.
        write_link(
            get_source(source_id) ? `/journey/hijrah/sources/${source_id}` : '/journey/hijrah/ask',
            { at: current_cue?.id, force: !get_source(source_id) },
        )
    }

    function close_sheet() {
        return_link()
    }

    // The whole stage as text beside the card, without stopping the narration.
    function follow_along() {
        if (sheet === 'reading') return close_sheet()
        remember_view()
        if (journey.panel !== 'none') close_panel(journey)
        if (journey.presentation !== 'reading') toggle_reading(journey)
        write_link(scene_path())
    }

    function paragraph_start(index) {
        const paragraph = guided_step.paragraphs[index]
        return paragraph.start ?? (index * guided_step.duration) / guided_step.paragraphs.length
    }

    // In the stage text, the paragraph being narrated stays in view.
    $effect(() => {
        const id = current_cue?.id
        if (sheet !== 'reading' || !id) return
        document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })

    function open_reading() {
        remember_view()
        clear_destinations()
        if (journey.panel !== 'none') close_panel(journey)
        if (journey.is_playing) pause_playback()
        if (journey.presentation !== 'reading') toggle_reading(journey)
        write_link(scene_path())
    }

    function show_action() {
        if (journey.answer?.action?.step_id) select_step(journey.answer.action.step_id, 'detour')
    }

    function continue_chapter() {
        if (is_last_step) {
            cancel_advance()
            clock?.pause()
            remember_view()
            complete_chapter(journey)
            write_link('/journey/hijrah/recap')
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
            if (about_open) return_link('about')
            else if (help_open) return_link('help')
            else if (reading_chapter || sheet) return_link()
            else if (practice) close_practice()
            else if (open_term) return_link('term')
            return
        }
        // Keys typed while the chapter is open belong to it, not to playback.
        if (reading_chapter) return
        if (!guided_visible || event.metaKey || event.ctrlKey || event.altKey) return
        if (event.target.closest?.('input, textarea, select, button, a, [contenteditable]')) return
        if (event.key === ' ') {
            event.preventDefault()
            if (sheet !== 'reading') toggle_play()
        } else if (event.key === 'ArrowRight') move_step(1)
        else if (event.key === 'ArrowLeft') move_step(-1)
    }

    function context() {
        return { lang: language, audience: mode, view: journey.presentation }
    }

    function href(path, at = current_cue?.id ?? selected_step.paragraphs[0]?.id) {
        return journey_href(
            path,
            { ...context(), ...(practice ? { level: practice_level, practice_step } : {}) },
            at,
        )
    }

    function scene_path() {
        const step = get_step(journey.viewed_step_id)
        const seconds =
            step.id === journey.guided_position.step_id ? journey.guided_position.seconds : 0
        const beat = cue_for(step, seconds)?.id ?? step.paragraphs[0].id
        return `/journey/hijrah/${step.id}/${beat}`
    }

    function remember_view() {
        if (view_index === null) return
        view_snapshots.set(view_index, {
            href: view_href,
            journey: $state.snapshot(journey),
            active_poi_id: active_poi?.id,
            map_open,
            help_open,
            about_open,
            evidence_on,
            timeline_open,
            timeline_pick,
            open_term,
            source_origin,
            practice: $state.snapshot(practice),
            practice_step,
            practice_level,
            practice_units: $state.snapshot(practice_units),
            reading_chapter,
            reader_destination: $state.snapshot(reader_destination),
            reader_payload: $state.snapshot(reader_payload),
            focus_id: document.activeElement?.id,
            focus_href: document.activeElement?.closest('a')?.getAttribute('href'),
        })
    }

    function write_link(path, { replace = false, at = null, force = false } = {}) {
        if (applying_link || !mounted) return
        const url = href(path, at)
        if (!force && url === `${location.pathname}${location.search}${location.hash}`) return
        writing_link = true
        window.navgo[replace ? 'replace_state' : 'push_state'](url)
        writing_link = false
        view_index = history.state?.__navgo?.idx ?? 0
        view_href = location.href
        applied_link = `${view_href}|${view_index}`
        remember_view()
    }

    function return_link(kind = reading_chapter ? 'chapter' : (sheet ?? 'scene')) {
        const is_parent = (view) =>
            kind === 'chapter'
                ? !view.reading_chapter
                : kind === 'practice'
                  ? !view.practice
                  : kind === 'place'
                    ? !view.active_poi_id
                    : kind === 'about'
                      ? !view.about_open
                      : kind === 'help'
                        ? !view.help_open
                        : kind === 'term'
                          ? !view.open_term
                          : kind === 'reading'
                            ? view.journey.presentation !== 'reading'
                            : kind === 'source'
                              ? view.journey.panel !== 'source'
                              : kind === 'question'
                                ? view.journey.panel === 'none'
                                : true
        for (let index = view_index - 1; index >= 0; index -= 1) {
            const view = view_snapshots.get(index)
            if (view && is_parent(view)) {
                const parent_url = new URL(view.href)
                if (link_context(parent_url).audience !== mode) {
                    const path = view.practice
                        ? practice
                            ? `/journey/hijrah/practice/${current_question(practice)?.question_id ?? ''}`
                            : scene_path()
                        : parent_url.pathname + parent_url.hash
                    const next = href(path, parent_url.searchParams.get('at'))
                    view_snapshots.set(view_index + 1, {
                        ...view,
                        href: new URL(next, location.href).href,
                        journey: {
                            ...view.journey,
                            guided_position: { ...journey.guided_position },
                        },
                        practice: view.practice ? $state.snapshot(practice) : null,
                        practice_level,
                        practice_step,
                    })
                    window.navgo.goto(next)
                } else history.go(index - view_index)
                return
            }
        }
        // With no earlier view to return to, keep the current presentation unless it is the
        // reading itself that is being closed.
        window.navgo.goto(
            journey_href(
                scene_path(),
                kind === 'reading' ? { ...context(), view: 'scene' } : context(),
            ),
        )
    }

    function chapter_navigation(path) {
        window.navgo.goto(href(path))
    }

    async function apply_link(url, route_data) {
        const index = history.state?.__navgo?.idx ?? 0
        const key = `${url.href}|${index}`
        if (key === applied_link) return
        const target = resolve_link(url)
        if (!target) return
        if (target.lang !== language) {
            location.assign(url.href)
            return
        }
        if (
            target.kind === 'chapter' &&
            route_data?.target?.chapter_id !== target.chapter_id &&
            !view_snapshots.get(index)?.reader_payload
        )
            return
        remember_view()
        const saved = view_snapshots.get(index)
        const snapshot = saved?.href === url.href ? saved : null
        const old_generations = {
            navigation_generation: journey.navigation_generation + 1,
            guide_generation: journey.guide_generation + 1,
            media_generation: journey.media_generation + 1,
            source_generation: journey.source_generation + 1,
        }
        applying_link = true
        applied_link = key
        view_index = index
        view_href = url.href
        cancel_advance()
        pending_timers.forEach((timer) => window.clearTimeout(timer))
        pending_timers.clear()
        clock?.pause()
        mode = target.audience
        chapter = prepare_chapter(
            mode,
            [
                target.stage_id,
                journey.guided_position.step_id,
                snapshot?.journey.guided_position.step_id,
                snapshot?.journey.viewed_step_id,
            ].filter(Boolean),
        )
        if (snapshot) {
            journey = {
                ...snapshot.journey,
                ...old_generations,
                steps: chapter.steps,
                is_playing: false,
                navigation_pending: false,
                question_pending: false,
            }
            active_poi = scene_pois.find((poi) => poi.id === snapshot.active_poi_id) ?? null
            ;({
                map_open,
                help_open,
                about_open,
                evidence_on,
                timeline_open,
                timeline_pick,
                open_term,
                source_origin,
                practice_step,
                practice_level,
            } = snapshot)
            practice = snapshot.practice
            practice_units = snapshot.practice_units
            practice_tick += 1
            reading_chapter = snapshot.reading_chapter
            reader_destination = snapshot.reader_destination
        } else {
            map_open =
                target.kind === 'map' || (map_open && ['place', 'chapter'].includes(target.kind))
            let stage_id = target.stage_id
            if (target.kind === 'chapter' && !target.at)
                stage_id = chapter_stage(
                    chapter.steps,
                    target.chapter_id,
                    route_data.payload.place_links,
                )
            const step = get_step(stage_id)
            const seconds = target.at ? beat_position(step, target.at) : 0
            if (target.kind === 'map') {
                pause(journey)
                close_panel(journey)
                journey.presentation = 'scene'
                journey.announcement = 'Explore the map'
            } else {
                const ticket = begin_navigation(journey, stage_id, 'guided', seconds)
                commit_navigation(journey, ticket, target.view)
            }
            Object.assign(journey, old_generations)
            active_poi = null
            practice = null
            practice_units = []
            reading_chapter = null
            reader_destination = null
            help_open = false
            about_open = false
            open_term = null
            timeline_open = mode === 'deep'
            evidence_on = mode === 'deep'
            source_origin = 'none'
            if (target.kind === 'home')
                journey = { ...create_journey_state(), ...old_generations, steps: chapter.steps }
            if (target.kind === 'place') active_poi = scene_pois.find((p) => p.id === target.poi_id)
            if (target.kind === 'source') open_source(journey, target.source_id)
            if (target.kind === 'ask') begin_question(journey)
            if (target.kind === 'help') help_open = true
            if (target.kind === 'about') about_open = true
            if (target.kind === 'timeline') {
                timeline_open = true
                timeline_pick = target.entry_id
            }
            if (target.kind === 'term') open_term = target.term_id
            if (target.kind === 'recap') complete_chapter(journey)
            if (target.kind === 'practice') {
                open_practice({ step_id: target.practice_step, level: target.level })
                if (target.question_id)
                    practice.index = practice.questions.findIndex(
                        (q) => q.question_id === target.question_id,
                    )
                practice_tick += 1
            }
            if (target.kind === 'chapter') {
                reading_chapter = target.chapter_id
                reader_destination = target
            }
        }
        if (reading_chapter) {
            reader_payload =
                route_data?.payload?.chapter_id === reading_chapter
                    ? route_data.payload
                    : (snapshot?.reader_payload ?? null)
            const edition_key = reader_payload.packet_id
            if (!reader_sessions.has(edition_key)) {
                const session = $state({ practice: null, study: false, passage: [] })
                reader_sessions.set(edition_key, session)
            }
            reader_session = reader_sessions.get(edition_key)
            // The address selects a reader tab/target even when the parent view is restored.
            if (target.kind === 'chapter') reader_destination = target
        }
        clock?.set_position(journey.guided_position.seconds)
        narrator.seek()
        applying_link = false
        remember_view()
        await tick()
        if (applied_link !== key) return
        if (target.kind === 'ask') question_input?.focus()
        else if (snapshot?.focus_id) document.getElementById(snapshot.focus_id)?.focus()
        else if (snapshot?.focus_href)
            document
                .querySelector(`a[href="${CSS.escape(snapshot.focus_href)}"]`)
                ?.focus({ preventScroll: true })
        else {
            const heading = document.getElementById(
                reading_chapter
                    ? 'chapter-title'
                    : map_open && !active_poi
                      ? 'map-title'
                      : about_open
                        ? 'about-title'
                        : help_open
                          ? 'help-title'
                          : open_term
                            ? 'term-title'
                            : active_poi
                              ? active_poi.detail
                                  ? 'detail-title'
                                  : 'place-title'
                              : 'sheet-title',
            )
            if (heading) {
                heading.tabIndex = -1
                heading.focus({ preventScroll: true })
            }
        }
    }

    function tick() {
        return new Promise((resolve) => window.setTimeout(resolve))
    }

    onMount(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            home_progress = 1
            return
        }
        const draw_start = performance.now() + 800
        let frame = 0
        const draw = (now) => {
            const t = Math.max(0, Math.min(1, (now - draw_start) / 4500))
            home_progress = 1 - (1 - t) ** 3
            if (t < 1) frame = requestAnimationFrame(draw)
        }
        frame = requestAnimationFrame(draw)
        return () => cancelAnimationFrame(frame)
    })

    onMount(() => {
        clock = create_media_clock({
            duration: () => get_step(journey.guided_position.step_id).duration,
            can_advance: () => narrator.can_advance(),
            on_tick(seconds, playing) {
                if (journey.mode !== 'guided' || journey.navigation_pending) return
                const was_playing = journey.is_playing
                journey.guided_position.seconds = seconds
                journey.is_playing = playing
                if (
                    playing &&
                    !active_poi &&
                    !sheet &&
                    !practice &&
                    !reading_chapter &&
                    !help_open &&
                    !about_open &&
                    !open_term &&
                    !location.pathname.includes('/timeline')
                )
                    write_link(scene_path(), { replace: true })
                if (was_playing && !playing && seconds >= guided_step.duration) finish_stop()
            },
        })
        checkpoint_view = remember_view
        mounted = true
        const unsubscribe = route.subscribe((current) => {
            if (!writing_link) apply_link(current.url, current.matches?.at(-1)?.data)
        })
        return () => {
            unsubscribe()
            mounted = false
            checkpoint_view = () => {}
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

{#snippet tip(label, button)}
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}{@render button(props)}{/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
{/snippet}

{#snippet mode_name(item)}
    {#if item === 'young'}Young learners{:else if item === 'new'}New to the story{:else}In
        depth{/if}
{/snippet}

{#snippet depth_label(key)}
    {#if key === 'readings'}Chapters{:else if key === 'passages'}Source passages{:else if key === 'books'}Source
        books{:else if key === 'questions'}Practice questions{:else}Languages{/if}
{/snippet}

{#snippet kind_name(kind)}
    {#if kind === 'quran'}The Quran{:else if kind === 'hadith'}Hadith
        collections{:else if kind === 'report'}Classical sirah and history{:else}Modern
        authors{/if}
{/snippet}

{#snippet kind_filters(compact)}
    <ul class={['grid list-none', compact ? 'grid-cols-2 gap-x-3 gap-y-1' : 'gap-1']}>
        {#each evidence_kinds as kind (kind)}
            <li>
                <button
                    class="flex gap-3 items-center w-full py-1 px-2 -mx-2 text-start text-[0.9375rem] text-ink bg-transparent border-0 rounded-lg hover:bg-[rgba(255,244,222,0.07)] aria-pressed:bg-[rgba(232,178,87,0.14)] data-[muted=true]:opacity-45"
                    aria-pressed={evidence_kind === kind}
                    data-muted={Boolean(evidence_kind) && evidence_kind !== kind}
                    onclick={() => (evidence_kind = evidence_kind === kind ? null : kind)}
                >
                    <i
                        class="size-[11px] shrink-0 rounded-full border border-solid border-[rgba(255,255,255,0.7)] {evidence_dot[
                            kind
                        ]}"
                    ></i>
                    <span class="me-auto">{@render kind_name(kind)}</span>
                    {#if !compact}
                        <span class="text-muted tabular-nums">{fmt_num(evidence_counts[kind])}</span
                        >
                    {/if}
                </button>
            </li>
        {/each}
    </ul>
{/snippet}

{#snippet icon(name)}
    <svg
        class={[
            'flex-none size-[1.15em] fill-none stroke-current [stroke-width:1.8] [stroke-linecap:round] [stroke-linejoin:round]',
            ['next', 'back', 'start'].includes(name) && 'rtl:-scale-x-100',
        ]}
        viewBox="0 0 24 24"
        aria-hidden="true"
    >
        {#if name === 'play' || name === 'start'}
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
        {:else if name === 'quiz'}
            <circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-5.1" />
        {:else if name === 'close'}
            <path d="M6 6l12 12M18 6L6 18" />
        {:else if name === 'next'}
            <path d="M5 12h14M13 6l6 6-6 6" />
        {:else if name === 'back'}
            <path d="M19 12H5M11 6l-6 6 6 6" />
        {:else if name === 'check'}
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        {:else if name === 'expand'}
            <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />
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
            <circle cx="6" cy="8" r="2" /><circle cx="15" cy="6" r="2" /><circle cx="17" cy="15" r="2" /><circle cx="8" cy="17" r="2" />
        {:else if name === 'map'}
            <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />
        {:else if name === 'timeline'}
            <path d="M3 12h18M6 9v6M11 7v10M16 10v4M20 8v8" />
        {:else if name === 'audience'}
            <path d="M6 18v-4M12 18V9M18 18V5" />
        {/if}
    </svg>
{/snippet}

{#snippet place_chapter_buttons()}
    <!-- One quiet list rather than a gold button per chapter. -->
    <div class="grid gap-1">
        <p class={kicker}>Chapters</p>
        <ul class="grid list-none">
            {#each place_chapters as item (item.chapter_id)}
                <li>
                    <a
                        class="flex gap-2 items-baseline py-[5px] text-ink hover:text-gold-bright [&>svg]:translate-y-[2px] [&>svg]:text-gold"
                        href={href(`/chapters/${item.chapter_id}`)}
                    >
                        {@render icon('read')}
                        <span
                            class="font-serif text-[1.0625rem] leading-[1.35]"
                            lang={chapter_content_locale(item, language)}
                            dir={language_direction(chapter_content_locale(item, language))}
                            >{chapter_title(item, language)}</span
                        >
                    </a>
                </li>
            {/each}
        </ul>
    </div>
{/snippet}

{#snippet citations(source_ids)}
    <div class="flex flex-wrap gap-2">
        {#each source_ids as source_id (source_id)}
            {@const source = find_source(source_id)}
            <a
                class="inline-flex max-w-full min-w-0 gap-[7px] items-center py-[3px] pe-[11px] ps-1 text-start text-ink-soft bg-[rgba(232,178,87,0.08)] border border-solid border-line rounded-full text-[0.8125rem] transition-[border-color,color] duration-150 ease-[ease] hover:text-white hover:border-gold data-[active=true]:text-white data-[active=true]:border-gold"
                aria-current={journey.source_id === source_id ? 'page' : undefined}
                data-active={journey.source_id === source_id}
                href={get_source(source_id)
                    ? href(`/journey/hijrah/sources/${source_id}`)
                    : source.url}
                onclick={(event) => follow_link(event, () => view_source(source_id))}
                aria-label={`Source ${source.number}: ${source.reference}`}
            >
                <span
                    class="grid shrink-0 min-w-5 h-5 place-items-center px-[5px] text-gold-ink bg-gold rounded-full text-[0.75rem] font-bold"
                    >{fmt_num(source.number)}</span
                ><span class="min-w-0 break-words" dir="auto"
                    >{fmt_num(source.reference)}</span
                >{#if source.strength === 'weak'}<span
                        class="shrink-0 ps-1.5 border-0 border-s border-solid border-line text-[0.6875rem] text-ink-soft"
                        >Weaker report</span
                    >{/if}
            </a>
        {/each}
    </div>
{/snippet}

<div
    class="group/stage fixed inset-0 overflow-hidden [--rail:0px] [--sheet:0px] [--sheet-width:min(480px,42vw)] data-[started=true]:[--rail:324px] data-[sheet-open=true]:[--sheet:calc(var(--sheet-width)+16px)] mobile:data-[started=true]:[--rail:0px] mobile:data-[sheet-open=true]:[--sheet:0px]"
    data-started={guided_visible}
    data-place-card={place_card}
    data-map={map_open}
    data-sheet-open={!!sheet}
>
    <div class="absolute inset-0 bg-[linear-gradient(#2f5f8a,#f2c58c_62%,#8d6b4b_62%)]">
        <SceneCanvas
            label="Schematic relief of the route from Makkah to Madinah"
            {shot}
            {mood}
            route={scene_route}
            {cycle}
            progress={current_cue && !active_poi && !map_open
                ? stop_finished
                    ? 1
                    : cue_progress
                : null}
            actor={current_cue && !active_poi && !map_open
                ? (beat_actors[current_cue.id] ?? null)
                : null}
            chapters={map_open ? chapter_markers : []}
            reset_key={map_reset}
            {insets}
            link_context={context()}
            link_at={current_cue?.id ?? selected_step.paragraphs[0]?.id}
            active_poi_id={active_poi?.id ?? null}
            on_poi={select_poi}
            evidence={evidence_on && !map_open
                ? {
                      focus: selected_step.source_ids,
                      cue: current_cue?.source_ids ?? [],
                      open: journey.source_id,
                      kind: evidence_kind,
                  }
                : null}
            on_source={view_source}
        />
    </div>
    <div
        class="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(9,8,6,0.72)_0,transparent_150px),linear-gradient(0deg,rgba(9,8,6,0.78)_0,transparent_46%),linear-gradient(90deg,rgba(9,8,6,0.86)_0,rgba(9,8,6,0.5)_30%,transparent_58%)] group-data-[started=true]/stage:bg-[linear-gradient(180deg,rgba(9,8,6,0.6)_0,transparent_130px),linear-gradient(0deg,rgba(9,8,6,0.74)_0,transparent_42%),linear-gradient(90deg,rgba(9,8,6,0.5)_0,transparent_30%)] group-data-[map=true]/stage:bg-[linear-gradient(180deg,rgba(9,8,6,0.8)_0,transparent_220px),linear-gradient(0deg,rgba(9,8,6,0.85)_0,transparent_35%)] mobile:bg-[linear-gradient(180deg,rgba(9,8,6,0.8)_0,transparent_190px),linear-gradient(0deg,rgba(9,8,6,0.92)_0,rgba(9,8,6,0.5)_38%,transparent_62%)]! mobile:group-data-[map=true]/stage:bg-[linear-gradient(180deg,rgba(9,8,6,0.8)_0,transparent_190px),linear-gradient(0deg,rgba(9,8,6,0.85)_0,transparent_35%)]!"
        aria-hidden="true"
    ></div>

    <header
        class="absolute z-30 top-0 right-0 left-0 flex justify-between items-center h-[68px] px-6 mobile:h-14 mobile:px-[14px]"
    >
        <a
            class="inline-flex items-center gap-[14px] text-ink font-serif text-[1.25rem] font-semibold no-underline whitespace-nowrap mobile:gap-3 mobile:text-[1.0625rem]"
            href={href('/', null)}
            aria-label="Sirah Journey home"
        >
            <span
                class="size-3 ml-1 bg-gold rounded-[2px] shadow-[0_0_0_4px_rgba(232,178,87,0.22)] rotate-45"
                aria-hidden="true"
            ></span>
            Sirah Journey
        </a>
        <div class="flex items-center gap-3 mobile:gap-2">
            <div class="relative min-w-0 max-w-[12rem] text-ink mobile:max-w-none">
                <select
                    class="w-full appearance-none rounded-full border border-line bg-panel-solid py-2 ps-4 pe-9 text-ink text-sm text-ellipsis mobile:absolute mobile:inset-0 mobile:opacity-0"
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
                <svg
                    class="pointer-events-none absolute end-3.5 top-1/2 size-3.5 -translate-y-1/2 fill-none stroke-current [stroke-width:2.2] [stroke-linecap:round] [stroke-linejoin:round] mobile:hidden"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
                <!-- On a phone the menu shows only the language code; tapping still opens it. -->
                <span
                    class="hidden h-[38px] min-w-[38px] items-center justify-center rounded-full border border-line bg-panel-solid px-3 text-xs font-semibold uppercase tracking-[0.06em] pointer-events-none mobile:flex"
                    aria-hidden="true">{language === 'ar' ? 'ع' : language}</span
                >
            </div>
            {#snippet sound_button(props)}
                <button
                    {...props}
                    class={round_button}
                    aria-label={sound_on ? 'Turn sound off' : 'Turn sound on'}
                    aria-pressed={sound_on}
                    onclick={() => set_sound(!sound_on)}
                >
                    {@render icon(sound_on ? 'sound' : 'muted')}
                </button>
            {/snippet}
            {@render tip(sound_on ? 'Turn sound off' : 'Turn sound on', sound_button)}
            {#if journey.started}
                <!-- The audience can be changed at any point; the home page has its own switch. -->
                <DropdownMenu.Root dir={language_direction(language)}>
                    {#snippet audience_button(props)}
                        <DropdownMenu.Trigger>
                            {#snippet child({ props: menu_props })}
                                <button
                                    {...mergeProps(props, menu_props)}
                                    class={round_button}
                                    aria-label="How would you like to follow the journey?"
                                >
                                    {@render icon('audience')}
                                </button>
                            {/snippet}
                        </DropdownMenu.Trigger>
                    {/snippet}
                    {@render tip('How would you like to follow the journey?', audience_button)}
                    <DropdownMenu.Content class="w-72">
                        <DropdownMenu.Label
                            >How would you like to follow the journey?</DropdownMenu.Label
                        >
                        <DropdownMenu.RadioGroup value={mode} onValueChange={select_mode}>
                            {#each modes as item (item)}
                                <DropdownMenu.RadioItem value={item} class="py-2">
                                    <span class="grid gap-[2px]">
                                        <span class="text-ink font-medium"
                                            >{@render mode_name(item)}</span
                                        >
                                        <span class="text-muted text-xs leading-[1.4]">
                                            {#if item === 'young'}Six short stages, in simple words.{:else if item === 'new'}Terms
                                                explained, and why each stage matters.{:else}Every
                                                detail, with the evidence and the timeline open.{/if}
                                        </span>
                                    </span>
                                </DropdownMenu.RadioItem>
                            {/each}
                        </DropdownMenu.RadioGroup>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            {/if}
            {#if guided_visible}
                {#snippet evidence_button(props)}
                    <button
                        {...props}
                        class="{round_button} aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright mobile:hidden"
                        aria-label={evidence_on
                            ? 'Hide evidence on the map'
                            : 'Show evidence on the map'}
                        aria-pressed={evidence_on}
                        onclick={toggle_evidence}
                    >
                        {@render icon('evidence')}
                    </button>
                {/snippet}
                {@render tip(
                    evidence_on ? 'Hide evidence on the map' : 'Show evidence on the map',
                    evidence_button,
                )}
                {#snippet timeline_button(props)}
                    <button
                        {...props}
                        class="{round_button} aria-pressed:text-gold-ink aria-pressed:bg-gold aria-pressed:border-gold-bright mobile:hidden"
                        aria-label={timeline_open ? 'Hide timeline' : 'Show timeline'}
                        aria-pressed={timeline_open}
                        onclick={toggle_timeline}
                    >
                        {@render icon('timeline')}
                    </button>
                {/snippet}
                {@render tip(timeline_open ? 'Hide timeline' : 'Show timeline', timeline_button)}
            {/if}
            {#snippet help_button(props)}
                <button
                    {...props}
                    class={round_button}
                    aria-label="How this works"
                    aria-expanded={help_open}
                    onclick={toggle_help}>?</button
                >
            {/snippet}
            {@render tip('How this works', help_button)}
        </div>
    </header>

    {#if map_open && !sheet}
        <!-- Where "Explore the map" was: once the journey has begun, back to the stage the
             learner was on. -->
        <a
            class="{ghost_button} absolute z-20 top-[80px] start-6 mobile:top-16 mobile:start-[14px] [&>svg]:rtl:-scale-x-100"
            href={journey.started
                ? journey_href(scene_path(), { ...context(), view: 'scene' })
                : journey_href('/journey/hijrah/setting', { ...context(), view: 'scene' })}
        >
            {#if journey.started}{@render icon('back')} Back to the journey{:else}{@render icon('start')} Begin the journey{/if}
        </a>
    {/if}
    {#if map_open && !reading_chapter && !sheet}
        <section
            class="absolute z-20 top-[136px] inset-x-6 mobile:top-[116px] mobile:inset-x-[14px]"
            aria-labelledby="map-title"
        >
            <div class="flex items-center justify-between gap-3">
                <h1
                    id="map-title"
                    class="font-serif text-[1.75rem] font-medium mobile:text-[1.4rem]"
                >
                    Explore the map
                </h1>
                <a
                    class={ghost_button}
                    href={href('/journey/hijrah/map', null)}
                    onclick={(event) =>
                        follow_link(event, () => {
                            active_poi = null
                            map_reset += 1
                            write_link('/journey/hijrah/map')
                        })}><span>Fit map</span></a
                >
            </div>
            <p class="mt-2 text-sm text-ink max-w-[32rem]">
                Select a book marker to read its chapter.
            </p>
        </section>
    {/if}
    {#if map_open && !sheet}
        <nav
            class="absolute z-20 bottom-5 inset-x-6 mobile:bottom-3 mobile:inset-x-3"
            style:right={reading_chapter && !narrow ? '800px' : null}
            aria-label="Hijrah chapters"
        >
            <!-- All the chapters in story order, numbered as on the map. -->
            <ol
                class="flex gap-2 overflow-x-auto pb-1 list-none [scrollbar-width:thin] [scrollbar-color:#6d5529_transparent]"
            >
                {#each chapter_markers as item (item.id)}
                    <li class="shrink-0">
                        <a
                            class="flex items-center gap-3 min-h-11 w-[13.5rem] px-3 py-2 rounded-xl text-ink border border-line-strong bg-panel-solid hover:border-gold aria-[current=page]:border-gold aria-[current=page]:bg-[rgba(232,178,87,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                            href={item.href}
                            aria-current={reading_chapter === item.id ? 'page' : undefined}
                        >
                            <span
                                class="grid shrink-0 size-6 place-items-center rounded-full bg-gold text-gold-ink text-sm"
                                >{item.number}</span
                            >
                            <span
                                class="line-clamp-2 font-serif text-[0.9375rem] leading-tight"
                                dir="auto">{item.title}</span
                            >
                        </a>
                    </li>
                {/each}
            </ol>
        </nav>
    {/if}

    {#if card_visible && !sheet && (passage || cycle !== null)}
        <div
            data-scene-overlay
            class="absolute z-10 top-[88px] right-6 left-[calc(var(--rail)+24px)] grid justify-items-center gap-2 text-center pointer-events-none mobile:top-[112px] mobile:left-6"
            style:top={timeline_open ? `${timeline_bottom + 16}px` : null}
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

    {#if timeline_open && guided_visible && !(narrow && sheet) && !practice}
        <section
            class="absolute z-20 top-[76px] right-6 left-[calc(var(--rail)+40px)] grid gap-2 px-5 pt-3 pb-3 bg-panel border border-solid border-line rounded-[18px] shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur-[18px] mobile:top-[104px] mobile:right-3 mobile:left-3 mobile:px-3"
            style:right={sheet ? 'calc(var(--sheet) + 8px)' : place_card && !narrow ? '412px' : null}
            aria-labelledby="timeline-title"
            bind:offsetHeight={timeline_height}
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
            <div class="relative h-[70px] mx-1">
                {#each timeline_ticks as day (day)}
                    {@const date = timeline_day(day)}
                    <div
                        class="absolute top-0 bottom-[16px] w-px bg-[rgba(255,244,222,0.1)]"
                        style:left={`${(day / timeline_days) * 100}%`}
                    ></div>
                    {#if day % 3 === 0 || day === 15}
                        <span
                            class="absolute bottom-0 text-muted text-[0.6875rem] tabular-nums whitespace-nowrap [translate:-50%_0]"
                            style:left={`${(day / timeline_days) * 100}%`}>{date.label}</span
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
                    <a
                        class="absolute h-[14px] min-w-[14px] p-0 border border-solid rounded-[4px] transition-[outline-color] duration-150 outline-2 outline-offset-2 outline-transparent hover:outline-[rgba(255,244,222,0.6)] data-[active=true]:outline-gold-bright {certainty_bar[
                            item.certainty
                        ]}"
                        style:top={`${3 + item.lane * 18}px`}
                        style:left={`${(item.from / timeline_days) * 100}%`}
                        style:width={`${((item.to - item.from) / timeline_days) * 100}%`}
                        aria-current={timeline_entry.id === item.id ? 'date' : undefined}
                        data-active={timeline_entry.id === item.id}
                        aria-label={`${item.title}: ${item.when}`}
                        href={href(`/journey/hijrah/timeline/${item.id}`, null)}
                        onclick={(event) => follow_link(event, () => pick_entry(item, true))}
                    ></a>
                {/each}
                <input
                    class="absolute start-0 end-0 bottom-[22px] h-[4px] w-full m-0 opacity-60 hover:opacity-100 focus-visible:opacity-100 accent-[#e8b257] cursor-ew-resize"
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
                        <a
                            class="{ghost_button} min-h-8 py-1"
                            href={href(`/journey/hijrah/timeline/${timeline_entry.id}`, null)}
                            onclick={(event) =>
                                follow_link(event, () => pick_entry(timeline_entry, true))}
                        >
                            Go to this stage {@render icon('next')}
                        </a>
                    {/if}
                </div>
            </div>
        </section>
    {/if}

    {#if evidence_on && guided_visible && !sheet && !practice && !place_card}
        <section
            class="absolute z-20 right-6 w-[300px] grid gap-3 content-start overflow-y-auto px-5 pt-4 pb-4 bg-panel border border-solid border-line rounded-[18px] shadow-[0_18px_60px_rgba(0,0,0,0.3)] backdrop-blur-[18px] mobile:hidden"
            style:top={timeline_open ? `${timeline_bottom + 16}px` : '84px'}
            style:max-height={`calc(100% - ${timeline_open ? timeline_bottom + 16 : 84}px - ${card_visible ? card_height + 56 : 24}px)`}
            aria-labelledby="evidence-title"
            transition:fly={{ x: 16, duration: 220 }}
        >
            <h2 class={kicker} id="evidence-title">
                <button
                    class="inline-flex gap-2 items-center p-0 bg-transparent border-0 uppercase tracking-[inherit] hover:text-gold-bright [&>svg]:rtl:-scale-x-100"
                    onclick={open_all_evidence}
                >
                    Evidence on the map {@render icon('next')}
                </button>
            </h2>
            <p class="text-ink-soft text-[0.875rem] leading-[1.5]">
                Each point of light is a passage this journey cites, placed where it speaks of.
                Select one to read it.
            </p>
            {@render kind_filters(false)}
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
                    onclick={() => return_link('place')}
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

    {#if place_card}
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
                    onclick={() => return_link('place')}
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
        <ChapterReader
            chapter_id={reading_chapter}
            chapter={reader_payload}
            destination={reader_destination}
            bind:session={reader_session}
            on_close={() => return_link('chapter')}
            on_navigate={chapter_navigation}
        />
    {/if}

    {#if open_term && !caption_terms.some((item) => item.id === open_term)}
        {@const term = glossary.find((item) => item.id === open_term)}
        <aside
            class="absolute z-30 top-[88px] right-6 grid gap-3 w-[min(380px,calc(100%-48px))] px-6 py-5 bg-panel-solid border border-solid border-line-strong rounded-[20px] mobile:top-[112px] mobile:right-3 mobile:left-3 mobile:w-auto"
            aria-labelledby="term-title"
        >
            <header class="flex gap-4 items-center justify-between">
                <h2 class="font-serif text-[1.5rem] font-medium" id="term-title">{term.word}</h2>
                <button
                    class={round_button}
                    onclick={() => return_link('term')}
                    aria-label="Close detail">{@render icon('close')}</button
                >
            </header>
            <p class="text-ink-soft leading-[1.55]">{term.meaning}</p>
        </aside>
    {/if}

    {#if help_open}
        <section
            class="absolute z-40 top-16 right-6 w-[min(400px,calc(100%-32px))] max-h-[calc(100%-88px)] overflow-y-auto p-[22px] bg-panel-solid border border-solid border-line-strong rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-[16px] mobile:top-14 mobile:right-3"
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
                        <strong>Play</strong> walks the journey stage by stage with AI-generated narration.
                    {:else}
                        <strong>Play</strong> walks the journey stage by stage. The captions keep time
                        over a quiet wind.
                    {/if}
                </li>
                <li>
                    <strong>Drag</strong> to look around, <strong>scroll</strong> to zoom, and select
                    a place name to fly there.
                </li>
                <li>
                    <strong>Sources</strong> shows the passage behind each paragraph, with a link to its
                    page on Turath.
                </li>
                <li>
                    <strong>Ask</strong> uses the journey’s context to research in Turath and answer with
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
            <div
                class="grid gap-3 pt-4 mt-1 border-0 border-t border-solid border-line scroll-mt-4"
                id="beneath"
            >
                <p class={kicker}>Beneath the surface</p>
                <dl class="grid grid-cols-3 gap-x-3 gap-y-2">
                    {#each depth_keys as key (key)}
                        <div class="grid">
                            <dt class="order-last text-muted text-[0.75rem] leading-[1.3]">
                                {@render depth_label(key)}
                            </dt>
                            <dd class="m-0 font-serif text-[1.375rem] leading-[1.1] text-ink">
                                {fmt_num(depth[key])}
                            </dd>
                        </div>
                    {/each}
                </dl>
                <p class="text-ink-soft text-[0.875rem] leading-[1.55]">
                    Every paragraph rests on a passage from the classical Arabic sources, with a
                    link to its page on Turath. The chapters go deeper into each part of the story,
                    and the practice questions are drawn from the same passages.
                </p>
                <p class="text-ink-soft text-[0.875rem] leading-[1.55]">
                    The narration is in Arabic and English, and the map is built from real elevation
                    data.
                </p>
                <a
                    class="{ghost_button} justify-self-start [&>svg]:rtl:-scale-x-100"
                    href={href('/journey/hijrah/about', null)}
                    onclick={(event) => follow_link(event, toggle_about)}
                >
                    Behind the journey {@render icon('next')}
                </a>
            </div>
        </section>
    {/if}

    {#if about_open}
        <div
            class="absolute z-50 inset-0 overflow-y-auto bg-[rgba(12,11,9,0.94)] backdrop-blur-[10px]"
            transition:fade={{ duration: 200 }}
        >
            <article
                class="grid gap-10 w-[min(900px,calc(100%-48px))] mx-auto pt-24 pb-20 mobile:w-[calc(100%-32px)] mobile:pt-20 mobile:gap-8"
                aria-labelledby="about-title"
            >
                <header class="flex gap-6 items-start justify-between">
                    <div class="grid gap-3">
                        <p class={kicker}>Behind the journey</p>
                        <h2
                            class="font-serif text-[clamp(2.2rem,5vw,3.4rem)] font-medium leading-[1.05] tracking-[-0.02em]"
                            id="about-title"
                        >
                            How this journey was made
                        </h2>
                        <p
                            class="max-w-[36rem] text-ink-soft font-serif text-[1.1875rem] leading-[1.55]"
                        >
                            Sirah Journey tells the Hijrah stage by stage, and every part of it can
                            be traced to the classical sources.
                        </p>
                    </div>
                    <button
                        class={round_button}
                        onclick={() => return_link('about')}
                        aria-label="Close"
                    >
                        {@render icon('close')}
                    </button>
                </header>
                <!-- The project video, or a still from the scene until one is added. -->
                <div
                    class="overflow-hidden aspect-video bg-black border border-solid border-line rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
                >
                    {#if about_video}
                        <video
                            class="block w-full h-full"
                            src={about_video}
                            poster={about_poster}
                            controls
                            preload="metadata"
                        ></video>
                    {:else}
                        <img class="block w-full h-full object-cover" src={about_poster} alt="" />
                    {/if}
                </div>
                <dl class="flex flex-wrap gap-x-10 gap-y-4">
                    {#each depth_keys as key (key)}
                        <div class="grid gap-1">
                            <dt class="order-last text-muted text-[0.8125rem]">
                                {@render depth_label(key)}
                            </dt>
                            <dd class="m-0 font-serif text-[2.25rem] leading-none text-ink">
                                {fmt_num(depth[key])}
                            </dd>
                        </div>
                    {/each}
                </dl>
                <div class="grid grid-cols-2 gap-12 mobile:grid-cols-1 mobile:gap-8">
                    <section class="grid gap-4 content-start" aria-labelledby="about-inside">
                        <h3 class="font-serif text-[1.5rem] font-medium" id="about-inside">
                            What’s inside
                        </h3>
                        <ul
                            class="grid gap-3 list-none text-ink-soft leading-[1.6] [&_strong]:text-ink [&_strong]:font-semibold"
                        >
                            <li>
                                <strong>A guided journey</strong> in nine stages across a map built from
                                real elevation data, narrated in Arabic and English.
                            </li>
                            <li>
                                <strong>Chapters</strong> that go deeper into each part of the story,
                                each with its source passages.
                            </li>
                            <li>
                                <strong>Sources on the map</strong>, placed where they speak of, and
                                a day-by-day timeline that shows how each date is known.
                            </li>
                            <li>
                                <strong>Practice</strong>: open-book questions drawn from the same
                                passages, with the passage one tap away.
                            </li>
                            <li>
                                <strong>Ask</strong>: an AI guide that researches Turath and answers
                                with citations.
                            </li>
                            <li>
                                <strong>Three audiences</strong>, from young learners to those who
                                want every detail, in twenty languages.
                            </li>
                        </ul>
                    </section>
                    <section class="grid gap-4 content-start" aria-labelledby="about-method">
                        <h3 class="font-serif text-[1.5rem] font-medium" id="about-method">
                            How it was made
                        </h3>
                        <ol
                            class="grid gap-3 list-none text-ink-soft leading-[1.6] [counter-reset:step] [&>li]:relative [&>li]:ps-8 [&>li]:[counter-increment:step] [&>li]:before:absolute [&>li]:before:start-0 [&>li]:before:top-[2px] [&>li]:before:text-gold [&>li]:before:font-semibold [&>li]:before:content-[counter(step)] [&:lang(ar)>li]:before:content-[counter(step,arabic-indic)] [&_strong]:text-ink [&_strong]:font-semibold"
                        >
                            <li>
                                <strong>Gathered from the sources.</strong> Passages on the Hijrah were
                                collected from the classical Arabic works on Turath, among them Ibn Hisham’s
                                Sirah, Sahih al-Bukhari, Sahih Muslim, al-Bayhaqi’s Dala’il al-Nubuwwa
                                and Ibn Kathir.
                            </li>
                            <li>
                                <strong>One Arabic core.</strong> The events were set out as records and
                                claims, each tied to the passages that support it. Everything the app
                                says comes from this core.
                            </li>
                            <li>
                                <strong>Written in Arabic first.</strong> Each chapter was written in
                                Arabic from the core, and the passages it shows are the exact source text,
                                never retyped.
                            </li>
                            <li>
                                <strong>Translated from the Arabic.</strong> The other languages are translated
                                directly from the Arabic, not through English.
                            </li>
                            <li>
                                <strong>Practice from the same evidence.</strong> Questions are built
                                on the same claims and passages, so every answer can be checked against
                                its source.
                            </li>
                            <li>
                                <strong>Drawn with care.</strong> The terrain is real; places and routes
                                are schematic. People are never shown, and animals appear without riders.
                            </li>
                            <li>
                                <strong>AI, guided by the sources.</strong> AI tools helped draft, translate
                                and voice the narration, always working from the Arabic sources.
                            </li>
                        </ol>
                    </section>
                </div>
                <!-- Every book the passages come from, most-quoted first, each opening on Turath. -->
                <section class="grid gap-4" aria-labelledby="about-books">
                    <h3 class="font-serif text-[1.5rem] font-medium" id="about-books">
                        Source books
                    </h3>
                    <ol
                        class="grid grid-cols-2 gap-x-12 list-none border-0 border-t border-solid border-line mobile:grid-cols-1"
                    >
                        {#each depth.book_list as book (book.id)}
                            <li
                                class="flex gap-4 items-baseline justify-between py-3 border-0 border-b border-solid border-line"
                            >
                                <a
                                    class="grid gap-1 text-ink no-underline hover:text-gold-bright"
                                    href={book.url}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {#if language !== 'ar'}<span>{book.title_en}</span>{/if}
                                    <span
                                        class={[
                                            'justify-self-start font-arabic',
                                            language === 'ar'
                                                ? 'text-[1.0625rem]'
                                                : 'text-muted text-[0.875rem]',
                                        ]}
                                        lang="ar"
                                        dir="rtl">{book.title_ar}</span
                                    >
                                </a>
                                <span
                                    class="shrink-0 font-serif text-[1.125rem] text-ink-soft tabular-nums"
                                    >{fmt_num(book.passages)}</span
                                >
                            </li>
                        {/each}
                    </ol>
                    <p class={fine_print}>
                        The number beside each book counts its source passages.
                    </p>
                </section>
                <!-- Credits, together at the foot of the page. -->
                <footer
                    class="grid gap-2 pt-6 border-0 border-t border-solid border-line text-[0.875rem]"
                >
                    <p class="text-ink-soft">
                        Made by Mustafa Jibaly (Nuqayah) for the <a
                            class="text-inherit underline decoration-gold/50 underline-offset-4 hover:text-gold-bright hover:decoration-gold-bright"
                            href={hackathon_url}
                            target="_blank"
                            rel="noopener">AI Challenge in Service of Islamic Content</a
                        >
                    </p>
                    <p class="text-muted">
                        Cave model: <a
                            class="text-inherit underline decoration-gold/50 underline-offset-4 hover:text-gold-bright hover:decoration-gold-bright"
                            href={cave_license}
                            target="_blank"
                            rel="noopener"
                        >
                            {cave_provenance.source.artist} · {cave_provenance.source.title} · {cave_provenance.source
                                .declared_license}
                        </a>
                    </p>
                </footer>
            </article>
        </div>
    {/if}

    {#if !journey.started && !map_open}
        <section
            class="absolute z-20 top-1/2 left-[clamp(24px,7vw,112px)] w-[min(560px,calc(100%-48px))] [transform:translateY(-50%)] animate-rise mobile:top-auto mobile:bottom-[26px] mobile:left-5 mobile:w-[calc(100%-40px)] mobile:transform-none"
            aria-labelledby="hero-title"
            out:fade={{ duration: 250 }}
        >
            <h1
                class="mb-5 font-serif text-[clamp(3.6rem,9vw,7rem)] font-medium tracking-[-0.035em] leading-[0.95] [text-shadow:0_2px_30px_rgba(0,0,0,0.45)]"
                id="hero-title"
            >
                The Hijrah
            </h1>
            <p
                class="max-w-[31rem] mb-8 text-ink font-serif text-[clamp(1.15rem,1.6vw,1.4rem)] leading-[1.45] mobile:mb-5"
            >
                Follow the migration from Makkah to Madinah stage by stage, with every paragraph
                linked to the passage it rests on.
            </p>
            <!-- One decision: begin. The audience is preset (remembered, or "new to the
                 story"), so it can be ignored, and it can be changed later from the help panel. -->
            <div class="flex flex-wrap gap-x-6 gap-y-3 items-center mb-7 mobile:mb-5">
                <a
                    class="{primary_button} min-h-[52px] px-6 py-3 text-[1rem]"
                    href={journey_href('/journey/hijrah/setting', { ...context(), view: 'scene' })}
                    onclick={(event) => follow_link(event, () => start('scene'))}
                >
                    {@render icon('start')} Begin the journey
                </a>
            </div>
            <div
                class="flex flex-wrap gap-1 items-center w-fit p-1 bg-[rgba(17,15,12,0.5)] border border-solid border-line rounded-full backdrop-blur-[8px]"
                role="radiogroup"
                aria-label="How would you like to follow the journey?"
            >
                {#each modes as item (item)}
                    <button
                        class="py-[6px] px-[14px] text-ink-soft text-[0.875rem] bg-transparent border-0 rounded-full transition-[background,color] duration-150 hover:text-ink aria-checked:text-gold-ink aria-checked:bg-gold aria-checked:font-semibold"
                        role="radio"
                        aria-checked={item === mode}
                        onclick={() => select_mode(item)}
                    >
                        {#if item === 'young'}Young learners{:else if item === 'new'}New to the
                            story{:else}In depth{/if}
                    </button>
                {/each}
            </div>
            <p class="{fine_print} mt-2 ps-[18px]">
                {#if mode === 'young'}Six short stages, in simple words.{:else if mode === 'new'}Terms
                    explained, and why each stage matters.{:else}Every detail, with the evidence and
                    the timeline open.{/if}
            </p>
        </section>
        <section
            class="absolute z-20 bottom-7 left-[clamp(24px,7vw,112px)] flex flex-wrap gap-x-9 gap-y-3 items-end animate-rise mobile:hidden [@media(max-height:760px)]:hidden"
            aria-label="Beneath the surface"
            out:fade={{ duration: 250 }}
        >
            <dl class="flex flex-wrap gap-x-8 gap-y-3">
                {#each depth_keys as key (key)}
                    <div class="grid gap-1">
                        <dt class="order-last text-muted text-[0.8125rem]">
                            {@render depth_label(key)}
                        </dt>
                        <dd class="m-0 font-serif text-[2rem] leading-none text-ink tabular-nums">
                            {fmt_num(Math.round(depth[key] * depth_progress))}
                        </dd>
                    </div>
                {/each}
            </dl>
            <a
                class="{ghost_button} min-h-11 px-5 [&>svg]:rtl:-scale-x-100"
                href={href('/journey/hijrah/about', null)}
                onclick={(event) => follow_link(event, toggle_about)}
            >
                Behind the journey {@render icon('next')}
            </a>
            <p class="{fine_print} basis-full">
                Made by Mustafa Jibaly (Nuqayah) for the <a
                    class="text-inherit underline decoration-gold/50 underline-offset-4 hover:text-gold-bright hover:decoration-gold-bright"
                    href={hackathon_url}
                    target="_blank"
                    rel="noopener">AI Challenge in Service of Islamic Content</a
                >
            </p>
        </section>
    {:else if !map_open}
        <aside
            class="absolute z-20 top-[84px] left-5 flex flex-col w-[284px] max-h-[calc(100%-104px)] px-4 pt-[22px] pb-[18px] bg-panel border border-solid border-line rounded-[18px] backdrop-blur-[18px] backdrop-saturate-[1.2] mobile:top-14 mobile:right-0 mobile:left-0 mobile:w-auto mobile:px-[14px] mobile:pt-[6px] mobile:pb-[10px] mobile:bg-transparent mobile:border-0 mobile:rounded-none mobile:backdrop-filter-none"
            aria-label="Journey stages"
            bind:clientWidth={rail_width}
            in:fade
        >
            <h1
                class="px-2 mb-[18px] font-serif text-[2rem] font-medium tracking-[-0.02em] leading-[1.05] mobile:hidden"
            >
                The Hijrah
            </h1>
            <a class="{ghost_button} mb-3 mobile:hidden" href={href('/journey/hijrah/map', null)}
                ><span>Explore the map</span></a
            >
            <ol class="grid gap-[2px] list-none mobile:flex mobile:gap-0 mobile:items-center">
                {#each chapter.steps as step, index (step.id)}
                    {@const active = journey.viewed_step_id === step.id}
                    <li
                        class="group/stop relative [&+li]:before:absolute [&+li]:before:top-[-9px] [&+li]:before:start-[21px] [&+li]:before:w-px [&+li]:before:h-[18px] [&+li]:before:bg-line-strong [&+li]:before:content-[''] mobile:[&+li]:before:hidden mobile:data-[active=true]:flex-1 mobile:data-[active=true]:min-w-0 mobile:data-[active=false]:hidden"
                        data-active={active}
                        data-done={index < selected_index}
                    >
                        <a
                            class="grid grid-cols-[28px_1fr_auto] gap-3 items-center w-full py-[9px] px-2 text-muted text-start bg-transparent border-0 rounded-[10px] transition-[background,color] duration-150 ease-[ease] hover:text-ink hover:bg-[rgba(255,244,222,0.07)] group-data-[done=true]/stop:text-ink-soft group-data-[done=true]/stop:hover:text-ink-soft group-data-[active=true]/stop:text-ink group-data-[active=true]/stop:hover:text-ink group-data-[active=true]/stop:bg-[rgba(232,178,87,0.13)] group-data-[active=true]/stop:hover:bg-[rgba(232,178,87,0.13)] mobile:flex mobile:gap-2 mobile:p-1 mobile:rounded-full mobile:group-data-[active=true]/stop:pr-[14px] mobile:group-data-[active=false]/stop:grid-cols-1 mobile:group-data-[active=false]/stop:gap-0 mobile:group-data-[active=false]/stop:p-[9px]"
                            href={href(`/journey/hijrah/${step.id}`, null)}
                            onclick={(event) => follow_link(event, () => select_step(step.id))}
                            aria-current={active ? 'step' : undefined}
                            aria-label={`Stage ${index + 1}: ${step.title}`}
                        >
                            <span
                                class="relative z-1 grid size-7 place-items-center text-ink-soft bg-[#1b1813] border border-solid border-line-strong rounded-[50%] text-[0.8125rem] font-semibold group-data-[done=true]/stop:text-gold group-data-[done=true]/stop:border-gold group-data-[active=true]/stop:text-gold-ink group-data-[active=true]/stop:bg-gold group-data-[active=true]/stop:border-gold-bright group-data-[active=true]/stop:shadow-[0_0_0_4px_rgba(232,178,87,0.2)] mobile:group-data-[active=false]/stop:size-[10px] mobile:group-data-[active=false]/stop:text-[0px] mobile:group-data-[active=false]/stop:[&>svg]:hidden mobile:group-data-[done=true]/stop:bg-gold"
                            >
                                {#if index < selected_index}{@render icon('check')}{:else}{fmt_num(
                                        index + 1,
                                    )}{/if}
                            </span>
                            <span
                                class="font-serif text-[1.0625rem] leading-[1.25] mobile:truncate mobile:text-[1rem] mobile:group-data-[active=false]/stop:hidden"
                                >{step.title}</span
                            >
                            <span class="text-[0.8125rem] tabular-nums mobile:hidden"
                                >{format_time(step.duration)}</span
                            >
                        </a>
                    </li>
                {/each}
                <li class="hidden mobile:block">
                    <a
                        class="{round_button} ms-1"
                        href={href('/journey/hijrah/map', null)}
                        aria-label="Explore the map">{@render icon('map')}</a
                    >
                </li>
            </ol>
            <!-- On a phone the stages are one segmented line under the current stage. -->
            <nav class="hidden gap-1 px-1 mobile:flex" aria-label="Journey stages">
                {#each chapter.steps as step, index (step.id)}
                    <a
                        class="group/segment flex-1 py-2"
                        href={href(`/journey/hijrah/${step.id}`, null)}
                        onclick={(event) => follow_link(event, () => select_step(step.id))}
                        aria-current={journey.viewed_step_id === step.id ? 'step' : undefined}
                        aria-label={`Stage ${index + 1}: ${step.title}`}
                        data-on={index <= selected_index}
                    >
                        <span
                            class="block h-[3px] rounded-full bg-[rgba(255,244,222,0.22)] group-data-[on=true]/segment:bg-gold"
                        ></span>
                    </a>
                {/each}
            </nav>
        </aside>
    {/if}

    {#if practice && guided_visible}
        <section
            class="absolute z-20 bottom-[22px] left-[calc(var(--rail)+(100%-var(--rail)-var(--sheet))/2)] grid gap-3 w-[min(680px,calc(100%-var(--rail)-var(--sheet)-40px))] max-h-[calc(100%-110px)] overflow-y-auto px-6 pt-5 pb-[18px] bg-panel-solid border border-solid border-line-strong rounded-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.4)] backdrop-blur-[18px] [translate:-50%_0] mobile:right-3 mobile:bottom-3 mobile:left-3 mobile:w-auto mobile:max-h-[calc(100%-130px)] mobile:px-4 mobile:pt-4 mobile:translate-none"
            aria-labelledby="practice-title"
            in:fly={{ y: 24, duration: 300 }}
        >
            <header class="flex gap-4 items-start justify-between">
                <div class="grid gap-2">
                    <p class={kicker} id="practice-title">
                        Quick check
                        {#if practice_question}
                            · {fmt_num(practice.index + 1)} / {fmt_num(practice.questions.length)}{/if}
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

            {#if source_error && !practice_ready}
                <button class={ghost_button} onclick={() => location.reload()}>Try again</button>
            {/if}
            {#if practice_view}
                {#key practice_question.question_id}
                    <div class="grid gap-3" in:fade={{ duration: 220 }}>
                        {#if practice_view.language !== language}
                            <span class={fine_print} lang={practice_view.language}
                                >{locales.find((item) => item.code === practice_view.language)
                                    ?.label}</span
                            >
                        {/if}
                        <p
                            class="text-ink font-serif text-[1.1875rem] leading-[1.5] text-pretty"
                            lang={practice_view.language}
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
                                    lang={practice_view.language}
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
                                {#if source_error}
                                    <button class={ghost_button} onclick={() => location.reload()}
                                        >Try again</button
                                    >
                                {/if}
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
                                {#if !practice_result.skipped}
                                    <p class="font-semibold text-[0.9375rem]">
                                        {#if practice_result.correct}<span class="text-[#7fd1a0]"
                                                >Correct.</span
                                            >{:else}<span class="text-[#e8a857]">Not quite.</span
                                            >{/if}
                                    </p>
                                {/if}
                                {#if picked}
                                    <p
                                        class="text-ink-soft leading-[1.5]"
                                        dir="auto"
                                        lang={practice_view.language}
                                    >
                                        {picked.feedback}
                                    </p>
                                {/if}
                                <p
                                    class="text-ink leading-[1.55]"
                                    dir="auto"
                                    lang={practice_view.language}
                                >
                                    {practice_view.explanation}
                                </p>
                                {#if practice_result.used_source}
                                    <p class={fine_print}>You read the passage before answering.</p>
                                {/if}
                                <div class="flex flex-wrap gap-2 items-center">
                                    <button
                                        class="{ghost_button} min-h-8 py-1"
                                        onclick={toggle_passage}
                                    >
                                        {@render icon('sources')}
                                        {#if practice.source_open}Hide the passage{:else}Read the passage{/if}
                                    </button>
                                    <button class={primary_button} onclick={next_question}>
                                        {#if practice.index + 1 < practice.questions.length}Next question{:else}See how you did{/if}
                                        {@render icon('next')}
                                    </button>
                                    {#if source_error}
                                        <button
                                            class={ghost_button}
                                            onclick={() => location.reload()}>Try again</button
                                        >
                                    {/if}
                                </div>
                            </div>
                        {/if}
                        {#if practice_units.length}
                            <div class="grid gap-2" in:fade>
                                {#each practice_units as unit, index (unit.unit_id)}
                                    {@const passage = reading_for(unit, practice_wording)}
                                    {#if index === 0 || unit.evidence_id !== practice_units[index - 1].evidence_id}
                                        <div
                                            class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-ink-soft"
                                        >
                                            <strong lang={passage.language} dir="auto"
                                                >{passage.book} · {passage.speaker}</strong
                                            >
                                            <a
                                                href={unit.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                lang={language}>Original source ↗</a
                                            >
                                        </div>
                                    {/if}
                                    {#if unit.kind_ar.includes('قرآن منقول')}
                                        <p class={fine_print} lang={passage.language} dir="auto">
                                            {passage.kind}
                                        </p>
                                    {/if}
                                    {#if passage.language !== language && (index === 0 || reading_for(practice_units[index - 1], practice_wording).language !== passage.language)}
                                        <span class={fine_print} lang={passage.language}
                                            >{locales.find((item) => item.code === passage.language)
                                                ?.label}</span
                                        >
                                    {/if}
                                    <blockquote
                                        class="max-h-[180px] overflow-y-auto py-3 px-4 text-[#fff6e3] bg-[rgba(0,0,0,0.36)] border-0 rounded-xl leading-[1.9]"
                                        class:font-arabic={passage.language === 'ar'}
                                        dir={language_direction(passage.language)}
                                        lang={passage.language}
                                    >
                                        {passage.text}
                                    </blockquote>
                                    {#if index === practice_units.length - 1 || unit.evidence_id !== practice_units[index + 1].evidence_id}
                                        {#if unit.evidence_id === 'H-1655-1021-CRIT-SHAFIIUMAR'}
                                            <details class={fine_print} lang="ar" dir="rtl">
                                                <summary lang={language}>Context</summary
                                                >{unit.context_note_ar.split(
                                                    ' تدريب على النص المعروض',
                                                )[0]}
                                            </details>
                                        {/if}
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/key}
            {:else if practice_done}
                {@const score = practice_tick >= 0 && practice_score(practice)}
                {@const reread = stages_to_reread()}
                <div class="grid gap-3" in:fade>
                    <p class="font-serif text-[1.5rem] leading-[1.25]">
                        {fmt_num(score.correct)} / {fmt_num(score.total)}
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
                <div class="flex gap-3 items-start justify-between">
                    <p class={kicker}>
                        Stage {fmt_num(selected_index + 1)} of {fmt_num(chapter.steps.length)} · {selected_step.title}
                    </p>
                    {#snippet follow_button(props)}
                        <button
                            {...props}
                            class="grid flex-none size-8 -mt-[6px] -me-2 place-items-center p-0 text-ink-soft bg-transparent border border-solid border-line rounded-full hover:text-white hover:border-gold aria-pressed:text-gold-bright aria-pressed:border-gold"
                            aria-label="Follow along"
                            aria-pressed={sheet === 'reading'}
                            onclick={follow_along}
                        >
                            {@render icon('expand')}
                        </button>
                    {/snippet}
                    {@render tip('Follow along', follow_button)}
                </div>
                <div
                    class="grid min-h-[6.6rem] max-h-[7.2rem] overflow-y-auto content-start [scrollbar-width:none] [&>*]:[grid-area:1/1] mobile:min-h-[8.6rem] mobile:max-h-[8.6rem]"
                    aria-live="polite"
                    bind:this={caption_window}
                >
                    {#key current_cue?.id ?? selected_step.paragraphs[0]?.id}
                        <p class={caption} in:fade={{ duration: 450 }}>
                            {#each story_sentences as sentence, index (index)}<span
                                    class="transition-opacity duration-300 data-[dim=true]:opacity-45"
                                    data-dim={spoken_sentence >= 0 && index !== spoken_sentence}
                                    data-spoken={index === spoken_sentence}>{sentence}</span
                                >{/each}
                        </p>
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
                                <a
                                    class="py-[2px] px-[10px] text-ink-soft bg-transparent border border-dashed border-line-strong rounded-full data-[active=true]:text-gold-ink data-[active=true]:bg-gold data-[active=true]:border-solid"
                                    aria-current={open_term === item.id ? 'page' : undefined}
                                    data-active={open_term === item.id}
                                    href={href(`/journey/hijrah/glossary/${item.id}`)}
                                    onclick={(event) =>
                                        follow_link(event, () => toggle_term(item.id))}
                                    >{item.word}</a
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
                {#if stage_chapter}
                    <!-- The chapter behind this stage; it lights up when the stage ends. -->
                    <a
                        class="group/chapter flex flex-wrap gap-x-5 gap-y-2 items-center justify-between py-3 px-4 -mx-1 border border-solid border-line rounded-xl bg-[rgba(255,244,222,0.03)] transition-[border-color,background] duration-500 hover:border-gold data-[invite=true]:border-gold data-[invite=true]:bg-[rgba(232,178,87,0.1)]"
                        href={href(`/chapters/${stage_chapter.chapter_id}`)}
                        data-invite={stop_finished && !journey.is_playing}
                    >
                        <span class="grid gap-[3px] min-w-0">
                            <span
                                class="hidden text-gold text-[0.75rem] font-semibold tracking-[0.08em] uppercase group-data-[invite=true]/chapter:block"
                                >Go deeper</span
                            >
                            <span
                                class="flex gap-2 items-center font-serif text-[1.125rem] leading-[1.3] text-ink [&>svg]:text-gold"
                            >
                                {@render icon('read')}
                                <span
                                    lang={chapter_content_locale(stage_chapter, language)}
                                    dir={language_direction(
                                        chapter_content_locale(stage_chapter, language),
                                    )}>{chapter_title(stage_chapter, language)}</span
                                >
                            </span>
                            {#if stage_facts?.id === stage_chapter.chapter_id}
                                <span class="text-muted text-[0.8125rem]"
                                    >{fmt_num(stage_facts.sections)} sections · {fmt_num(
                                        stage_facts.passages,
                                    )} source passages · {fmt_num(stage_facts.questions)} questions</span
                                >
                            {/if}
                        </span>
                        <span
                            class="inline-flex gap-2 items-center px-4 py-2 text-gold-bright text-[0.875rem] font-semibold border border-solid border-gold rounded-full group-hover/chapter:bg-gold group-hover/chapter:text-gold-ink [&>svg]:rtl:-scale-x-100"
                        >
                            Read the chapter {@render icon('next')}
                        </span>
                    </a>
                {/if}
                <div class={card_row}>
                    <!-- Practice lives in the chapter: its questions follow the story it tells. -->
                    {#if stop_finished && !journey.is_playing && stage_chapter && stage_facts?.id === stage_chapter.chapter_id && stage_facts.questions}
                        <a
                            class="{ghost_button} border-gold mobile:flex-[1_1_100%]"
                            href={href(`/chapters/${stage_chapter.chapter_id}/practice`)}
                        >
                            {@render icon('quiz')} Check your understanding
                            <span
                                class="min-w-5 px-[6px] py-px text-gold-bright bg-[rgba(232,178,87,0.16)] rounded-full text-[0.75rem]"
                                >{fmt_num(stage_facts.questions)}</span
                            >
                        </a>
                    {/if}
                    {#if !stage_chapter}
                        <a
                            class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                            href={journey_href(scene_path(), { ...context(), view: 'reading' })}
                            onclick={(event) => follow_link(event, open_reading)}
                        >
                            {@render icon('read')} Read
                        </a>
                    {/if}
                    <a
                        class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                        href={href(`/journey/hijrah/sources/${visible_sources[0]?.id}`)}
                        onclick={(event) =>
                            follow_link(event, () => view_source(visible_sources[0]?.id))}
                    >
                        {@render icon('sources')} Sources
                        <span
                            class="min-w-5 py-px px-[6px] text-gold-bright bg-[rgba(232,178,87,0.16)] rounded-full text-[0.75rem]"
                            >{fmt_num(visible_sources.length)}</span
                        >
                    </a>
                    <a
                        class="{ghost_button} mobile:flex-[1_1_auto] mobile:px-[10px]"
                        href={href('/journey/hijrah/ask')}
                        onclick={(event) => follow_link(event, open_question)}
                    >
                        {@render icon('ask')} Ask
                    </a>
                    <!-- The way on takes the trailing edge, after the secondary actions. -->
                    {#if stop_finished && !journey.is_playing}
                        <button
                            class="{primary_button} ms-auto mobile:flex-[1_1_100%] [&>svg]:rtl:-scale-x-100"
                            onclick={continue_chapter}
                        >
                            {#if is_last_step}
                                {@render icon('check')} Complete the journey
                            {:else}
                                Continue: {chapter.steps[selected_index + 1].title}
                                {@render icon('next')}
                            {/if}
                        </button>
                    {/if}
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
                    <h2 class={sheet_title} id="sheet-title">{selected_step.title}</h2>
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
                                <p class={kicker}>Journey complete</p>
                                <h3 class="font-serif text-[1.4rem] font-medium">
                                    What to carry forward
                                </h3>
                                <p class="text-ink-soft leading-[1.55]">{selected_step.recap}</p>
                                <div class="flex flex-wrap gap-2">
                                    {#if stage_chapter}
                                        <a
                                            class={primary_button}
                                            href={href(
                                                `/chapters/${stage_chapter.chapter_id}/practice`,
                                            )}
                                        >
                                            {@render icon('ask')} Practise what you learned
                                        </a>
                                    {/if}
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
                        {#each selected_step.paragraphs as paragraph, index (paragraph.id)}
                            {@const current = on_guided_stop && current_cue?.id === paragraph.id}
                            <p
                                class="{prose} -mx-3 px-3 py-1 rounded-lg scroll-my-6 transition-[background] duration-300 data-[current=true]:bg-[rgba(232,178,87,0.1)]"
                                id={paragraph.id}
                                data-current={current}
                            >
                                {#if on_guided_stop}
                                    <button
                                        class="block w-full p-0 text-start text-inherit bg-transparent border-0 [font:inherit] cursor-pointer"
                                        onclick={() => seek_to(paragraph_start(index))}
                                    >
                                        {#if current}{#each story_sentences as sentence, part (part)}<span
                                                    class="transition-opacity duration-300 data-[dim=true]:opacity-45"
                                                    data-dim={spoken_sentence >= 0 &&
                                                        part !== spoken_sentence}>{sentence}</span
                                                >{/each}{:else}{paragraph.text}{/if}
                                    </button>
                                {:else}
                                    {paragraph.text}
                                {/if}
                            </p>
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
                        {#each stage_readings as reading (reading.chapter_id)}
                            <section
                                class="grid gap-4 pt-6 border-0 border-t border-solid border-line"
                                lang={reading.locale}
                                dir={reading.locale === 'ar' ? 'rtl' : 'ltr'}
                            >
                                <h3
                                    class="font-serif text-[1.5rem] font-medium leading-[1.2] text-gold-bright"
                                >
                                    {reading.title}
                                </h3>
                                {#each reading.account as section (section.section_id)}
                                    <h4
                                        class="m-0 font-serif text-[1.1875rem] font-semibold leading-[1.35]"
                                    >
                                        {section.title}
                                    </h4>
                                    {#each section.paragraphs as block (block.paragraph_id)}
                                        <p class={prose}>{block.text}</p>
                                    {/each}
                                {/each}
                                {#if mode === 'deep' && reading.in_depth.length}
                                    <p class="{kicker} pt-2">In depth</p>
                                    {#each reading.in_depth as section (section.section_id)}
                                        <h4
                                            class="m-0 font-serif text-[1.1875rem] font-semibold leading-[1.35]"
                                        >
                                            {section.title}
                                        </h4>
                                        {#each section.paragraphs as block (block.paragraph_id)}
                                            <p class={prose}>{block.text}</p>
                                        {/each}
                                    {/each}
                                {/if}
                                <button
                                    class="{ghost_button} justify-self-start"
                                    onclick={() => open_chapter(reading.chapter_id)}
                                >
                                    {@render icon('read')} The full chapter, with its sources and practice
                                </button>
                            </section>
                        {/each}
                        {#if stage_details.length}
                            <section
                                class="grid gap-4 pt-6 border-0 border-t border-solid border-line"
                            >
                                <p class={kicker}>Along the way</p>
                                {#each stage_details as item (item.id)}
                                    <div class="grid gap-2">
                                        <h4
                                            class="m-0 font-serif text-[1.1875rem] font-semibold leading-[1.35]"
                                        >
                                            {item.title}
                                        </h4>
                                        <p class={prose}>{item.text}</p>
                                        {@render citations([item.source_id])}
                                    </div>
                                {/each}
                            </section>
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
                            {@render icon('check')} Complete the journey
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
                    <button
                        class="{round_button} hidden compact:grid"
                        onclick={toggle_play}
                        aria-label={journey.is_playing ? 'Pause' : 'Play'}
                    >
                        {@render icon(journey.is_playing ? 'pause' : 'play')}
                    </button>
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
                            placeholder="Ask about this journey…"></textarea>
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
                                        : 'Journey notes · offline'}
                                </p>
                                {#if journey.answer.language && journey.answer.language !== language}
                                    <span class={fine_print} lang={journey.answer.language}
                                        >{locales.find(
                                            (item) => item.code === journey.answer.language,
                                        )?.label}</span
                                    >
                                {/if}
                                <p
                                    class="{prose} whitespace-pre-wrap"
                                    dir="auto"
                                    lang={journey.answer.language ?? language}
                                >
                                    {journey.answer.answer}
                                </p>
                                {@render citations(journey.answer.citations ?? [])}
                                {#if journey.answer.action && chapter.steps.some((step) => step.id === journey.answer.action.step_id)}
                                    <button
                                        class={primary_button}
                                        lang={journey.answer.language ?? language}
                                        onclick={show_action}
                                    >
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
                    <h2 class={sheet_title} id="sheet-title">
                        {source_scope === 'all'
                            ? 'All evidence'
                            : (source_step?.title ?? fmt_num(active_source.reference))}
                    </h2>
                    <button class={round_button} onclick={close_sheet} aria-label="Close source">
                        {@render icon('close')}
                    </button>
                </header>
                <!-- All of the stage's sources in one scroll; the one asked for is highlighted. -->
                <div class={sheet_body} bind:this={source_list} data-scroll-id="journey-sources">
                    {#if source_scope === 'all'}
                        {@render kind_filters(true)}
                    {/if}
                    {#each drawer_groups as group (group.step?.id ?? 'stage')}
                        {#if group.step}
                            <h3
                                class="{kicker} pt-5 first:pt-0 scroll-mt-4"
                                data-stage={group.step.id}
                            >
                                {fmt_num(group.index + 1)} · {group.step.title}
                            </h3>
                        {/if}
                        {#each group.sources as source (source.id)}
                            <!-- The one the learner opened is marked by a gold edge. -->
                            <article
                                class="grid gap-3 py-5 ps-4 border-0 border-t border-s-2 border-solid border-line border-s-transparent first:border-t-0 first:pt-1 scroll-mt-4 transition-[border-color] duration-500 data-[active=true]:border-s-gold"
                                data-source={source.id}
                                data-active={source_scope === 'stage' &&
                                    source.id === active_source.id}
                            >
                                <span class="flex gap-2 items-center">
                                    <span
                                        class="grid w-fit min-w-5 h-5 place-items-center px-[5px] text-gold-ink bg-gold rounded-full text-[0.75rem] font-bold"
                                        >{fmt_num(source.number)}</span
                                    >{#if source.strength === 'weak'}<span
                                            class="text-[0.75rem] text-ink-soft">Weaker report</span
                                        >{/if}
                                </span>
                                <blockquote
                                    class="py-4 px-5 text-[#fff6e3] bg-[rgba(0,0,0,0.36)] border-0 rounded-xl font-arabic text-[1.375rem] leading-[2]"
                                    dir="rtl"
                                    lang="ar"
                                >
                                    {source.excerpt}
                                </blockquote>
                                {#if !source.retrieved}
                                    <p class="text-ink-soft text-[0.9375rem] leading-[1.55]">
                                        {source.explanation}
                                    </p>
                                {:else if source.truncated}
                                    <p class={fine_print}>
                                        This passage is shortened. Open the original page for its
                                        full context.
                                    </p>
                                {/if}
                                <!-- One reference: what the passage is, and the book on Turath it was read
                                 in, which is the page the link opens. -->
                                <a
                                    class="group/ref flex flex-wrap gap-x-2 gap-y-[2px] items-baseline justify-end text-end"
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`Open the page on Turath: ${source.reference}`}
                                >
                                    <span
                                        class="inline-flex gap-2 items-center text-gold font-semibold text-[0.9375rem] group-hover/ref:text-gold-bright"
                                        ><span dir="auto">{fmt_num(source.reference)}</span>
                                        {@render icon('external')}</span
                                    >
                                    <span class="text-muted text-[0.8125rem]"
                                        >read in <span
                                            class="text-ink-soft font-arabic text-[1rem]"
                                            lang="ar"
                                            dir="rtl">{source.work}</span
                                        >{#if source.volume}, vol. {fmt_num(source.volume)}, p. {fmt_num(source.page)}{/if}</span
                                    >
                                </a>
                            </article>
                        {/each}
                    {/each}
                </div>
                <footer class={sheet_footer}>
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
