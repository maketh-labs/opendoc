// OpenDoc Editor — React + BlockNote
import React, {
  useState, useEffect, useCallback, useRef, useContext,
  createContext, memo,
} from 'react'
import { createRoot } from 'react-dom/client'
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import type { Block } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { initThemePanel } from './themes'
import { initFaviconPanel } from './favicon'
import { markdownToBlocks, blocksToMarkdown } from './markdown'
import { createReactBlockSpec } from '@blocknote/react'
import { CalloutBlock, CALLOUT_TYPES, type CalloutType } from './callout-block'
import { BookmarkBlock, bookmarkBlockConfig } from './bookmark-block'
import {
  checkRepoAccess, fetchUserRepos, fetchFileFromGitHub,
  commitFile, openPullRequest,
  type RepoAccess, type CommitResult,
} from './github-api'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SiteConfig {
  title?: string
  editorPath?: string
  github?: { repo?: string; branch?: string; clientId?: string }
  theme?: string
}

interface NavNode {
  title: string; path: string; url: string; icon?: string; children: NavNode[]
}

// ─── Constants ───────────────────────────────────────────────────────────────
function getMcpUrl(): string {
  try {
    const u = new URL(window.location.href)
    u.port = String(parseInt(u.port || "80") + 1)
    u.pathname = "/mcp"
    return u.toString()
  } catch {
    return "http://localhost:3001/mcp"
  }
}

const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')

// ─── Site Config Context ──────────────────────────────────────────────────────
const SiteConfigContext = createContext<SiteConfig>({})
const useSiteConfig = () => useContext(SiteConfigContext)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function extractPageMeta(markdown: string): { title: string; icon: string; body: string } {
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

function buildMarkdown(title: string, icon: string, body: string): string {
  let md = ''
  if (icon) md += `---\nicon: ${icon}\n---\n\n`
  if (title) md += `# ${title}\n\n`
  md += body
  return md
}

// ─── Page Header ─────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  icon: string
  onTitleChange: (t: string) => void
  onIconChange: (i: string) => void
}

function PageHeader({ title, icon, onTitleChange, onIconChange }: PageHeaderProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [title])

  return (
    <div className="od-page-header">
      {icon && (
        <button className="od-page-icon" onClick={() => {
          const newIcon = prompt('Enter emoji icon:', icon)
          if (newIcon !== null) onIconChange(newIcon.trim())
        }}>
          {icon}
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="od-page-title"
        value={title}
        placeholder="Untitled"
        onChange={e => onTitleChange(e.target.value)}
        rows={1}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault() }
        }}
      />
    </div>
  )
}

function getStoredToken() { return localStorage.getItem('github_token') }
function getStoredRepo()  { return localStorage.getItem('github_repo') }

function getCurrentPagePath() {
  return new URLSearchParams(window.location.search).get('path') || 'index.md'
}

function flattenNav(node: NavNode | null): { title: string; filePath: string }[] {
  if (!node) return []
  const p = node.path === '.' ? '' : node.path
  return [
    { title: node.title, filePath: p ? `${p}/index.md` : 'index.md' },
    ...(node.children || []).flatMap(flattenNav),
  ]
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string, type: 'success' | 'error' | 'warning', linkUrl?: string) {
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

// ─── Local API ────────────────────────────────────────────────────────────────
async function localLoadFile(path: string): Promise<string> {
  const r = await fetch(`/_opendoc/file?path=${encodeURIComponent(path)}`)
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`)
  return r.text()
}

async function localSaveFile(path: string, content: string): Promise<void> {
  const r = await fetch(`/_opendoc/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) throw new Error('Failed to save file')
}

async function getCommitMessage(path: string, before: string, after: string): Promise<string> {
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

// ─── Custom Hooks ─────────────────────────────────────────────────────────────
interface GitStatus {
  isRepo: boolean
  branch?: string
  remote?: string
  changes: number
}

function useGitStatus() {
  const [status, setStatus] = useState<GitStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/_opendoc/git-status')
      if (r.ok) setStatus(await r.json())
    } catch {}
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { status, refresh }
}

