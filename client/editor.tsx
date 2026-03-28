// OpenDoc Editor — React + BlockNote
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { initThemePanel } from './themes'
import { initFaviconPanel } from './favicon'

// ─── Constants ───────────────────────────────────────────────────────────────
const GITHUB_CLIENT_ID = 'PLACEHOLDER_CLIENT_ID'
const OAUTH_CALLBACK_URL = '/oauth/callback'
const MCP_URL = 'http://localhost:3001/mcp'

const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getToken() { return localStorage.getItem('github_token') }
function getRepo()  { return localStorage.getItem('github_repo') }

function getCurrentPagePath() {
  return new URLSearchParams(window.location.search).get('path') || 'index.md'
}

interface NavNode { title: string; path: string; url: string; icon?: string; children: NavNode[] }
function flattenNav(node: NavNode | null): { title: string; filePath: string }[] {
  if (!node) return []
  const result: { title: string; filePath: string }[] = []
  const p = node.path === '.' ? '' : node.path
  result.push({ title: node.title, filePath: p ? `${p}/index.md` : 'index.md' })
  for (const child of node.children || []) result.push(...flattenNav(child))
  return result
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'success' | 'error' | 'warning', linkUrl?: string) {
  document.getElementById('od-toast')?.remove()
  if (toastTimer) clearTimeout(toastTimer)
  const el = document.createElement('div')
  el.id = 'od-toast'
  el.className = `od-toast ${type}`
  el.innerHTML = `<span>${escapeHtml(msg)}</span>${linkUrl ? `<a href="${escapeHtml(linkUrl)}" target="_blank">View →</a>` : ''}`
  document.body.appendChild(el)
  toastTimer = setTimeout(() => el.remove(), 5000)
}

