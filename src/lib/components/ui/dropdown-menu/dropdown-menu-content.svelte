<script>
    import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui'
    import { cn } from '$lib/utils.js'
    import DropdownMenuPortal from './dropdown-menu-portal.svelte'

    let {
        ref = $bindable(null),
        sideOffset = 6,
        align = 'end',
        portalProps,
        class: className,
        ...restProps
    } = $props()
</script>

<DropdownMenuPortal {...portalProps}>
    <DropdownMenuPrimitive.Content
        bind:ref
        data-slot="dropdown-menu-content"
        {sideOffset}
        {align}
        class={cn(
            'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-x-hidden overflow-y-auto rounded-xl border border-solid border-line-strong bg-popover p-1 text-popover-foreground shadow-[0_18px_60px_rgba(0,0,0,0.45)] duration-100 outline-none data-closed:overflow-hidden',
            className,
        )}
        {...restProps}
    />
</DropdownMenuPortal>
