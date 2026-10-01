<script>
    let { Component, is_404 } = $props()
    const { route } = window.navgo
</script>

<main>
    {#if is_404}
        <h1>Page not found</h1>
        <a href="/">Return to the journey</a>
    {:else if Component}
        {#key $route.url.pathname}
            <Component />
        {/key}
    {/if}
</main>
