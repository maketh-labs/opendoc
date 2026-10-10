import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import type { Block } from '@blocknote/core'
import { useGitStatus, useDarkMode, useKeyboardSave } from './hooks'
import { EditorShell, type RightPanel } from './editor-shell'
import { LazyFallback } from './lazy-fallback'
import { NavSidebar } from './nav-sidebar'
import { PageHeader } from './page-header'
import { LazyBlockEditor as BlockEditor, markdownToBlocks } from './lazy-editor'
import {
  showToast, getCurrentPagePath, getSettingsUrl, isSettingsUrl, editorUrlFor,
  flattenNav, localLoadFile, localSaveFile,
  fetchOrder, saveOrder, encodePath,
  type NavNode,
} from './editor-utils'
import { usePageDraft } from './page-draft'
import { PanelLeft, Sun, Moon, GitBranch, Settings, Palette, FileImage } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select'

function updateNavNodeTitle(node: NavNode, filePath: string, newTitle: string): NavNode {
  const nodePath = node.path === '.' ? '' : node.path
  const nodeFile = nodePath ? `${nodePath}/index.md` : 'index.md'
  if (nodeFile === filePath) {
    return { ...node, title: newTitle }
  }
  return { ...node, children: node.children.map(c => updateNavNodeTitle(c, filePath, newTitle)) }
}