function useDarkMode(): 'light' | 'dark' {
  const mqRef = useRef<MediaQueryList | null>(null)
  if (!mqRef.current) mqRef.current = window.matchMedia('(prefers-color-scheme: dark)')
  const mq = mqRef.current

  const [theme, setTheme] = useState<'light' | 'dark'>(mq.matches ? 'dark' : 'light')

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mq])

  return theme
}

function useKeyboardSave(onSave: () => void) {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave  // always current, no stale closure

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSaveRef.current()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])  // register once, always calls current onSave via ref
}

// ─── Theme Panel ──────────────────────────────────────────────────────────────
// memo'd so it never re-renders — keeps vanilla-JS listeners alive
const ThemePanel = memo(function ThemePanel({ onClose }: { onClose: () => void }) {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initThemePanel()
    initFaviconPanel()
  }, [])

  return (
    <div className="od-theme-panel">
      <div className="od-theme-panel-header">
        <h3>Themes</h3>
        <button className="od-close-btn" id="close-right" onClick={onClose}>&times;</button>
      </div>
      <div className="od-theme-search">
        <input type="search" placeholder="Search themes..." id="theme-search-input" />
      </div>
      <div className="od-theme-grid" id="theme-grid" />
      <div className="od-theme-actions" id="theme-actions" style={{ display: 'none' }}>
        <button className="od-btn od-btn-secondary" id="theme-cancel">Cancel</button>
        <button className="od-btn od-btn-primary" id="theme-save">Save</button>
      </div>
      <details className="od-css-customizer">
        <summary>Customize CSS</summary>
        <div className="od-css-editor-wrap">
          <div className="od-css-tabs" id="css-tabs" style={{ display: 'none' }}>
            <button className="od-css-tab active" id="css-tab-light">Light</button>
            <button className="od-css-tab" id="css-tab-dark">Dark</button>
          </div>
          <textarea className="od-css-editor" id="css-editor" spellCheck={false}>{'/* Loading... */'}</textarea>
          <div className="od-css-editor-actions">
            <button className="od-btn od-btn-ghost" id="css-reset">Reset</button>
            <button className="od-btn od-btn-ghost" id="css-copy">Copy</button>
            <button className="od-btn od-btn-primary" id="css-save">Save</button>
          </div>
        </div>
      </details>
      <details className="od-favicon-panel">
        <summary>Favicon</summary>
        <div className="od-favicon-content">
          <div className="od-favicon-drop" id="favicon-drop">
            <input type="file" id="favicon-upload" accept="image/png,image/svg+xml" hidden />
            <div className="od-favicon-drop-inner" id="favicon-drop-inner">
              <p>Drop a 512×512 PNG or SVG</p>
              <button className="od-btn od-btn-secondary" id="favicon-browse">Browse</button>
            </div>
          </div>
          <div className="od-favicon-preview" id="favicon-preview" style={{ display: 'none' }}>
            <img id="favicon-preview-img" alt="favicon preview" />
            <div className="od-favicon-sizes">
              <canvas id="preview-16" width="16" height="16" />
              <canvas id="preview-32" width="32" height="32" />
              <canvas id="preview-180" width="180" height="180" />
            </div>
          </div>
          <div className="od-favicon-tags" id="favicon-tags" style={{ display: 'none' }}>
            <label>HTML tags</label>
            <textarea className="od-css-editor" id="favicon-tags-output" readOnly />
            <div className="od-css-editor-actions">
              <button className="od-btn od-btn-ghost" id="favicon-copy-tags">Copy tags</button>
              <button className="od-btn od-btn-primary" id="favicon-download-all">Download all</button>
            </div>
          </div>
        </div>
      </details>
    </div>
  )
})

