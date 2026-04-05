// Shared utilities for the editor UI

export function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let _toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(msg: string, type: 'success' | 'error' | 'warning', linkUrl?: string) {
  document.getElementById('od-toast')?.remove()
  if (_toastTimer) clearTimeout(_toastTimer)
  const el = document.createElement('div')
  el.id = 'od-toast'
  el.className = `od-toast ${type}`
  el.innerHTML = `<span>${escapeHtml(msg)}</span>${
    linkUrl ? `<a href="${escapeHtml(linkUrl)}" target="_blank">View →</a>` : ''
  }`
  document.body.appendChild(el)
  _toastTimer = setTimeout(() => el.remove(), 5000)
}

export function extractPageMeta(markdown: string): { title: string; icon: string; body: string } {
  let rest = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart()
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  let icon = ''
  if (fmMatch?.[1]) {
    const iconMatch = fmMatch[1].match(/^icon:\s*(.+)$/m)
    if (iconMatch?.[1]) icon = iconMatch[1].trim()
  }
  const h1Match = rest.match(/^#\s+(.+)\n?/)
  const title = h1Match?.[1] ? h1Match[1].trim() : ''
  const body = h1Match?.[0] ? rest.slice(h1Match[0].length).trimStart() : rest
  return { title, icon, body }
}

export function buildMarkdown(title: string, icon: string, body: string): string {
  let md = ''
  if (icon) md += `---\nicon: ${icon}\n---\n\n`
  if (title) md += `# ${title}\n\n`
  md += body
  return md
}

export function getMcpUrl(): string {
  try {
    const u = new URL(window.location.href)
    u.port = String(parseInt(u.port || "80") + 1)
    u.pathname = "/mcp"
    return u.toString()
  } catch {
    return "http://localhost:3001/mcp"
  }
}

export function getStoredToken() { return localStorage.getItem('github_token') }
export function getStoredRepo() { return localStorage.getItem('github_repo') }

export function getCurrentPagePath(): string | null {
  const pathname = window.location.pathname
  const prefix = '/_/'
  if (!pathname.startsWith(prefix)) return null
  const path = pathname.slice(prefix.length)
  if (!path) return null
  return `${path}/index.md`
}

export interface NavNode {
  title: string; path: string; url: string; icon?: string; children: NavNode[]
}

export function flattenNav(node: NavNode | null): { title: string; filePath: string }[] {
  if (!node) return []
  const p = node.path === '.' ? '' : node.path
  return [
    { title: node.title, filePath: p ? `${p}/index.md` : 'index.md' },
    ...(node.children || []).flatMap(flattenNav),
  ]
}

export interface SiteConfig {
  title?: string
  editorPath?: string
  github?: { repo?: string; branch?: string; clientId?: string }
  theme?: string
}

export const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')

export async function localLoadFile(path: string): Promise<string> {
  const r = await fetch(`/_opendoc/file/${path}`)
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`)
  return r.text()
}

export async function localSaveFile(path: string, content: string): Promise<void> {
  const r = await fetch(`/_opendoc/file/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) throw new Error('Failed to save file')
}

export async function fetchOrder(dir: string): Promise<string[]> {
  const r = await fetch(`/_opendoc/order/${dir}`)
  if (!r.ok) return []
  return r.json()
}

export async function saveOrder(dir: string, order: string[]): Promise<void> {
  const r = await fetch(`/_opendoc/order/${dir}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  })
  if (!r.ok) throw new Error('Failed to save page order')
}

export async function movePageApi(from: string, to: string): Promise<void> {
  const r = await fetch('/_opendoc/move', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  })
  if (!r.ok) throw new Error('Failed to move page')
}

export async function deletePageApi(path: string): Promise<void> {
  const r = await fetch(`/_opendoc/file/${path}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('Failed to delete page')
}

export async function renamePageApi(from: string, to: string): Promise<void> {
  const r = await fetch('/_opendoc/rename', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  })
  if (!r.ok) throw new Error('Failed to rename page')
}

export async function duplicatePageApi(path: string): Promise<string> {
  const r = await fetch('/_opendoc/duplicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!r.ok) throw new Error('Failed to duplicate page')
  const data = await r.json()
  return data.slug as string
}

export async function getCommitMessage(path: string, before: string, after: string): Promise<string> {
  const fallback = `edit(${path}): ${new Date().toISOString()}`
  try {
    const r = await fetch(getMcpUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'generate_commit_message', params: { path, before, after } }),
    })
    if (r.ok) return (await r.json()).message as string
  } catch {}
  return fallback
}
