// Shared utilities for the editor UI

import { generateCommitMessage } from './markdown-text'
export { extractPageMeta, buildMarkdown } from './markdown-text'

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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
  return first ? `/${first}` : '/_'
}

/** Editor URL for a page file path ("guides/x/index.md" → "/_/guides/x"). */
export function editorUrlFor(filePath: string): string {
  const urlPath = filePath.replace(/\/?index\.md$/, '')
  return urlPath ? `${getEditorBase()}/${urlPath}` : getEditorBase()
}

export function getCurrentPagePath(editorPath?: string | null): string | null {
  const base = editorPath ? '/' + editorPath.replace(/^\/+|\/+$/g, '') : getEditorBase()
  const pathname = decodeURIComponent(window.location.pathname)
  if (!pathname.startsWith(base + '/')) return null
  const path = pathname.slice(base.length + 1).replace(/\/+$/, '')
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

export function getCommitMessage(path: string, before: string | undefined, after: string): string {
  return generateCommitMessage(path, before, after)
}