// ─── YouTube / Embed Block ──────────────────────────────────────────────────

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
      let id = u.searchParams.get("v")
      if (!id) id = u.pathname.replace(/^\//, "").split("?")[0] ?? null
      if (id) return `https://www.youtube.com/embed/${id}?rel=0`
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0]
      if (id) return `https://player.vimeo.com/video/${id}`
    }
    if (u.hostname.includes("loom.com")) {
      const id = u.pathname.replace(/\/share\//, "").split("/")[0]
      if (id) return `https://www.loom.com/embed/${id}`
    }
    return null
  } catch {
    return null
  }
}

const YoutubeBlock = createReactBlockSpec(
    {
      type: "youtube" as const,
      propSchema: {
        url: { default: "" },
        caption: { default: "" },
      },
      content: "none",
    },
    {
      render: ({ block }) => {
        const embedUrl = getEmbedUrl(block.props.url)
        if (!embedUrl) {
          return (
            <div style={{ padding: "8px 12px", background: "var(--bn-colors-editor-background)", border: "1px solid var(--bn-colors-editor-border)", borderRadius: 6, color: "var(--bn-colors-editor-text)", fontSize: 14 }}>
              Could not embed: {block.props.url}
            </div>
          )
        }
        return (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", background: "#000" }}>
              <iframe
                src={embedUrl}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                frameBorder="0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title="Embedded video"
              />
            </div>
            {block.props.caption && (
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--bn-colors-editor-text)", opacity: 0.6 }}>
                {block.props.caption}
              </div>
            )}
          </div>
        )
      },
    }
  )

// ─── Custom Schema ───────────────────────────────────────────────────────────
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: CalloutBlock(),
    bookmark: BookmarkBlock(),
    youtube: YoutubeBlock(),
  },
})

// ─── BlockNote Editor ─────────────────────────────────────────────────────────
interface BlockEditorProps {
  initialBlocks: Block[]
  pagePath: string
  onContentChange: (md: string) => void
  theme: 'light' | 'dark'
  pageHeader?: React.ReactNode
}

