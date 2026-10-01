import { cue_for, get_step } from '../content/first-chapter.js'

export function create_journey_state() {
    return {
        started: false,
        guided_position: { step_id: 'setting', seconds: 0 },
        viewed_step_id: 'setting',
        mode: 'idle', // idle | guided | exploring | pending_navigation | detour | completed
        presentation: 'reading', // scene | reading
        phase: 'idle', // guided | exploring | source-open | detour | resumed | completed
        navigation_generation: 0,
        navigation_pending: false,
        guide_generation: 0,
        source_generation: 0,
        media_generation: 0,
        is_playing: false,
        panel: 'none', // none | question | source
        source_id: null,
        answer: null,
        question_pending: false,
        announcement: '',
    }
}

function time_for(step_id, seconds) {
    const step = get_step(step_id)
    if (!Number.isFinite(seconds)) throw new Error('Non-finite time')
    return Math.max(0, Math.min(step.duration, seconds))
}

export function start_journey(state, presentation = 'scene') {
    state.started = true
    state.guided_position = { step_id: 'setting', seconds: 0 }
    state.viewed_step_id = 'setting'
    state.mode = 'guided'
    state.phase = 'guided'
    state.presentation = presentation
    state.panel = 'none'
    state.answer = null
    state.question_pending = false
    state.announcement =
        presentation === 'reading' ? 'Reading mode selected.' : 'Guided presentation started.'
}

export function pause(state, actual_seconds) {
    if (actual_seconds !== undefined) {
        state.guided_position.seconds = time_for(state.guided_position.step_id, actual_seconds)
    }
    state.is_playing = false
    state.media_generation += 1
}

export function restore_journey(state) {
    pause(state)
    state.started = true
    state.viewed_step_id = state.guided_position.step_id
    state.mode = 'guided'
    state.phase = 'resumed'
    state.navigation_pending = false
    state.panel = 'none'
    state.source_id = null
    state.question_pending = false
    state.answer = null
    state.guide_generation += 1
    state.presentation = 'scene'
    state.announcement = 'Guided position restored. Press Play to continue.'
}

export function choose_reading(state) {
    state.started = true
    pause(state)
    state.mode = 'guided'
    state.phase = 'guided'
    state.presentation = 'reading'
    state.panel = 'none'
    state.announcement = 'Reading mode selected. The same chapter is available without narration.'
}

export function toggle_reading(state) {
    state.presentation = state.presentation === 'reading' ? 'scene' : 'reading'
    state.announcement =
        state.presentation === 'reading' ? 'Reading mode selected.' : 'Scene mode selected.'
}

export function begin_navigation(state, step_id, purpose = 'guided', seconds = 0) {
    const time = time_for(step_id, seconds)
    pause(state)
    state.started = true
    state.mode = 'pending_navigation'
    state.phase = purpose === 'detour' ? 'detour' : 'guided'
    state.navigation_pending = true
    state.navigation_generation += 1
    state.guide_generation += 1
    state.panel = 'none'
    state.source_id = null
    state.question_pending = false
    return { generation: state.navigation_generation, step_id, seconds: time, purpose }
}

export function commit_navigation(state, ticket, presentation = state.presentation) {
    if (!state.navigation_pending || ticket.generation !== state.navigation_generation) return false
    state.viewed_step_id = ticket.step_id
    state.presentation = presentation
    state.navigation_pending = false
    state.panel = 'none'
    state.source_id = null
    state.answer = null
    state.question_pending = false
    state.guide_generation += 1
    state.media_generation += 1
    if (ticket.purpose !== 'detour') {
        state.guided_position = { step_id: ticket.step_id, seconds: ticket.seconds }
        state.mode = 'guided'
        state.phase = ticket.purpose === 'restore' ? 'resumed' : 'guided'
    } else {
        state.mode = 'detour'
        state.phase = 'detour'
    }
    state.is_playing = false
    return true
}

export function resume(state) {
    return begin_navigation(
        state,
        state.guided_position.step_id,
        'restore',
        state.guided_position.seconds,
    )
}

export function seek(state, seconds) {
    return begin_navigation(state, state.guided_position.step_id, 'restore', seconds)
}

export function begin_question(state, actual_seconds) {
    if (state.navigation_pending) throw new Error('Destination is not committed')
    pause(state, actual_seconds)
    state.mode = 'exploring'
    state.phase = 'exploring'
    state.panel = 'question'
    state.source_id = null
    state.guide_generation += 1
    state.question_pending = false
    return {
        generation: state.guide_generation,
        step_id: state.viewed_step_id,
        position: { ...state.guided_position },
    }
}

export function answer_permission(state, ticket) {
    const current =
        ticket.generation === state.guide_generation &&
        ticket.step_id === state.viewed_step_id &&
        !state.navigation_pending
    return { text: current, automatic_focus: current && state.panel === 'question' }
}

export function publish_answer(state, ticket, answer) {
    if (!answer_permission(state, ticket).text) return false
    state.answer = answer
    state.question_pending = false
    return true
}

export function open_source(state, source_id, actual_seconds) {
    if (actual_seconds !== undefined) pause(state, actual_seconds)
    state.mode = 'exploring'
    state.phase = 'source-open'
    state.panel = 'source'
    state.source_id = source_id
    state.source_generation += 1
    state.announcement = 'Source opened. Guided playback remains paused.'
}

export function close_panel(state) {
    state.panel = 'none'
    state.source_id = null
    state.guide_generation += 1
    state.question_pending = false
    state.announcement = 'Panel closed. Press Resume journey to return to the guided position.'
}

export function begin_play(state) {
    if (
        state.navigation_pending ||
        state.viewed_step_id !== state.guided_position.step_id ||
        state.mode !== 'guided'
    ) {
        throw new Error('Restore guided presentation before playback')
    }
    state.is_playing = false
    return { generation: ++state.media_generation, step_id: state.guided_position.step_id }
}

export function settle_play(state, ticket, succeeded) {
    if (
        ticket.generation !== state.media_generation ||
        ticket.step_id !== state.guided_position.step_id ||
        state.navigation_pending ||
        state.mode === 'detour'
    )
        return false
    state.is_playing = succeeded
    return true
}

export function complete_chapter(state) {
    pause(state)
    state.viewed_step_id = 'arrival'
    state.mode = 'completed'
    state.phase = 'completed'
    state.panel = 'none'
    state.presentation = 'reading'
    state.announcement = 'Chapter complete. Recap opened.'
}

export function presentation_state(state) {
    const visible = get_step(state.viewed_step_id)
    const guided = get_step(state.guided_position.step_id)
    return {
        title: visible.title,
        scene: visible.scene,
        cue:
            state.mode === 'guided' && !state.navigation_pending
                ? cue_for(guided, state.guided_position.seconds)
                : null,
    }
}
