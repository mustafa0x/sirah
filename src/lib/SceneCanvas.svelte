<script>
    import { onMount } from 'svelte'
    import { scene_pois } from './scene-manifest.js'
    import { create_scene } from './scene-renderer.js'

    let { kind, label, on_poi, selected_poi_id } = $props()
    let focus_scene_poi = () => {}
    let host
    let status = $state('loading')

    onMount(() => {
        let dispose = () => {}
        let cancelled = false
        create_scene(
            host,
            kind,
            (next) => {
                if (!cancelled) status = next
            },
            on_poi,
            (focus) => {
                focus_scene_poi = focus
            },
        ).then((cleanup) => {
            if (cancelled) cleanup()
            else dispose = cleanup
        })
        return () => {
            cancelled = true
            dispose()
        }
    })

    $effect(() => {
        const poi = scene_pois[kind]?.find((item) => item.id === selected_poi_id)
        if (poi) focus_scene_poi(poi)
    })
</script>

<div class="scene-wrap">
    <div class="scene-status" role="status" aria-live="polite">
        {#if status === 'loading'}Loading the draft illustration…
        {:else if status === 'ready'}Draft illustration · schematic, not a reconstruction
        {:else}The 3D illustration is unavailable. Continue with the reading below.{/if}
    </div>
    <div class="scene-canvas" bind:this={host} aria-label={label} role="img"></div>
</div>