// key={currentFile} in parent forces full remount on page switch
// initialBlocks are resolved *before* this mounts — no flash, no race condition
function BlockEditor({ initialBlocks, pagePath, onContentChange, theme, pageHeader }: BlockEditorProps) {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    form.append('pagePath', pagePath.replace(/\/[^/]+$/, '') || '.')
    const r = await fetch('/_opendoc/upload', { method: 'POST', body: form })
    if (!r.ok) throw new Error('Upload failed')
    return (await r.json()).url as string
  }, [pagePath])

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks as any,
    uploadFile,
  })

  // Paste handler: image files from clipboard + bare URL → bookmark
  useEffect(() => {
    const container = document.querySelector(".bn-editor")
    if (!container) return

    const handlePaste = async (e: ClipboardEvent) => {
      // Handle image/video files from clipboard (screenshots, copied media)
      const mediaFiles = Array.from(e.clipboardData?.files || []).filter(f =>
        f.type.startsWith("image/") || f.type.startsWith("video/")
      )
      if (mediaFiles.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        const pos = editor.getTextCursorPosition()
        for (const file of mediaFiles) {
          try {
            const url = await uploadFile(file)
            const blockType = file.type.startsWith("video/") ? "video" : "image"
            editor.insertBlocks(
              [{ type: blockType as any, props: { url, name: file.name, caption: "" } }],
              pos.block,
              "before"
            )
          } catch (err) {
            console.error("Media upload failed:", err)
          }
        }
        return
      }

      // Handle bare URL paste → embed or bookmark card
      const text = e.clipboardData?.getData("text/plain")?.trim() || ""
      if (/^https?:\/\/[^\s]+$/.test(text)) {
        e.preventDefault()
        e.stopPropagation()
        const pos = editor.getTextCursorPosition()
        const embedUrl = getEmbedUrl(text)
        if (embedUrl) {
          editor.insertBlocks(
            [{ type: "youtube" as const, props: { url: text, caption: "" } }],
            pos.block,
            "before"
          )
        } else {
          editor.insertBlocks(
            [{ type: "bookmark" as const, props: { url: text, title: "", description: "", favicon: "", domain: "", imageUrl: "" } } as any],
            pos.block,
            "before"
          )
        }
      }
    }

    container.addEventListener("paste", handlePaste as unknown as EventListener)
    return () => container.removeEventListener("paste", handlePaste as unknown as EventListener)
  }, [editor, uploadFile])

  // Drag & drop image files onto editor
  useEffect(() => {
    const wrapper = editorWrapperRef.current
    if (!wrapper) return

    const handleDragOver = (e: DragEvent) => {
      const hasFiles = Array.from(e.dataTransfer?.items || []).some(
        item => item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))
      )
      if (hasFiles) {
        e.preventDefault()
        e.dataTransfer!.dropEffect = "copy"
        wrapper.classList.add("od-drag-over")
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      if (!wrapper.contains(e.relatedTarget as Node)) {
        wrapper.classList.remove("od-drag-over")
      }
    }

    const handleDrop = async (e: DragEvent) => {
      wrapper.classList.remove("od-drag-over")
      const mediaFiles = Array.from(e.dataTransfer?.files || []).filter(f =>
        f.type.startsWith("image/") || f.type.startsWith("video/")
      )
      if (mediaFiles.length === 0) return
      e.preventDefault()
      e.stopPropagation()

      const pos = editor.getTextCursorPosition()
      for (const file of mediaFiles) {
        try {
          const url = await uploadFile(file)
          const blockType = file.type.startsWith("video/") ? "video" : "image"
          editor.insertBlocks(
            [{ type: blockType as any, props: { url, name: file.name, caption: "" } }],
            pos.block,
            "before"
          )
        } catch (err) {
          console.error("Media drop upload failed:", err)
        }
      }
    }

    wrapper.addEventListener("dragover", handleDragOver)
    wrapper.addEventListener("dragleave", handleDragLeave)
    wrapper.addEventListener("drop", handleDrop)

    return () => {
      wrapper.removeEventListener("dragover", handleDragOver)
      wrapper.removeEventListener("dragleave", handleDragLeave)
      wrapper.removeEventListener("drop", handleDrop)
    }
  }, [editor, uploadFile])

  const handleChange = useCallback(() => {
    onContentChange(blocksToMarkdown(editor.document as any[]))
  }, [editor, onContentChange])

  const getSlashMenuItems = useCallback(async (query: string) => {
    const defaults = getDefaultReactSlashMenuItems(editor)
    const calloutItems = Object.entries(CALLOUT_TYPES).map(([key, { icon, label }]) => ({
      title: label,
      subtext: `${label} callout`,
      aliases: [key, "callout", "alert"],
      group: "Callouts",
      icon: <span style={{ fontSize: 16 }}>{icon}</span>,
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: "callout" as const, props: { calloutType: key as CalloutType } } as any],
          editor.getTextCursorPosition().block,
          "before"
        )
      },
    }))
    const bookmarkItem = {
      title: "Bookmark",
      subtext: "Embed a link preview card",
      aliases: ["bookmark", "link", "embed", "url", "preview"],
      group: "Media",
      icon: <span style={{ fontSize: 16 }}>🔗</span>,
      onItemClick: () => {
        const url = prompt("Paste a URL to bookmark:")
        if (!url || !/^https?:\/\//.test(url)) return
        const pos = editor.getTextCursorPosition()
        editor.insertBlocks(
          [{ type: "bookmark" as const, props: { url, title: "", description: "", favicon: "", domain: "", imageUrl: "" } } as any],
          pos.block,
          "before"
        )
      },
    }
    const youtubeItem = {
      title: "YouTube / Embed",
      subtext: "Embed a YouTube, Vimeo, or Loom video",
      onItemClick: () => {
        const url = window.prompt("Paste a YouTube, Vimeo, or Loom URL:")
        if (!url) return
        const pos = editor.getTextCursorPosition()
        editor.insertBlocks(
          [{ type: "youtube" as const, props: { url, caption: "" } }],
          pos.block,
          "before"
        )
      },
      aliases: ["youtube", "vimeo", "loom", "embed", "video url"],
      group: "Media",
      icon: <span style={{ fontSize: 18 }}>&#9654;&#65039;</span>,
    }
    return filterSuggestionItems([...defaults, ...calloutItems, bookmarkItem, youtubeItem], query)
  }, [editor])

  return (
    <div className="od-editor-content" ref={editorWrapperRef}>
      {pageHeader}
      <BlockNoteView editor={editor} theme={theme} onChange={handleChange} slashMenu={false}>
        <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />
      </BlockNoteView>
    </div>
  )
}

