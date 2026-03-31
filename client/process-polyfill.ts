// Polyfill Node's `process` global for browser bundles (needed by satori + deps)
if (typeof globalThis.process === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).process = {
    env: { NODE_ENV: 'production' },
    browser: true,
    version: 'v20.0.0',
    versions: {},
    platform: 'browser',
    hrtime: (t?: [number, number]): [number, number] => {
      const now = performance.now() * 1e6
      if (t) { const d = now - (t[0] * 1e9 + t[1]); return [Math.floor(d / 1e9), d % 1e9] }
      return [Math.floor(now / 1e9), now % 1e9]
    },
    nextTick: (fn: () => void) => Promise.resolve().then(fn),
    cwd: () => '/',
    argv: [],
    exit: () => {},
  }
}
