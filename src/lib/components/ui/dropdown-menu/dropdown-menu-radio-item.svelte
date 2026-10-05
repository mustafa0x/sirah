<script>
    import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui'
    import { cn } from '$lib/utils.js'

    let { ref = $bindable(null), class: className, children: childrenProp, ...restProps } = $props()
</script>

<DropdownMenuPrimitive.RadioItem
    bind:ref
    data-slot="dropdown-menu-radio-item"
    class={cn(
        'relative flex cursor-default items-center gap-1.5 rounded-lg py-1 ps-1.5 pe-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
    )}
    {...restProps}
>
    {#snippet children({ checked })}
        <span
            class="pointer-events-none absolute end-2 flex items-center justify-center text-gold"
            data-slot="dropdown-menu-radio-item-indicator"
        >
            {#if checked}
                <svg
                    class="size-4 fill-none stroke-current [stroke-width:2.2] [stroke-linecap:round] [stroke-linejoin:round]"
                    viewBox="0 0 24 24"
                    aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
                >
            {/if}
        </span>
        {@render childrenProp?.({ checked })}
    {/snippet}
</DropdownMenuPrimitive.RadioItem>
