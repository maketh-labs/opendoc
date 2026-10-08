import type { ServerResponse, IncomingMessage } from 'http'
import type { NavNode, OpenDocConfig, BacklinksIndex } from '../types'
import type { ClientBundles } from '../assets'

export interface RouteContext {
  rootDir: string
  config: OpenDocConfig
  editorPath: string | null
  /** Actual bound port (updated after listen) */
  port: number
  bundles: ClientBundles
  getStyles: () => string
  getNavTree: () => NavNode | null
  getBacklinks: () => BacklinksIndex
  getTitleMap: () => Map<string, string>
  reloadClients: Set<ServerResponse>
}

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  context: RouteContext,
) => Promise<boolean>

// ── Shared route utilities ───────────────────────────────────────────────────

export { readBody, readBodyRaw, readJson, readFormData, isWithinRoot, resolveInRoot, HttpError } from '../security'

/** Write a JSON response */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Write a plain-text response */
export function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

export const MIME_TYPES: Record<string, string> = {
  ico: 'image/x-icon', svg: 'image/svg+xml', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', webmanifest: 'application/manifest+json',
  pdf: 'application/pdf', avif: 'image/avif', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', json: 'application/json',
  zip: 'application/zip',
}