// ─── Editor Layout Shell ──────────────────────────────────────────────────────
interface EditorShellProps {
  header: React.ReactNode
  children: React.ReactNode
  rightOpen: boolean
  onRightToggle: () => void
  onRightClose: () => void
}

function EditorShell({ header, children, rightOpen, onRightClose }: EditorShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {header}
      <div className="od-editor-body">
        <div className="od-wysiwyg-wrap">{children}</div>
        <aside
          className={`od-editor-right${rightOpen ? ' open' : ''}`}
          id="editor-right-panel"
        >
          {rightOpen && <ThemePanel onClose={onRightClose} />}
        </aside>
      </div>
    </div>
  )
}

// ─── SVG icons ───────────────────────────────────────────────────────────────
const ThemeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 0 0 20 10 10 0 0 1 0-20z" />
  </svg>
)

// ─── Local Editor ─────────────────────────────────────────────────────────────
function LocalEditor() {
  const [pages, setPages] = useState<{ title: string; filePath: string }[]>([])
  const [currentFile, setCurrentFile] = useState(getCurrentPagePath())

  // Content refs — don't re-render the editor on every keystroke
  const currentBodyRef = useRef('')
  const originalContentRef = useRef('')
  const [isDirty, setIsDirty] = useState(false)

  const [pageTitle, setPageTitle] = useState('')
  const [pageIcon, setPageIcon] = useState('')

  const [initialBlocks, setInitialBlocks] = useState<Block[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [rightOpen, setRightOpen] = useState(false)

  const { status: gitStatus, refresh: refreshGit } = useGitStatus()
  const editorTheme = useDarkMode()

  // Load nav
  useEffect(() => {
    fetch('/_opendoc/nav.json')
      .then(r => r.json())
      .then((nav: NavNode) => {
        const flat = flattenNav(nav)
        setPages(flat)
      })
      .catch(() => {})
  }, [])

  // Load file → parse to blocks before mounting editor (no flash/race)
  useEffect(() => {
    setInitialBlocks(null)
    const cancelled = { current: false }

    localLoadFile(currentFile)
      .catch(() => '# New Page\n\nStart writing here...')
      .then(async text => {
        if (cancelled.current) return
        const { title, icon, body } = extractPageMeta(text)
        const blocks = await markdownToBlocks(body)
        if (cancelled.current) return
        setPageTitle(title)
        setPageIcon(icon)
        currentBodyRef.current = body
        originalContentRef.current = text
        setIsDirty(false)
        setInitialBlocks(blocks)
      })

    return () => { cancelled.current = true }
  }, [currentFile])

  const onContentChange = useCallback((md: string) => {
    currentBodyRef.current = md
    setIsDirty(buildMarkdown(pageTitle, pageIcon, md) !== originalContentRef.current)
  }, [pageTitle, pageIcon])

  const getCurrentMarkdown = useCallback(() => {
    return buildMarkdown(pageTitle, pageIcon, currentBodyRef.current)
  }, [pageTitle, pageIcon])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const content = getCurrentMarkdown()
      await localSaveFile(currentFile, content)
      originalContentRef.current = content
      setIsDirty(false)
      showToast('Saved', 'success')
      refreshGit()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }, [currentFile, refreshGit, getCurrentMarkdown])

  useKeyboardSave(handleSave)

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
        showToast(
          result.pushed
            ? `✓ Committed & pushed (${result.hash})`
            : `✓ Committed locally (${result.hash})`,
          result.pushed ? 'success' : 'warning',
        )
        setCommitMsg('')
        refreshGit()
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

  const handleTitleChange = useCallback((t: string) => {
    setPageTitle(t)
    setIsDirty(buildMarkdown(t, pageIcon, currentBodyRef.current) !== originalContentRef.current)
  }, [pageIcon])

  const handleIconChange = useCallback((i: string) => {
    setPageIcon(i)
    setIsDirty(buildMarkdown(pageTitle, i, currentBodyRef.current) !== originalContentRef.current)
  }, [pageTitle])

  const gitDirty = gitStatus?.isRepo && gitStatus.changes > 0

  const header = (
    <div className="editor-header">
      <span className="od-breadcrumb">
        {pages.length > 0 ? (
          <select
            value={currentFile}
            onChange={e => switchPage(e.target.value)}
            className="od-breadcrumb-select"
          >
            {pages.map(p => <option key={p.filePath} value={p.filePath}>{p.title}</option>)}
          </select>
        ) : (
          <span>{currentFile}</span>
        )}
      </span>
      <span className="spacer" />
      {gitStatus?.isRepo && (
        <span
          className={`od-git-status ${gitDirty ? 'od-git-dirty' : 'od-git-clean'}`}
          title={gitStatus.branch ? `Branch: ${gitStatus.branch}` : undefined}
        >
          {gitDirty ? `${gitStatus.changes} changed` : 'Saved'}
        </span>
      )}
      <button
        className="od-save-primary od-save-standalone"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <><span className="od-spinner" />Saving…</> : isDirty ? 'Save' : 'Saved'}
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
          <button className="btn btn-primary btn-sm" onClick={handleCommit} disabled={committing}>
            {committing ? 'Committing…' : 'Commit & Push'}
          </button>
        </div>
      )}
      <button className="od-toggle-themes" onClick={() => setRightOpen(o => !o)} title="Themes">
        <ThemeIcon />
      </button>
    </div>
  )

  return (
    <EditorShell header={header} rightOpen={rightOpen} onRightToggle={() => setRightOpen(o => !o)} onRightClose={() => setRightOpen(false)}>
      {initialBlocks ? (
        <BlockEditor
          key={currentFile}
          initialBlocks={initialBlocks}
          pagePath={currentFile}
          onContentChange={onContentChange}
          theme={editorTheme}
          pageHeader={
            <PageHeader
              title={pageTitle}
              icon={pageIcon}
              onTitleChange={handleTitleChange}
              onIconChange={handleIconChange}
            />
          }
        />
      ) : (
        <div className="od-editor-loading">Loading…</div>
      )}
    </EditorShell>
  )
}

