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

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

function LocalEditorHeader({
  pages, currentFile, switchPage, gitStatus, gitDirty,
  saving, isDirty, handleSave, commitMsg, setCommitMsg,
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
  handleSave: () => void
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
      <button className="od-toggle-themes" onClick={onToggleSidebar} title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>
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
      <button className="od-toggle-themes" onClick={darkMode.toggle} title={darkMode.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
        {darkMode.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <button className="od-toggle-themes" onClick={() => setRightOpen(o => !o)} title="Themes">
        <ThemeIcon />
      </button>
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
          saving={saving} isDirty={isDirty} handleSave={handleSave}
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
          onToggle={() => setSidebarCollapsed(c => !c)}
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
