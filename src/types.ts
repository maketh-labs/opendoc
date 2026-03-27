export interface NavNode {
  title: string
  path: string
  url: string
  icon?: string
  children: NavNode[]
}

export interface Page {
  url: string
  path: string
  title: string
  icon?: string
  content: string
  html: string
}

export interface BacklinksIndex {
  [targetUrl: string]: string[]
}

export interface OpenDocConfig {
  title?: string
  theme?: string
  mcp?: { port?: number }
  nav?: { order?: string[] }
}

export type ContextTier = "full" | "context" | "context-mini"

export interface TemplateVars {
  title: string
  siteTitle: string
  content: string
  nav: string
  backlinks: string
  toc: string
  icon: string
  pageTitle: string
}

export interface SearchResult {
  path: string
  snippet: string
}