// ─── Local API ────────────────────────────────────────────────────────────────
async function localLoadFile(path: string) {
  const r = await fetch(`/_opendoc/file?path=${encodeURIComponent(path)}`)
  if (!r.ok) throw new Error(`Failed to load ${path}`)
  return r.text()
}
async function localSaveFile(path: string, content: string) {
  const r = await fetch(`/_opendoc/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) throw new Error('Failed to save')
}

// ─── GitHub API ───────────────────────────────────────────────────────────────
async function checkRepoAccess(repo: string, token: string): Promise<'write' | 'read' | 'none'> {
  const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) return 'none'
  const d = await r.json()
  return d.permissions?.push ? 'write' : 'read'
}

async function getGitHubUsername(token: string) {
  const r = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error('Failed to get user')
  return (await r.json()).login as string
}

async function fetchUserRepos(token: string): Promise<{ full_name: string }[]> {
  const r = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error('Failed to fetch repos')
  return r.json()
}

async function loadPageContent(pagePath: string) {
  try {
    const r = await fetch(`/dist/${pagePath.endsWith('.md') ? pagePath : `${pagePath}/index.md`}`)
    if (r.ok) return r.text()
  } catch {}
  return '# New Page\n\nStart writing here...'
}

async function getCommitMessage(path: string, before: string, after: string) {
  try {
    const r = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'generate_commit_message', params: { path, before, after } }),
    })
    if (r.ok) return (await r.json()).message
  } catch {}
  return `edit(${path}): ${new Date().toISOString()}`
}

// ─── SiteConfig ───────────────────────────────────────────────────────────────
interface SiteConfig { title?: string; editorPath?: string; github?: { repo?: string; branch?: string }; theme?: string }
let siteConfig: SiteConfig = {}

// ─── Theme toggle SVG ────────────────────────────────────────────────────────
const ThemeSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a7 7 0 0 0 0 20 10 10 0 0 1 0-20z"/>
  </svg>
)

// ─── BlockNote Editor Component ───────────────────────────────────────────────
interface EditorProps {
  initialMarkdown: string
  pagePath: string
  onContentChange: (md: string) => void
  theme?: 'light' | 'dark'
}

function BlockEditor({ initialMarkdown, pagePath, onContentChange, theme }: EditorProps) {
  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pagePath', pagePath.replace(/\/[^/]+$/, '') || '.')
      const r = await fetch('/_opendoc/upload', { method: 'POST', body: formData })
      if (!r.ok) throw new Error('Upload failed')
      const { url } = await r.json()
      return url
    },
  })

  // Load initial markdown
  useEffect(() => {
    async function load() {
      const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown)
      editor.replaceBlocks(editor.document, blocks)
    }
    load()
  }, [initialMarkdown])

  // Track changes
  const handleChange = useCallback(() => {
    const md = editor.blocksToMarkdownLossy(editor.document)
    onContentChange(md)
  }, [editor, onContentChange])

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      onChange={handleChange}
    />
  )
}

// ─── Local Editor ─────────────────────────────────────────────────────────────
function LocalEditor() {
  const [pages, setPages] = useState<{ title: string; filePath: string }[]>([])
  const [currentFile, setCurrentFile] = useState(getCurrentPagePath())
  const [markdown, setMarkdown] = useState('')
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [gitStatus, setGitStatus] = useState<{ changes: number; branch?: string; remote?: string; isRepo?: boolean } | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [rightOpen, setRightOpen] = useState(false)
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light')
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const themePanelInitRef = useRef(false)

  // Load nav
  useEffect(() => {
    fetch('/_opendoc/nav.json').then(r => r.json()).then(nav => {
      const flat = flattenNav(nav)
      setPages(flat)
      if (!flat.find(p => p.filePath === currentFile) && flat.length > 0) {
        setCurrentFile(flat[0]!.filePath)
      }
    }).catch(() => {})
  }, [])

  // Load file when currentFile changes
  useEffect(() => {
    localLoadFile(currentFile).then(text => {
      setMarkdown(text)
      setContent(text)
      setOriginalContent(text)
    }).catch(() => {
      const blank = '# New Page\n\nStart writing here...'
      setMarkdown(blank)
      setContent(blank)
      setOriginalContent(blank)
    })
  }, [currentFile])

  // Git status
  const updateGitStatus = useCallback(async () => {
    try {
      const r = await fetch('/_opendoc/git-status')
      setGitStatus(await r.json())
    } catch {}
  }, [])

  useEffect(() => { updateGitStatus() }, [])

  // Dark mode detection
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setEditorTheme(mq.matches ? 'dark' : 'light')
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Init theme panel once right panel opens
  useEffect(() => {
    if (rightOpen && rightPanelRef.current && !themePanelInitRef.current) {
      themePanelInitRef.current = true
      initThemePanel()
      initFaviconPanel()
    }
  }, [rightOpen])

  // Keyboard save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [content, currentFile])

  async function handleSave() {
    setSaving(true)
    try {
      await localSaveFile(currentFile, content)
      setOriginalContent(content)
      showToast('Saved', 'success')
      updateGitStatus()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCommit() {
    setCommitting(true)
    const token = localStorage.getItem('github_token') || undefined
    try {
      const r = await fetch('/_opendoc/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMsg.trim() || undefined, token }),
      })
      const result = await r.json()
      if (result.ok) {
        showToast(result.pushed ? `✓ Committed & pushed (${result.hash})` : `✓ Committed locally (${result.hash})`, result.pushed ? 'success' : 'warning')
        setCommitMsg('')
        updateGitStatus()
      } else {
        showToast(`✗ ${result.error}`, 'error')
      }
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setCommitting(false)
    }
  }

  function switchPage(filePath: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('path', filePath)
    window.history.pushState({}, '', url.toString())
    setCurrentFile(filePath)
  }

  const isDirty = content !== originalContent
  const gitDirty = gitStatus && gitStatus.isRepo && gitStatus.changes > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="editor-header">
        <span className="logo">OpenDoc Editor</span>
        <span className="page-path" style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Local</span>
        {pages.length > 0 && (
          <select
            value={currentFile}
            onChange={e => switchPage(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8rem' }}
          >
            {pages.map(p => <option key={p.filePath} value={p.filePath}>{p.title}</option>)}
          </select>
        )}
        <span className="spacer" />
        {gitStatus?.isRepo && (
          <span className={`od-git-status ${gitDirty ? 'od-git-dirty' : 'od-git-clean'}`} title={gitStatus.branch ? `Branch: ${gitStatus.branch}` : undefined}>
            {gitDirty ? `${gitStatus.changes} changed` : '✓ up to date'}
          </span>
        )}
        <button className="od-save-primary" onClick={handleSave} disabled={saving} style={{ borderRadius: 'var(--border-radius)' }}>
          {saving ? <><span className="od-spinner" />Saving…</> : isDirty ? 'Save *' : 'Save'}
        </button>
        {gitStatus?.isRepo && (
          <div className="od-commit-group">
            <input
              type="text"
              className="od-commit-msg"
              placeholder="Commit message"
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleCommit} disabled={committing}>
              {committing ? 'Committing…' : 'Commit & Push'}
            </button>
          </div>
        )}
        <button className="od-toggle-themes" onClick={() => setRightOpen(o => !o)} title="Toggle themes">
          <ThemeSvg />
        </button>
      </div>

      {/* Body */}
      <div className="od-editor-body">
        <div className="od-wysiwyg-wrap">
          {markdown !== '' && (
            <BlockEditor
              key={currentFile}
              initialMarkdown={markdown}
              pagePath={currentFile}
              onContentChange={setContent}
              theme={editorTheme}
            />
          )}
        </div>
        <aside ref={rightPanelRef} className={`od-editor-right${rightOpen ? ' open' : ''}`} id="editor-right-panel">
          <ThemePanelHTML />
        </aside>
      </div>
    </div>
  )
}

// ─── GitHub Editor ────────────────────────────────────────────────────────────
interface GitHubEditorProps { token: string; repo: string }

function GitHubEditor({ token, repo }: GitHubEditorProps) {
  const pagePath = getCurrentPagePath()
  const [markdown, setMarkdown] = useState('')
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [repoAccess, setRepoAccess] = useState<'write' | 'read' | 'none'>('none')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light')
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const themePanelInitRef = useRef(false)

  useEffect(() => {
    checkRepoAccess(repo, token).then(setRepoAccess)
    loadPageContent(pagePath).then(md => { setMarkdown(md); setContent(md); setOriginalContent(md) })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setEditorTheme(mq.matches ? 'dark' : 'light')
    update(); mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (rightOpen && rightPanelRef.current && !themePanelInitRef.current) {
      themePanelInitRef.current = true
      initThemePanel(); initFaviconPanel()
    }
  }, [rightOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(false) } }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [content])

  async function commitDirectly(forcePR: boolean) {
    const path = pagePath
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers: { Authorization: `Bearer ${token}` } })
    let sha: string | undefined
    if (r.ok) sha = (await r.json()).sha

    const message = await getCommitMessage(path, originalContent, content)
    const branch = siteConfig.github?.branch || 'main'
    const body: Record<string, unknown> = { message, content: btoa(unescape(encodeURIComponent(content))), branch }
    if (sha) body.sha = sha

    const put = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!put.ok) throw new Error((await put.json()).message || 'Failed to save')
    return { url: (await put.json()).commit?.html_url }
  }

  async function openPullRequest() {
    const username = await getGitHubUsername(token)
    const [, repoName] = repo.split('/')
    await fetch(`https://api.github.com/repos/${repo}/forks`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const forkRepo = `${username}/${repoName}`
    let ready = false
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000))
      if ((await fetch(`https://api.github.com/repos/${forkRepo}`, { headers: { Authorization: `Bearer ${token}` } })).ok) { ready = true; break }
    }
    if (!ready) throw new Error('Fork not ready')
    const baseBranch = siteConfig.github?.branch || 'main'
    const branch = `opendoc-edit-${Date.now()}`
    const refRes = await fetch(`https://api.github.com/repos/${forkRepo}/git/ref/heads/${baseBranch}`, { headers: { Authorization: `Bearer ${token}` } })
    const { object: { sha: branchSha } } = await refRes.json()
    await fetch(`https://api.github.com/repos/${forkRepo}/git/refs`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: branchSha }),
    })
    const fileRes = await fetch(`https://api.github.com/repos/${forkRepo}/contents/${pagePath}?ref=${branch}`, { headers: { Authorization: `Bearer ${token}` } })
    const sha = fileRes.ok ? (await fileRes.json()).sha : undefined
    const message = await getCommitMessage(pagePath, originalContent, content)
    const commitBody: Record<string, unknown> = { message, content: btoa(unescape(encodeURIComponent(content))), branch }
    if (sha) commitBody.sha = sha
    await fetch(`https://api.github.com/repos/${forkRepo}/contents/${pagePath}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commitBody),
    })
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: message, head: `${username}:${branch}`, base: baseBranch, body: '_Opened via [OpenDoc](https://opendoc.sh) editor_' }),
    })
    if (!prRes.ok) throw new Error((await prRes.json()).message || 'Failed to create PR')
    return { url: (await prRes.json()).html_url }
  }

  async function save(forcePR: boolean) {
    setSaving(true); setShowDropdown(false)
    try {
      const result = repoAccess === 'write' && !forcePR ? await commitDirectly(false) : await openPullRequest()
      setOriginalContent(content)
      showToast(repoAccess === 'write' && !forcePR ? 'Saved' : 'Pull request opened', 'success', result.url)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const isWrite = repoAccess === 'write'
  const saveLabel = isWrite ? 'Save' : 'Suggest Edit'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header">
        <span className="logo">OpenDoc Editor</span>
        <span className="repo-name">{repo}</span>
        <span className="page-path">{pagePath}</span>
        <span className="spacer" />
        <div className="od-save-btn-group">
          <button className="od-save-primary" onClick={() => save(false)} disabled={saving}>
            {saving ? <><span className="od-spinner" />Saving…</> : saveLabel}
          </button>
          {isWrite && <>
            <button className="od-save-dropdown-trigger" onClick={() => setShowDropdown(d => !d)}>
              <svg viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {showDropdown && (
              <div className="od-save-dropdown">
                <button className="od-save-option" onClick={() => save(true)}>Open Pull Request</button>
              </div>
            )}
          </>}
        </div>
        <button className="btn" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Change Repo</button>
        <button className="btn" onClick={() => { localStorage.removeItem('github_token'); localStorage.removeItem('github_repo'); window.location.reload() }}>Logout</button>
        <button className="od-toggle-themes" onClick={() => setRightOpen(o => !o)} title="Themes"><ThemeSvg /></button>
      </div>
      <div className="od-editor-body">
        <div className="od-wysiwyg-wrap">
          {markdown !== '' && (
            <BlockEditor
              key={pagePath}
              initialMarkdown={markdown}
              pagePath={pagePath}
              onContentChange={setContent}
              theme={editorTheme}
            />
          )}
        </div>
        <aside ref={rightPanelRef} className={`od-editor-right${rightOpen ? ' open' : ''}`} id="editor-right-panel">
          <ThemePanelHTML />
        </aside>
      </div>
    </div>
  )
}

// ─── Theme Panel (static HTML rendered as React component) ───────────────────
function ThemePanelHTML() {
  return (
    <div className="od-theme-panel" dangerouslySetInnerHTML={{ __html: `
      <div class="od-theme-panel-header">
        <h3>Themes</h3>
        <button class="od-close-btn" id="close-right">&times;</button>
      </div>
      <div class="od-theme-search">
        <input type="search" placeholder="Search themes..." id="theme-search-input">
      </div>
      <div class="od-theme-grid" id="theme-grid"></div>
      <div class="od-theme-actions" id="theme-actions" style="display:none">
        <button class="od-btn od-btn-secondary" id="theme-cancel">Cancel</button>
        <button class="od-btn od-btn-primary" id="theme-save">Save</button>
      </div>
      <details class="od-css-customizer">
        <summary>Customize CSS</summary>
        <div class="od-css-editor-wrap">
          <div class="od-css-tabs" id="css-tabs" style="display:none">
            <button class="od-css-tab active" id="css-tab-light">Light</button>
            <button class="od-css-tab" id="css-tab-dark">Dark</button>
          </div>
          <textarea class="od-css-editor" id="css-editor" spellcheck="false">/* Loading... */</textarea>
          <div class="od-css-editor-actions">
            <button class="od-btn od-btn-ghost" id="css-reset">Reset</button>
            <button class="od-btn od-btn-ghost" id="css-copy">Copy</button>
            <button class="od-btn od-btn-primary" id="css-save">Save</button>
          </div>
        </div>
      </details>
      <details class="od-favicon-panel">
        <summary>Favicon</summary>
        <div class="od-favicon-content">
          <div class="od-favicon-drop" id="favicon-drop">
            <input type="file" id="favicon-upload" accept="image/png,image/svg+xml" hidden>
            <div class="od-favicon-drop-inner" id="favicon-drop-inner">
              <p>Drop a 512x512 PNG or SVG</p>
              <button class="od-btn od-btn-secondary" id="favicon-browse">Browse</button>
            </div>
          </div>
          <div class="od-favicon-preview" id="favicon-preview" style="display:none">
            <img id="favicon-preview-img" alt="favicon preview">
            <div class="od-favicon-sizes">
              <canvas id="preview-16" width="16" height="16"></canvas>
              <canvas id="preview-32" width="32" height="32"></canvas>
              <canvas id="preview-180" width="180" height="180"></canvas>
            </div>
          </div>
          <div class="od-favicon-tags" id="favicon-tags" style="display:none">
            <label>HTML tags</label>
            <textarea class="od-css-editor" id="favicon-tags-output" readonly></textarea>
            <div class="od-css-editor-actions">
              <button class="od-btn od-btn-ghost" id="favicon-copy-tags">Copy tags</button>
              <button class="od-btn od-btn-primary" id="favicon-download-all">Download all</button>
            </div>
          </div>
        </div>
      </details>
    ` }} />
  )
}

// ─── Login / Repo Picker ──────────────────────────────────────────────────────
function LoginScreen() {
  function login() {
    const redirectUri = encodeURIComponent(window.location.origin + '/editor')
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo`
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header"><span className="logo">OpenDoc Editor</span></div>
      <div className="login-screen">
        <div className="login-box">
          <h1>OpenDoc Editor</h1>
          <p>Sign in with GitHub to edit documentation.</p>
          <button className="btn btn-primary" onClick={login}>Login to Save</button>
        </div>
      </div>
    </div>
  )
}

