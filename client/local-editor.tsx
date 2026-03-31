import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Block } from '@blocknote/core'
import { useGitStatus, useDarkMode, useKeyboardSave } from './hooks'
import { EditorShell, type RightPanel } from './editor-shell'
import { NavSidebar } from './nav-sidebar'
import { PageHeader } from './page-header'
import { BlockEditor } from './block-editor'
import {
  showToast, extractPageMeta, buildMarkdown,
  getCurrentPagePath, flattenNav, localLoadFile, localSaveFile,
  fetchOrder, saveOrder,
  type NavNode,
} from './editor-utils'
import { markdownToBlocks } from './markdown'
import { PanelLeft, Sun, Moon, GitBranch, Settings2, FileImage } from 'lucide-react'
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
  sidebarCollapsed, onToggleSidebar, darkMode,
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
}) {
  return (
    <div className="editor-header">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleSidebar} title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}>
        <PanelLeft className="h-4 w-4" />
      </Button>
      {pages.length > 0 ? (
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
      <span className="spacer" />
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
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={darkMode.toggle} title={darkMode.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
        {darkMode.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanel(p => p === 'page-settings' ? null : 'page-settings')} title="Page Settings">
        <FileImage className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanel(p => p === 'theme' ? null : 'theme')} title="Themes">
        <Settings2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function LocalEditor() {
  const [pages, setPages] = useState<{ title: string; filePath: string }[]>([])
  const [navTree, setNavTree] = useState<NavNode | null>(null)
  const [currentFile, setCurrentFile] = useState<string>(getCurrentPagePath() ?? '')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const currentBodyRef = useRef('')
  const originalContentRef = useRef('')
  const [isDirty, setIsDirty] = useState(false)

  const [pageTitle, setPageTitle] = useState('')
  const [pageIcon, setPageIcon] = useState('')

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
      const allPages = flattenNav(nav).filter(p => p.filePath !== 'index.md')
      setPages(allPages)
      // If no page is selected yet, default to index.md (root) or first available page
      setCurrentFile(prev => {
        if (!prev) {
          const first = 'index.md'
          window.history.replaceState({}, '', '/_')
          return first
        }
        return prev
      })
    } catch {}
  }, [])

  useEffect(() => { refreshNav() }, [refreshNav])

  useEffect(() => {
    if (!currentFile) return
    setInitialBlocks(null)
    const cancelled = { current: false }

    localLoadFile(currentFile)
      .catch(() => '# New Page\n')
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
    if (saving) return
    setSaving(true)
    try {
      const content = getCurrentMarkdown()
      await localSaveFile(currentFile, content)
      originalContentRef.current = content
      setIsDirty(false)
      refreshGit()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }, [currentFile, refreshGit, getCurrentMarkdown, saving])

  // Autosave: debounced 1s after last change
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isDirty) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => { handleSave() }, 1000)
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current) }
  }, [isDirty, handleSave])

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

  function switchPage(filePath: string) {
    const url = (!filePath || filePath === 'index.md') ? '/_' : `/_/${filePath}`
    window.history.pushState({}, '', url)
    setCurrentFile(filePath || 'index.md')
  }

  const handleCreatePage = useCallback(async (parentPath: string, name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const filePath = parentPath ? `${parentPath}/${slug}/index.md` : `${slug}/index.md`
    const content = `# ${name}\n`
    try {
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
      showToast((e as Error).message, 'error')
    }
  }, [refreshNav])

  const handleTitleChange = useCallback((t: string) => {
    setPageTitle(t)
    setIsDirty(buildMarkdown(t, pageIcon, currentBodyRef.current) !== originalContentRef.current)
    // Update sidebar nav title immediately
    setNavTree(prev => prev ? updateNavNodeTitle(prev, currentFile, t) : prev)
    setPages(prev => prev.map(p => p.filePath === currentFile ? { ...p, title: t } : p))
  }, [pageIcon, currentFile])

  const handleIconChange = useCallback((i: string) => {
    setPageIcon(i)
    setIsDirty(buildMarkdown(pageTitle, i, currentBodyRef.current) !== originalContentRef.current)
  }, [pageTitle])

  const gitDirty = gitStatus?.isRepo && gitStatus.changes > 0

  return (
    <EditorShell
      header={
        <LocalEditorHeader
          pages={pages} currentFile={currentFile} switchPage={switchPage}
          gitStatus={gitStatus} gitDirty={gitDirty}
          saving={saving} isDirty={isDirty}
          commitMsg={commitMsg} setCommitMsg={setCommitMsg}
          committing={committing} handleCommit={handleCommit}
          setRightPanel={setRightPanel} rightPanel={rightPanel}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          darkMode={darkMode}
        />
      }
      nav={navTree ? (
        <NavSidebar
          nav={navTree}
          currentFile={currentFile}
          onNavigate={switchPage}
          onCreatePage={handleCreatePage}
          onRefreshNav={refreshNav}
          collapsed={sidebarCollapsed}
          onOpenSiteSettings={() => setRightPanel(p => p === 'site-settings' ? null : 'site-settings')}
        />
      ) : undefined}
      rightPanel={rightPanel}
      onRightClose={() => setRightPanel(null)}
      pagePath={currentFile}
    >
      {initialBlocks ? (
        <BlockEditor
          key={currentFile}
          initialBlocks={initialBlocks}
          pagePath={currentFile}
          onContentChange={onContentChange}
          theme={darkMode.theme}
          pageHeader={
            <PageHeader
              title={pageTitle}
              icon={pageIcon}
              onTitleChange={handleTitleChange}
              onIconChange={handleIconChange}
              darkMode={darkMode.theme}
            />
          }
        />
      ) : (
        <div className="od-editor-loading">Loading...</div>
      )}
    </EditorShell>
  )
}
