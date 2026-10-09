import type { OpenDocConfig } from '../types'
import type { ClientBundles } from '../assets'
import type { DocsIndex } from '../docs-index'
import type { ReloadHub } from '../reload'

export interface RouteContext {
  rootDir: string
  config: OpenDocConfig
  editorPath: string | null
  /** Actual bound port (updated after listen) */
  port: number
  bundles: ClientBundles
  styles: string
  index: DocsIndex
  reload: ReloadHub
}

/** Returns a Response if the route matches, otherwise null so the next handler can try. */
export type RouteHandler = (req: Request, url: URL, ctx: RouteContext) => Promise<Response | null> | Response | null

// ── Shared route utilities ───────────────────────────────────────────────────

export { readJson, readFormData, isWithinRoot, resolveInRoot, HttpError } from '../security'

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers })
}

/** JSON error response: `{ error }` */
export function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

export const MIME_TYPES: Record<string, string> = {
  ico: 'image/x-icon', svg: 'image/svg+xml', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', webmanifest: 'application/manifest+json',
  pdf: 'application/pdf', avif: 'image/avif', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', json: 'application/json',
  zip: 'application/zip', js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
}