function RepoPicker({ repos }: { repos: { full_name: string }[] }) {
  const [selected, setSelected] = useState('')
  const [input, setInput] = useState('')
  function go() {
    const repo = input.trim() || selected
    if (repo) { localStorage.setItem('github_repo', repo); window.location.reload() }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header">
        <span className="logo">OpenDoc Editor</span>
        <span className="spacer" />
        <button className="btn" onClick={() => { localStorage.removeItem('github_token'); window.location.reload() }}>Logout</button>
      </div>
      <div className="repo-picker">
        <div className="repo-picker-box">
          <h2>Select a repository</h2>
          <select value={selected} onChange={e => { setSelected(e.target.value); setInput(e.target.value) }}>
            <option value="">Choose a repo...</option>
            {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
          <div className="or-divider">or type a repo name</div>
          <input type="text" placeholder="owner/repo" value={input} onChange={e => setInput(e.target.value)} />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={go}>Open</button>
        </div>
      </div>
    </div>
  )
}

function NoAccess({ repo }: { repo: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header">
        <span className="logo">OpenDoc Editor</span>
        <span className="spacer" />
        <button className="btn" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Change Repo</button>
        <button className="btn" onClick={() => { localStorage.removeItem('github_token'); localStorage.removeItem('github_repo'); window.location.reload() }}>Logout</button>
      </div>
      <div className="login-screen">
        <div className="login-box">
          <h1>No Access</h1>
          <p>You don't have access to <strong>{repo}</strong>.</p>
          <button className="btn btn-primary" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Choose Another Repo</button>
        </div>
      </div>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
type AppState =
  | { view: 'loading' }
  | { view: 'local' }
  | { view: 'login' }
  | { view: 'repoPicker'; repos: { full_name: string }[] }
  | { view: 'editor'; token: string; repo: string }
  | { view: 'noAccess'; repo: string }

function App() {
  const [state, setState] = useState<AppState>({ view: 'loading' })

  useEffect(() => {
    async function init() {
      if (isLocal) { setState({ view: 'local' }); return }

      // OAuth callback
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const r = await fetch(`${OAUTH_CALLBACK_URL}?code=${code}`)
        const data = await r.json()
        if (data.access_token) localStorage.setItem('github_token', data.access_token)
        window.history.replaceState({}, '', '/editor')
        window.location.reload()
        return
      }

      // Check for token in hash (redirect back from OAuth)
      if (window.location.hash.startsWith('#github_token=')) {
        const t = window.location.hash.slice('#github_token='.length)
        if (t) localStorage.setItem('github_token', t)
        window.history.replaceState({}, '', window.location.pathname + window.location.search)
      }

      // Load site config
      try {
        const r = await fetch('/_opendoc/config.json')
        if (r.ok) {
          siteConfig = await r.json()
          if (siteConfig.github?.repo && !getRepo()) localStorage.setItem('github_repo', siteConfig.github.repo)
        }
      } catch {}

      const token = getToken()
      if (!token) { setState({ view: 'login' }); return }

      const repo = getRepo()
      if (!repo) {
        try {
          const repos = await fetchUserRepos(token)
          setState({ view: 'repoPicker', repos })
        } catch {
          localStorage.removeItem('github_token')
          setState({ view: 'login' })
        }
        return
      }

      const access = await checkRepoAccess(repo, token)
      if (access === 'none') { setState({ view: 'noAccess', repo }); return }
      setState({ view: 'editor', token, repo })
    }
    init()
  }, [])

  if (state.view === 'loading') return <div className="login-screen"><div style={{ color: 'var(--color-muted)' }}>Loading…</div></div>
  if (state.view === 'local') return <LocalEditor />
  if (state.view === 'login') return <LoginScreen />
  if (state.view === 'repoPicker') return <RepoPicker repos={state.repos} />
  if (state.view === 'noAccess') return <NoAccess repo={state.repo} />
  if (state.view === 'editor') return <GitHubEditor token={state.token} repo={state.repo} />
  return null
}

// ─── Mount ────────────────────────────────────────────────────────────────────
const root = document.getElementById('app')!
createRoot(root).render(<App />)
