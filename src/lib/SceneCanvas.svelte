<script>
    import { onMount } from 'svelte'
    import { create_scene } from './scene-renderer.js'

    let {
        label,
        shot,
        mood,
        route,
        cycle,
        progress,
        actor,
        arrival = null,
        evidence,
        chapters = [],
        reset_key = 0,
        active_poi_id,
        insets,
        link_context,
        link_at,
        on_poi,
        on_source,
    } = $props()
    let host
    let world = $state(null)
    let status = $state('loading')
    let first_shot = true

    onMount(() => {
        let cancelled = false
        let created
        create_scene(host, {
            on_poi,
            on_source: (id) => on_source?.(id),
            report(next) {
                if (!cancelled) status = next
            },
        }).then((api) => {
            created = api
            if (cancelled) api.dispose()
            else world = api
        })
        return () => {
            cancelled = true
            created?.dispose()
        }
    })

    $effect(() => {
        if (!world || !shot) return
        void reset_key
        world.set_shot(shot, first_shot ? 0 : 2200)
        first_shot = false
    })
    $effect(() => world?.set_mood(mood))
    $effect(() => world?.set_route(route))
    $effect(() => world?.set_cycle(cycle))
    $effect(() => world?.set_progress(progress))
    $effect(() => world?.set_actor(actor))
    $effect(() => world?.set_arrival(arrival))
    $effect(() => world?.set_evidence(evidence))
    $effect(() => world?.set_insets(insets))
    $effect(() => world?.set_active(active_poi_id))
    $effect(() => world?.set_links(link_context, link_at))
    $effect(() => world?.set_chapters(chapters))
</script>

<div class="group/scene absolute inset-0" data-scene-status={status}>
    <div
        class="absolute inset-0 cursor-grab touch-none transition-opacity duration-[0.9s] ease-[ease] group-data-[scene-status=loading]/scene:opacity-0 data-[dragging=true]:cursor-grabbing [&>canvas]:block [&>canvas]:w-full! [&>canvas]:h-full!"
        bind:this={host}
        aria-label={label}
        role="group"
    ></div>
    {#if status === 'failed'}
        <p
            class="absolute top-24 left-1/2 max-w-[30rem] py-[10px] px-4 bg-panel-solid border border-solid border-line rounded-[10px] text-[0.875rem] [transform:translateX(-50%)]"
            role="status"
        >
            The 3D illustration is unavailable on this device. The full journey is still here to
            read.
        </p>
    {/if}
</div>
