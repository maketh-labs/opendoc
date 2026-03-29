import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Block } from '@blocknote/core'
import { useGitStatus, useDarkMode, useKeyboardSave } from './hooks'
import { EditorShell, ThemeIcon } from './editor-shell'
import { NavSidebar } from './nav-sidebar'
import { PageHeader } from './page-header'
import { BlockEditor } from './block-editor'
import {
  showToast, extractPageMeta, buildMarkdown,
  getCurrentPagePath, flattenNav, localLoadFile, localSaveFile,
  type NavNode,
} from './editor-utils'
import { markdownToBlocks } from './markdown'
import { PanelLeft, Sun, Moon, GitBranch, Settings2 } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select'

function LocalEditorHeader({
  pages, currentFile, switchPage, gitStatus, gitDirty,
  saving, isDirty, commitMsg, setCommitMsg,
  committing, handleCommit, setRightOpen,
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
  setRightOpen: React.Dispatch<React.SetStateAction<boolean>>
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
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightOpen(o => !o)} title="Themes">
        <Settings2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function LocalEditor() {
  const [pages, setPages] = useState<{ title: string; filePath: string }[]>([])
  const [navTree, setNavTree] = useState<NavNode | null>(null)
  const [currentFile, setCurrentFile] = useState(getCurrentPagePath())
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
  const [rightOpen, setRightOpen] = useState(false)

  const { status: gitStatus, refresh: refreshGit } = useGitStatus()
  const darkMode = useDarkMode()

  useEffect(() => {
    fetch('/_opendoc/nav.json')
      .then(r => r.json())
      .then((nav: NavNode) => {
        setNavTree(nav)
        setPages(flattenNav(nav))
      })
      .catch(() => {})
  }, [])

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
    const url = new URL(window.location.href)
    url.searchParams.set('path', filePath)
    window.history.pushState({}, '', url.toString())
    setCurrentFile(filePath)
  }

  const handleNewPage = useCallback(async (parentPath: string) => {
    const name = prompt('Page name:')
    if (!name) return
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const filePath = parentPath ? `${parentPath}/${slug}/index.md` : `${slug}/index.md`
    const content = `# ${name}\n\nStart writing here...\n`
    try {
      await localSaveFile(filePath, content)
      showToast(`Created ${name}`, 'success')
      // Refresh nav
      const r = await fetch('/_opendoc/nav.json')
      const nav: NavNode = await r.json()
      setNavTree(nav)
      setPages(flattenNav(nav))
      switchPage(filePath)
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [])

  const handleTitleChange = useCallback((t: string) => {
    setPageTitle(t)
    setIsDirty(buildMarkdown(t, pageIcon, currentBodyRef.current) !== originalContentRef.current)
  }, [pageIcon])

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
          setRightOpen={setRightOpen}
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
          onNewPage={handleNewPage}
          collapsed={sidebarCollapsed}
        />
      ) : undefined}
      rightOpen={rightOpen}
      onRightToggle={() => setRightOpen(o => !o)}
      onRightClose={() => setRightOpen(false)}
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
