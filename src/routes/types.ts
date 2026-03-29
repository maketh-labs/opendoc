import type { ServerResponse, IncomingMessage } from 'http'
import type { NavNode, BacklinksIndex } from '../types'

export interface RouteContext {
  rootDir: string
  config: any
  editorPath: string | null
  clientDir: string
  port: number
  getEditorBundleJs: () => string | null
  setEditorBundleJs: (js: string) => void
  getEditorBundleCss: () => string | null
  setEditorBundleCss: (css: string) => void
  getStyles: () => string
  getNavTree: () => NavNode | null
  reloadClients: Set<ServerResponse>
}

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  context: RouteContext,
) => Promise<boolean>
