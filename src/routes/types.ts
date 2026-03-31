import { resolve } from 'path'
import type { ServerResponse, IncomingMessage } from 'http'
import type { NavNode, OpenDocConfig, BacklinksIndex } from '../types'

export interface RouteContext {
  rootDir: string
  projectRoot: string
  config: OpenDocConfig
  editorPath: string | null
  clientDir: string
  port: number
  getEditorBundleJs: () => string | null
  setEditorBundleJs: (js: string) => void
  getEditorBundleCss: () => string | null
  setEditorBundleCss: (css: string) => void
  getViewerBundleJs: () => string | null
  setViewerBundleJs: (js: string) => void
  getViewerHtml: () => string | null
  setViewerHtml: (html: string) => void
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

/** Read the full request body as a UTF-8 string */
export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => resolve(data))
  })
}

/** Read the full request body as a raw Buffer (for multipart / binary) */
export function readBodyRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

/** Path traversal guard — true if fullPath is inside rootDir */
export function isWithinRoot(rootDir: string, fullPath: string): boolean {
  const resolved = resolve(rootDir)
  return fullPath.startsWith(resolved + '/') || fullPath === resolved
}

export const MIME_TYPES: Record<string, string> = {
  ico: 'image/x-icon', svg: 'image/svg+xml', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', webmanifest: 'application/manifest+json',
  pdf: 'application/pdf',
}
