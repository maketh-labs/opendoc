// Shared utilities for the editor UI

import { generateCommitMessage } from './markdown-text'
import type { NavNode } from '../src/types'

export type { NavNode }
export { extractPageMeta, buildMarkdown } from './markdown-text'

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

let _toastTimer: ReturnType<typeof setTimeout> | null = null

export interface ToastOptions {
  /** External link shown as "View →" */
  linkUrl?: string
  linkText?: string
  /** Inline action button (e.g. Undo); the toast closes when clicked */
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

export function showToast(msg: string, type: 'success' | 'error' | 'warning', options?: string | ToastOptions) {
  const opts: ToastOptions = typeof options === 'string' ? { linkUrl: options } : options ?? {}
  document.getElementById('od-toast')?.remove()
  if (_toastTimer) clearTimeout(_toastTimer)
  const el = document.createElement('div')
  el.id = 'od-toast'
  el.className = `od-toast ${type}`
  el.setAttribute('role', type === 'error' ? 'alert' : 'status')
  const text = document.createElement('span')
  text.textContent = msg
  el.appendChild(text)
  if (opts.linkUrl) {
    const a = document.createElement('a')
    a.href = opts.linkUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = opts.linkText ?? 'View →'
    el.appendChild(a)
  }
  if (opts.action) {
    const { label, onClick } = opts.action
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'od-toast-action'
    btn.textContent = label
    btn.style.cssText = 'margin-left:12px;background:none;border:0;padding:0;font:inherit;font-weight:600;text-decoration:underline;color:inherit;cursor:pointer'
    btn.addEventListener('click', () => {
      el.remove()
      if (_toastTimer) clearTimeout(_toastTimer)
      onClick()
    })
    el.appendChild(btn)
  }
  document.body.appendChild(el)
  _toastTimer = setTimeout(() => el.remove(), opts.durationMs ?? (opts.action ? 8000 : 5000))
}

/** Extract a human-readable error from a failed fetch Response (JSON `{error}` or plain text). */
export async function responseError(res: Response, fallback = 'Request failed'): Promise<string> {
  let body = ''
  try { body = await res.text() } catch {}
  if (body) {
    try {
      const parsed = JSON.parse(body)
      if (parsed && typeof parsed.error === 'string') return parsed.error
    } catch {}
    if (body.length < 300 && !body.trimStart().startsWith('<')) return body.trim()
  }
  return `${fallback} (${res.status})`
}

/** fetch() that throws an Error carrying the server's message on non-2xx responses. */
export async function fetchOk(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (!res.ok) throw new Error(await responseError(res))
  return res
}

export function getStoredToken() { return localStorage.getItem('github_token') }
export function getStoredRepo() { return localStorage.getItem('github_repo') }

// The editor is mounted at config.editorPath (default "/_"). editor.tsx can set it from
// the site config; otherwise it is inferred from the first URL segment.
let editorBase: string | null = null

export function setEditorBase(path: string | null | undefined) {
  if (path) editorBase = '/' + path.replace(/^\/+|\/+$/g, '')
}

export function getEditorBase(): string {
  if (editorBase) return editorBase
  const first = window.location.pathname.split('/').filter(Boolean)[0]
  if (!first) return '/_'
  // "/__" is the settings URL of the "/_" editor
  return `/${first.length > 1 && first.endsWith('_') ? first.slice(0, -1) : first}`
}

/** Site settings URL: the editor path plus "_" ("/_" → "/__"). Keep in sync with src/config.ts. */
export function getSettingsUrl(): string {
  return getEditorBase() + '_'
}

export function isSettingsUrl(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === getSettingsUrl()
}

/** Editor URL for a page file path ("guides/x/index.md" → "/_/guides/x", "index.md" → "/_"). */
export function editorUrlFor(filePath: string): string {
  const urlPath = filePath.replace(/\/?index\.md$/, '')
  return urlPath ? `${getEditorBase()}/${urlPath}` : getEditorBase()
}

/** Page file for the current editor URL: the bare editor path is the home page; null outside the editor. */
export function getCurrentPagePath(editorPath?: string | null): string | null {
  const base = editorPath ? '/' + editorPath.replace(/^\/+|\/+$/g, '') : getEditorBase()
  const pathname = decodeURIComponent(window.location.pathname).replace(/\/+$/, '')
  if (pathname === base) return 'index.md'
  if (!pathname.startsWith(base + '/')) return null
  return `${pathname.slice(base.length + 1)}/index.md`
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
  github?: { repo?: string; branch?: string; clientId?: string; oauthProxy?: string }
  theme?: string
}

/** Local editing mode — matches the hostnames the server's editing API accepts (loopback only). */
export const isLocal = (() => {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.localhost')
})()

export async function localLoadFile(path: string): Promise<string> {
  const r = await fetch(`/_opendoc/file/${encodePath(path)}`)
  if (!r.ok) throw new Error(`Failed to load ${path}: ${await responseError(r)}`)
  return r.text()
}

export async function localSaveFile(path: string, content: string): Promise<void> {
  await fetchOk(`/_opendoc/file/${encodePath(path)}`, jsonInit('PUT', { content }))
}

/** Encode a docs-relative path for use in a URL, segment by segment. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function fetchOrder(dir: string): Promise<string[]> {
  const r = await fetch(`/_opendoc/order/${encodePath(dir)}`)
  if (!r.ok) return []
  const data = await r.json().catch(() => [])
  return Array.isArray(data) ? data : []
}

export async function saveOrder(dir: string, order: string[]): Promise<void> {
  await fetchOk(`/_opendoc/order/${encodePath(dir)}`, jsonInit('PUT', { order }))
}

export async function movePageApi(from: string, to: string): Promise<void> {
  await fetchOk('/_opendoc/move', jsonInit('PUT', { from, to }))
}

/** Delete a page folder. The server moves it to trash; the returned id restores it. */
export async function deletePageApi(path: string): Promise<string | null> {
  const r = await fetchOk(`/_opendoc/file/${encodePath(path)}`, { method: 'DELETE' })
  const data = await r.json().catch(() => ({}))
  return typeof data?.trashId === 'string' ? data.trashId : null
}

/** Restore a deleted page from trash; returns its docs-relative path. */
export async function restorePageApi(trashId: string): Promise<string> {
  const r = await fetchOk('/_opendoc/restore', jsonInit('POST', { trashId }))
  const data = await r.json()
  return data.path as string
}

export async function renamePageApi(from: string, to: string): Promise<void> {
  await fetchOk('/_opendoc/rename', jsonInit('PUT', { from, to }))
}

export async function duplicatePageApi(path: string): Promise<string> {
  const r = await fetchOk('/_opendoc/duplicate', jsonInit('POST', { path }))
  const data = await r.json()
  return data.slug as string
}

// ── Uploads ──────────────────────────────────────────────────────────────────

/** Upload a file into `<pageDir>/assets/`; returns its public URL. */
export async function uploadPageFile(file: File, pageDir: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('pagePath', pageDir || '.')
  const r = await fetchOk('/_opendoc/upload', { method: 'POST', body: form })
  return (await r.json()).url as string
}

/** Upload a site asset (favicon, og-image, manifest, …) of `type` for `pageDir`; returns its URL. */
export async function uploadPageAsset(type: string, file: File, pageDir = '.'): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('pagePath', pageDir || '.')
  form.append('type', type)
  const r = await fetchOk('/_opendoc/page-asset', { method: 'POST', body: form })
  return (await r.json()).url as string
}

export async function deletePageAsset(type: string, pageDir = '.'): Promise<void> {
  await fetchOk('/_opendoc/page-asset', jsonInit('DELETE', { pagePath: pageDir || '.', type }))
}

export function getCommitMessage(path: string, before: string | undefined, after: string): string {
  return generateCommitMessage(path, before, after)
}
