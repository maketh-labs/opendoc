export interface NavNode {
  title: string
  path: string
  url: string
  icon?: string
  children: NavNode[]
}

export interface BacklinksIndex {
  [targetUrl: string]: string[]
}

export interface OpenDocConfig {
  title?: string
  theme?: string
  editorPath?: string | null   // default "/_", null = disabled
  github?: {
    repo?: string              // "owner/repo-name"
    branch?: string            // default "main"
    clientId?: string          // GitHub OAuth App client ID (safe to expose)
    clientSecret?: string      // GitHub OAuth App client secret (server-side only)
  }
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
  pageFavicon: string
  ogImage: string
}

export interface SearchResult {
  path: string
  snippet: string
}

