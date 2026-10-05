<script>
    import { Tooltip as TooltipPrimitive } from 'bits-ui'

    let { delayDuration = 200, ...restProps } = $props()
</script>

<TooltipPrimitive.Provider {delayDuration} {...restProps} />
