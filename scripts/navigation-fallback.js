function missing_asset(req, res, next, preview = false) {
    // Vite has already tried its static handlers. Do not turn a missing asset into the SPA.
    const path = (req.originalUrl ?? req.url).split('?', 1)[0]
    const api = preview && /^\/api(?:\/|$)/.test(path)
    if (!api && !/^\/(?:src\/)?assets\//.test(path)) return next()
    res.statusCode = 404
    res.setHeader(
        'Content-Type',
        api ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    )
    res.end(api ? '{"error":"Not found"}' : 'Not found')
}

const install =
    (server, preview = false) =>
    () =>
        server.middlewares.use((req, res, next) => missing_asset(req, res, next, preview))

export const navigation_fallback = {
    name: 'navigation-fallback',
    configureServer: install,
    configurePreviewServer: (server) => install(server, true),
}
