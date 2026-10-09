/** Server-sent-events hub for the dev server's live reload */
export class ReloadHub {
  private clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  private encoder = new TextEncoder()
  private heartbeat: ReturnType<typeof setInterval>

  constructor() {
    // Comment lines keep connections alive through proxies and Bun's idle timeout
    this.heartbeat = setInterval(() => this.send(': ping\n\n'), 20_000)
    this.heartbeat.unref?.()
  }

  /** SSE response that receives `reload` events until the client disconnects */
  connect(): Response {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => { controller = c; this.clients.add(c) },
      cancel: () => { this.clients.delete(controller) },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  }

  reload(): void {
    this.send('data: reload\n\n')
  }

  private send(chunk: string): void {
    const bytes = this.encoder.encode(chunk)
    for (const c of this.clients) {
      try { c.enqueue(bytes) } catch { this.clients.delete(c) }
    }
  }

  close(): void {
    clearInterval(this.heartbeat)
    for (const c of this.clients) { try { c.close() } catch {} }
    this.clients.clear()
  }
}
