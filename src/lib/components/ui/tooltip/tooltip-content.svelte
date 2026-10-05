<script>
    import { Tooltip as TooltipPrimitive } from 'bits-ui'
    import { cn } from '$lib/utils.js'
    import TooltipPortal from './tooltip-portal.svelte'

    let {
        ref = $bindable(null),
        class: className,
        sideOffset = 6,
        side = 'bottom',
        children,
        arrowClasses,
        portalProps,
        ...restProps
    } = $props()
</script>

<TooltipPortal {...portalProps}>
    <TooltipPrimitive.Content
        bind:ref
        data-slot="tooltip-content"
        {sideOffset}
        {side}
        class={cn(
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md border border-solid border-line-strong bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.4)] origin-(--bits-tooltip-content-transform-origin)',
            className,
        )}
        {...restProps}
    >
        {@render children?.()}
    </TooltipPrimitive.Content>
</TooltipPortal>
