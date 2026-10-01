<script>
    import { onMount } from 'svelte'
    import { create_scene } from './scene-renderer.js'

    let { kind, label } = $props()
    let host
    let status = $state('loading')

    onMount(() => {
        let dispose = () => {}
        let cancelled = false
        create_scene(host, kind, (next) => {
            if (!cancelled) status = next
        }).then((cleanup) => {
            if (cancelled) cleanup()
            else dispose = cleanup
        })
        return () => {
            cancelled = true
            dispose()
        }
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