// ─── GitHub Editor ─────────────────────────────────────────────────────────────
interface GitHubEditorProps {
  token: string
  repo: string
}

function GitHubEditor({ token, repo }: GitHubEditorProps) {
  const config = useSiteConfig()
  const pagePath = getCurrentPagePath()
  const baseBranch = config.github?.branch || 'main'

  const currentBodyRef = useRef('')
  const originalContentRef = useRef('')
  const [isDirty, setIsDirty] = useState(false)

  const [pageTitle, setPageTitle] = useState('')
  const [pageIcon, setPageIcon] = useState('')

  const [initialBlocks, setInitialBlocks] = useState<Block[] | null>(null)
  const [repoAccess, setRepoAccess] = useState<RepoAccess>('none')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  const editorTheme = useDarkMode()

  useEffect(() => {
    checkRepoAccess(repo, token).then(setRepoAccess)

    fetchFileFromGitHub(repo, pagePath, token, baseBranch)
      .then(async text => {
        const md = text || '# New Page\n\nStart writing here...'
        const { title, icon, body } = extractPageMeta(md)
        const blocks = await markdownToBlocks(body)
        setPageTitle(title)
        setPageIcon(icon)
        currentBodyRef.current = body
        originalContentRef.current = md
        setInitialBlocks(blocks)
      })
      .catch(e => showToast(`Failed to load file: ${e.message}`, 'error'))
  }, [])

  const onContentChange = useCallback((md: string) => {
    currentBodyRef.current = md
    setIsDirty(buildMarkdown(pageTitle, pageIcon, md) !== originalContentRef.current)
  }, [pageTitle, pageIcon])

  const getCurrentMarkdown = useCallback(() => {
    return buildMarkdown(pageTitle, pageIcon, currentBodyRef.current)
  }, [pageTitle, pageIcon])

  const handleSave = useCallback(async (forcePR = false) => {
    setSaving(true)
    setShowDropdown(false)
    try {
      const content = getCurrentMarkdown()
      const before = originalContentRef.current
      const message = await getCommitMessage(pagePath, before, content)

      let result: CommitResult
      if (repoAccess === 'write' && !forcePR) {
        result = await commitFile(repo, pagePath, content, message, token, baseBranch)
        showToast('Saved', 'success', result.url)
      } else {
        result = await openPullRequest(repo, pagePath, content, message, token, baseBranch)
        showToast('Pull request opened', 'success', result.url)
      }

      originalContentRef.current = content
      setIsDirty(false)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }, [repo, pagePath, token, baseBranch, repoAccess, getCurrentMarkdown])

  useKeyboardSave(() => handleSave(false))

  const handleTitleChange = useCallback((t: string) => {
    setPageTitle(t)
    setIsDirty(buildMarkdown(t, pageIcon, currentBodyRef.current) !== originalContentRef.current)
  }, [pageIcon])

  const handleIconChange = useCallback((i: string) => {
    setPageIcon(i)
    setIsDirty(buildMarkdown(pageTitle, i, currentBodyRef.current) !== originalContentRef.current)
  }, [pageTitle])

  const isWrite = repoAccess === 'write'

  const header = (
    <div className="editor-header">
      <span className="od-breadcrumb">
        <span className="od-breadcrumb-muted">{repo}</span>
        <span className="od-breadcrumb-sep">/</span>
        <span>{pagePath}</span>
      </span>
      <span className="spacer" />
      <div className="od-save-btn-group">
        <button className="od-save-primary" onClick={() => handleSave(false)} disabled={saving}>
          {saving
            ? <><span className="od-spinner" />Saving…</>
            : isDirty
              ? `${isWrite ? 'Save' : 'Suggest Edit'}`
              : isWrite ? 'Saved' : 'Suggest Edit'
          }
        </button>
        {isWrite && (
          <>
            <button className="od-save-dropdown-trigger" onClick={() => setShowDropdown(d => !d)}>
              <svg viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {showDropdown && (
              <div className="od-save-dropdown">
                <button className="od-save-option" onClick={() => handleSave(true)}>Open Pull Request</button>
              </div>
            )}
          </>
        )}
      </div>
      <button className="btn btn-sm" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Change Repo</button>
      <button className="btn btn-sm" onClick={() => { localStorage.removeItem('github_token'); localStorage.removeItem('github_repo'); window.location.reload() }}>Logout</button>
      <button className="od-toggle-themes" onClick={() => setRightOpen(o => !o)} title="Themes">
        <ThemeIcon />
      </button>
    </div>
  )

  return (
    <EditorShell header={header} rightOpen={rightOpen} onRightToggle={() => setRightOpen(o => !o)} onRightClose={() => setRightOpen(false)}>
      {initialBlocks ? (
        <BlockEditor
          key={pagePath}
          initialBlocks={initialBlocks}
          pagePath={pagePath}
          onContentChange={onContentChange}
          theme={editorTheme}
          pageHeader={
            <PageHeader
              title={pageTitle}
              icon={pageIcon}
              onTitleChange={handleTitleChange}
              onIconChange={handleIconChange}
            />
          }
        />
      ) : (
        <div className="od-editor-loading">Loading…</div>
      )}
    </EditorShell>
  )
}

// ─── Auth Screens ─────────────────────────────────────────────────────────────
function LoginScreen({ clientId }: { clientId?: string }) {
  function login() {
    if (!clientId) {
      showToast('GitHub OAuth client ID not configured', 'error')
      return
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/editor')
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header"><span className="logo">OpenDoc Editor</span></div>
      <div className="login-screen">
        <div className="login-box">
          <h1>OpenDoc Editor</h1>
          <p>Sign in with GitHub to edit documentation.</p>
          <button className="btn btn-primary" onClick={login}>Login with GitHub</button>
        </div>
      </div>
    </div>
  )
}

function RepoPicker({ repos }: { repos: { full_name: string }[] }) {
  const [input, setInput] = useState('')

  function go() {
    if (input.trim()) {
      localStorage.setItem('github_repo', input.trim())
      window.location.reload()
    }
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
          <select onChange={e => setInput(e.target.value)} defaultValue="">
            <option value="" disabled>Choose a repo…</option>
            {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
          <div className="or-divider">or type a repo name</div>
          <input
            type="text"
            placeholder="owner/repo"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go()}
          />
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
          <button className="btn btn-primary" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>
            Choose Another Repo
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
type AppView =
  | { view: 'loading' }
  | { view: 'local' }
  | { view: 'login' }
  | { view: 'repoPicker'; repos: { full_name: string }[] }
  | { view: 'editor'; token: string; repo: string }
  | { view: 'noAccess'; repo: string }

function App() {
  const [appView, setAppView] = useState<AppView>({ view: 'loading' })
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({})

  useEffect(() => {
    async function init() {
      // Local dev mode — skip all auth
      if (isLocal) { setAppView({ view: 'local' }); return }

      // OAuth callback: exchange code for token
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        try {
          const r = await fetch(`/oauth/callback?code=${code}`)
          const data = await r.json()
          if (data.access_token) localStorage.setItem('github_token', data.access_token)
        } catch {}
        window.history.replaceState({}, '', '/editor')
        window.location.reload()
        return
      }

      // Token in hash (from server-side redirect)
      if (window.location.hash.startsWith('#github_token=')) {
        const t = window.location.hash.slice('#github_token='.length)
        if (t) localStorage.setItem('github_token', t)
        window.history.replaceState({}, '', window.location.pathname + window.location.search)
      }

      // Load site config — then use it for the rest of init
      let config: SiteConfig = {}
      try {
        const r = await fetch('/_opendoc/config.json')
        if (r.ok) config = await r.json()
      } catch {}
      setSiteConfig(config)

      if (config.github?.repo && !getStoredRepo()) {
        localStorage.setItem('github_repo', config.github.repo)
      }

      const token = getStoredToken()
      if (!token) { setAppView({ view: 'login' }); return }

      const repo = getStoredRepo()
      if (!repo) {
        try {
          const repos = await fetchUserRepos(token)
          setAppView({ view: 'repoPicker', repos })
        } catch {
          localStorage.removeItem('github_token')
          setAppView({ view: 'login' })
        }
        return
      }

      const access = await checkRepoAccess(repo, token)
      if (access === 'none') { setAppView({ view: 'noAccess', repo }); return }
      setAppView({ view: 'editor', token, repo })
    }

    init()
  }, [])

  const view = appView

  return (
    <SiteConfigContext.Provider value={siteConfig}>
      {view.view === 'loading'     && <div className="login-screen"><div style={{ color: 'var(--color-muted)' }}>Loading…</div></div>}
      {view.view === 'local'       && <LocalEditor />}
      {view.view === 'login'       && <LoginScreen clientId={siteConfig.github?.clientId} />}
      {view.view === 'repoPicker'  && <RepoPicker repos={view.repos} />}
      {view.view === 'noAccess'    && <NoAccess repo={view.repo} />}
      {view.view === 'editor'      && <GitHubEditor token={view.token} repo={view.repo} />}
    </SiteConfigContext.Provider>
  )
}

// ─── Mount ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('app')!).render(<App />)
