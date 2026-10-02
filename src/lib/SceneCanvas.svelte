<script>
    import { onMount } from 'svelte'
    import { create_scene } from './scene-renderer.js'

    let { label, shot, mood, route, active_poi_id, insets, on_poi } = $props()
    let host
    let world = $state(null)
    let status = $state('loading')
    let first_shot = true

    onMount(() => {
        let cancelled = false
        let created
        create_scene(host, {
            on_poi,
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
        world.set_shot(shot, first_shot ? 0 : 2200)
        first_shot = false
    })
    $effect(() => world?.set_mood(mood))
    $effect(() => world?.set_route(route))
    $effect(() => world?.set_insets(insets))
    $effect(() => world?.set_active(active_poi_id))
</script>

<div class="scene-wrap" data-scene-status={status}>
    <div class="scene-canvas" bind:this={host} aria-label={label} role="group"></div>
    {#if status === 'failed'}
        <p class="scene-status" role="status">
            The 3D illustration is unavailable on this device. The full chapter is still here to
            read.
        </p>
    {/if}
</div>
