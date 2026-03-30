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
