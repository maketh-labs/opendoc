import type { Server } from 'http'

export const DEFAULT_HOST = '127.0.0.1'

/**
 * Listen on `port`, moving to the next port while it is in use.
 * Binding (not a probe connection) is the only race-free way to know a port is free.
 */
export async function listenWithFallback(server: Server, port: number, host: string, maxAttempts = 50): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = port + attempt
    const ok = await new Promise<boolean>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (err.code === 'EADDRINUSE') resolve(false)
        else reject(err)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(true)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(candidate, host)
    })
    if (ok) {
      const address = server.address()
      return typeof address === 'object' && address ? address.port : candidate
    }
    console.log(`  Port ${candidate} in use, trying ${candidate + 1}...`)
  }
  throw new Error(`No free port found in ${port}-${port + maxAttempts - 1}`)
}

/** URL to show users for a bound host (wildcard binds are shown as localhost). */
export function displayUrl(host: string, port: number, path = ''): string {
  const h = host === '0.0.0.0' || host === '::' || host === '127.0.0.1' ? 'localhost' : host.includes(':') ? `[${host}]` : host
  return `http://${h}:${port}${path}`
}