function LocalEditorHeader({
  pages, currentFile, switchPage, gitStatus, gitDirty,
  saving, isDirty, commitMsg, setCommitMsg,
  committing, handleCommit, setRightPanel, rightPanel,
  sidebarCollapsed, onToggleSidebar, darkMode, onOpenSiteSettings,
}: {
  pages: { title: string; filePath: string }[]
  currentFile: string
  switchPage: (f: string) => void
  gitStatus: { isRepo: boolean; branch?: string; changes: number } | null
  gitDirty: boolean | undefined | 0
  saving: boolean
  isDirty: boolean
  commitMsg: string
  setCommitMsg: (m: string) => void
  committing: boolean
  handleCommit: () => void
  setRightPanel: React.Dispatch<React.SetStateAction<RightPanel>>
  rightPanel: RightPanel
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  darkMode: { theme: 'light' | 'dark'; toggle: () => void }
  onOpenSiteSettings: () => void
}) {
  return (
    <div className="flex items-center gap-2 h-10 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onToggleSidebar} title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}>
        <PanelLeft className="h-4 w-4" />
      </Button>
      {!currentFile ? (
        <span className="text-xs text-muted-foreground px-2">Site settings</span>
      ) : pages.length > 0 ? (
        <Select value={currentFile} onValueChange={switchPage}>
          <SelectTrigger className="h-7 w-auto max-w-[200px] border-none bg-transparent text-xs text-muted-foreground px-2 gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pages.map(p => <SelectItem key={p.filePath} value={p.filePath}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-xs text-muted-foreground">{currentFile}</span>
      )}
      <span className="flex-1" />
      <Badge variant="outline" className={`text-xs font-normal ${saving ? 'text-muted-foreground' : isDirty ? 'text-muted-foreground' : 'text-green-600 dark:text-green-400'}`}>
        {saving ? <><span className="od-spinner" />Saving…</> : isDirty ? 'Unsaved' : '✓ Saved'}
      </Badge>
      {gitStatus?.isRepo && (
        <Badge variant="secondary" className="text-xs font-normal gap-1" title={gitStatus.branch ? `Branch: ${gitStatus.branch}` : undefined}>
          <GitBranch className="h-3 w-3" />
          {gitDirty ? `${gitStatus.changes} changed` : 'Committed'}
        </Badge>
      )}
      {gitStatus?.isRepo && (
        <div className="flex items-center gap-1.5">
          <Input
            type="text"
            className="h-7 w-[180px] text-xs"
            placeholder="Commit message"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
          />
          <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleCommit} disabled={committing}>
            {committing ? 'Committing…' : 'Commit & Push'}
          </Button>
        </div>
      )}
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={darkMode.toggle} title={darkMode.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
        {darkMode.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      {currentFile && (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setRightPanel(p => p === 'page-settings' ? null : 'page-settings')} title="Page Settings">
          <FileImage className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setRightPanel(p => p === 'theme' ? null : 'theme')} title="Themes">
        <Palette className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost" size="icon"
        className={`h-9 w-9${!currentFile ? ' bg-accent text-accent-foreground' : ''}`}
        onClick={onOpenSiteSettings}
        title="Site settings"
        aria-pressed={!currentFile}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  )
}

const SiteSettingsPage = lazy(() => import('./site-settings-page').then(m => ({ default: m.SiteSettingsPage })))

export function LocalEditor() {
  const [pages, setPages] = useState<{ title: string; filePath: string }[]>([])
  const [navTree, setNavTree] = useState<NavNode | null>(null)
  // '' = site settings (/__); the bare editor URL (/_) edits the home page
  const [currentFile, setCurrentFile] = useState<string>(() => isSettingsUrl() ? '' : getCurrentPagePath() ?? 'index.md')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const draft = usePageDraft()
  const d = draft.api
  // The file the current draft was loaded from — saves always go here, never to a newer currentFile
  const draftFileRef = useRef<string>('')

  const [initialBlocks, setInitialBlocks] = useState<Block[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)

  const { status: gitStatus, refresh: refreshGit } = useGitStatus()
  const darkMode = useDarkMode()

  const refreshNav = useCallback(async () => {
    try {
      const r = await fetch('/_opendoc/nav.json')
      const nav: NavNode = await r.json()
      setNavTree(nav)
      // Root page shows as "Home" unless the root has no index.md of its own
      const allPages = flattenNav(nav)
        .filter(p => p.filePath !== 'index.md' || !nav.virtual)
        .map(p => p.filePath === 'index.md' ? { ...p, title: 'Home' } : p)
      setPages(allPages)
      // Don't auto-navigate — if no page is selected, stay at the editor root (site settings)
    } catch {}
  }, [])

  useEffect(() => { refreshNav() }, [refreshNav])

  useEffect(() => {
    if (!currentFile) { draftFileRef.current = ''; return }
    setInitialBlocks(null)
    draftFileRef.current = ''
    const cancelled = { current: false }

    localLoadFile(currentFile)
      .catch(() => {
        // Check if this page exists in the nav tree — if not, redirect to site settings
        const knownPages = flattenNav(navTree).filter(p => p.filePath !== 'index.md' || !navTree?.virtual)
        if (!knownPages.some(p => p.filePath === currentFile)) {
          if (!cancelled.current) {
            window.history.replaceState({}, '', getSettingsUrl())
            setCurrentFile('')
          }
          throw new Error('skip')
        }
        return '# New Page\n'
      })
      .then(async text => {
        if (cancelled.current) return
        const body = d.load(text)
        const blocks = await markdownToBlocks(body)
        if (cancelled.current) return
        draftFileRef.current = currentFile
        setInitialBlocks(blocks)
      })
      .catch(e => {
        if (e?.message === 'skip') return
        console.error('Failed to load page:', e)
        showToast(`Failed to load ${currentFile}`, 'error')
      })

    return () => { cancelled.current = true }
  }, [currentFile])

  // ── Saving ────────────────────────────────────────────────────────────────
  // A single in-flight save at a time; edits made during a save trigger a follow-up save.
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = null
  }, [])

  const saveNow = useCallback(async (): Promise<boolean> => {
    clearAutosave()
    while (inFlightRef.current) await inFlightRef.current
    const file = draftFileRef.current
    if (!file || !d.dirtyRef.current) return true

    const run = (async () => {
      setSaving(true)
      try {
        const snap = d.snapshot()
        const content = d.getMarkdown()
        await localSaveFile(file, content)
        if (draftFileRef.current === file) d.markSaved(content, snap)
        refreshGit()
        return true
      } catch (e) {
        showToast((e as Error).message, 'error')
        return false
      } finally {
        setSaving(false)
      }
    })()
    inFlightRef.current = run
    try { return await run } finally { inFlightRef.current = null }
  }, [clearAutosave, d, refreshGit])

  // Autosave: debounced 1s after last change
  useEffect(() => {
    if (!draft.isDirty) return
    clearAutosave()
    autosaveTimerRef.current = setTimeout(() => { saveNow() }, 1000)
    return clearAutosave
  }, [draft.isDirty, draft.title, draft.icon, saveNow, clearAutosave])

  const onContentChange = useCallback((md: string) => {
    d.setBody(md)
    // Re-arm the debounce on every keystroke while dirty
    if (d.dirtyRef.current) {
      clearAutosave()
      autosaveTimerRef.current = setTimeout(() => { saveNow() }, 1000)
    }
  }, [d, clearAutosave, saveNow])

  useKeyboardSave(() => { saveNow() })

  // Warn before closing the tab with unsaved or in-flight changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (d.dirtyRef.current || inFlightRef.current) {
        saveNow()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [d, saveNow])

  /** Flush pending edits before leaving the page. Returns false if the user chose to stay. */
  const flushBeforeLeave = useCallback(async (): Promise<boolean> => {
    const ok = await saveNow()
    if (ok) return true
    return window.confirm('Your latest changes could not be saved. Leave this page anyway?')
  }, [saveNow])

  /** Drop the current draft without saving (its file was deleted/renamed/moved). */
  const discardDraft = useCallback(() => {
    clearAutosave()
    draftFileRef.current = ''
  }, [clearAutosave])

  async function handleCommit() {
    if (!(await saveNow())) return
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
            ? `Committed & pushed (${result.hash})`
            : `Committed locally (${result.hash})`,
          result.pushed ? 'success' : 'warning',
        )
        setCommitMsg('')
        refreshGit()
      } else {
        showToast(`${result.error}`, 'error')
      }
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setCommitting(false)
    }
  }

  const switchPage = useCallback(async (filePath: string, opts: { discard?: boolean } = {}) => {
    if (opts.discard) discardDraft()
    else if (!(await flushBeforeLeave())) return
    window.history.pushState({}, '', editorUrlFor(filePath))
    setCurrentFile(filePath)
  }, [discardDraft, flushBeforeLeave])

  const handleCreatePage = useCallback(async (parentPath: string, name: string) => {
    // Non-Latin names produce an empty slug — never fall through to the parent's (or root) index.md
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `page-${Date.now().toString(36)}`
    const filePath = parentPath ? `${parentPath}/${slug}/index.md` : `${slug}/index.md`
    const content = `# ${name}\n`
    try {
      const existing = await fetch(`/_opendoc/file/${encodePath(filePath)}`, { method: 'GET' })
      if (existing.ok) {
        showToast(`A page named “${slug}” already exists here`, 'error')
        return
      }
      await localSaveFile(filePath, content)
      // Append to order.json for this directory
      const orderDir = parentPath || '.'
      const currentOrder = await fetchOrder(orderDir)
      if (!currentOrder.includes(slug)) {
        await saveOrder(orderDir, [...currentOrder, slug])
      }
      showToast(`Created ${name}`, 'success')
      await refreshNav()
      switchPage(filePath)
    } catch (e) {
      showToast(`Couldn't create page: ${(e as Error).message}`, 'error')
      await refreshNav()
    }
  }, [refreshNav, switchPage])

  const handleTitleChange = useCallback((t: string) => {
    d.changeTitle(t)
    // Update sidebar nav title immediately
    setNavTree(prev => prev ? updateNavNodeTitle(prev, currentFile, t) : prev)
    setPages(prev => prev.map(p => p.filePath === currentFile ? { ...p, title: t } : p))
  }, [d, currentFile])

  const openSiteSettings = useCallback(async () => {
    if (!(await flushBeforeLeave())) return
    window.history.pushState({}, '', getSettingsUrl())
    setCurrentFile('')
    setRightPanel(null)
  }, [flushBeforeLeave])

  const gitDirty = gitStatus?.isRepo && gitStatus.changes > 0

  return (
    <EditorShell
      header={
        <LocalEditorHeader
          pages={pages} currentFile={currentFile} switchPage={switchPage}
          gitStatus={gitStatus} gitDirty={gitDirty}
          saving={saving} isDirty={draft.isDirty}
          commitMsg={commitMsg} setCommitMsg={setCommitMsg}
          committing={committing} handleCommit={handleCommit}
          setRightPanel={setRightPanel} rightPanel={rightPanel}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          darkMode={darkMode}
          onOpenSiteSettings={openSiteSettings}
        />
      }
      nav={navTree ? (
        <NavSidebar
          nav={navTree}
          currentFile={currentFile}
          onNavigate={switchPage}
          onBeforeMutate={flushBeforeLeave}
          onCreatePage={handleCreatePage}
          onRefreshNav={refreshNav}
          collapsed={sidebarCollapsed}
        />
      ) : undefined}
      rightPanel={rightPanel}
      onRightClose={() => setRightPanel(null)}
      pagePath={currentFile}
    >
      <Suspense fallback={<LazyFallback label="Loading editor…" />}>
      {!currentFile ? (
        <Suspense fallback={<LazyFallback label="Loading site settings…" />}>
          <SiteSettingsPage />
        </Suspense>
      ) : initialBlocks ? (
        <BlockEditor
          key={currentFile}
          initialBlocks={initialBlocks}
          pagePath={currentFile}
          onContentChange={onContentChange}
          onBaseline={d.setBaseline}
          theme={darkMode.theme}
          pageHeader={
            <PageHeader
              title={draft.title}
              icon={draft.icon}
              onTitleChange={handleTitleChange}
              onIconChange={d.changeIcon}
              darkMode={darkMode.theme}
            />
          }
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-[var(--color-muted)] text-sm">Loading...</div>
      )}
      </Suspense>
    </EditorShell>
  )
}
