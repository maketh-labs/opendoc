import type { Server } from 'bun'

export const DEFAULT_HOST = '127.0.0.1'

type ServeOptions = Omit<Parameters<typeof Bun.serve>[0], 'port' | 'hostname'>

/**
 * Bun.serve on `port`, moving to the next port while it is in use.
 * Binding (not a probe connection) is the only race-free way to know a port is free.
 * Port 0 picks any free port.
 */
export function serveWithFallback(options: ServeOptions, port: number, host: string, maxAttempts = 50): Server<undefined> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = port === 0 ? 0 : port + attempt
    try {
      return Bun.serve({ ...options, port: candidate, hostname: host } as Parameters<typeof Bun.serve>[0]) as Server<undefined>
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE' || port === 0) throw err
      console.log(`  Port ${candidate} in use, trying ${candidate + 1}...`)
    }
  }
  throw new Error(`No free port found in ${port}-${port + maxAttempts - 1}`)
}

/** URL to show users for a bound host (wildcard binds are shown as localhost). */
export function displayUrl(host: string, port: number, path = ''): string {
  const h = host === '0.0.0.0' || host === '::' || host === '127.0.0.1' ? 'localhost' : host.includes(':') ? `[${host}]` : host
  return `http://${h}:${port}${path}`
}
