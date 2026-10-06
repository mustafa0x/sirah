import path from 'node:path'

export function narration_hmr() {
    let directory
    return {
        name: 'narration-hmr',
        configResolved(config) {
            directory = path.resolve(config.root, 'src/assets/narration') + path.sep
        },
        hotUpdate: {
            // Run after Vite adds import.meta.glob importers for new/deleted clips.
            order: 'post',
            handler({ file, modules, timestamp }) {
                if (!file.startsWith(directory)) return
                // Pick up generated clips and timings on refresh without interrupting playback.
                const invalidated = new Set()
                for (const module of modules) {
                    this.environment.moduleGraph.invalidateModule(
                        module,
                        invalidated,
                        timestamp,
                        true,
                    )
                }
                return []
            },
        },
    }
}
