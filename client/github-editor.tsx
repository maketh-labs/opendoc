import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Block } from '@blocknote/core'
import { useDarkMode, useKeyboardSave } from './hooks'
import { EditorShell, ThemeIcon } from './editor-shell'
import { PageHeader } from './page-header'
import { BlockEditor } from './block-editor'
import {
  showToast, extractPageMeta, buildMarkdown,
  getCurrentPagePath, getCommitMessage, type SiteConfig,
} from './editor-utils'
import { markdownToBlocks } from './markdown'
import {
  checkRepoAccess, fetchFileFromGitHub,
  commitFile, openPullRequest,
  type RepoAccess, type CommitResult,
} from './github-api'

export interface GitHubEditorProps {
  token: string
  repo: string
  config: SiteConfig
}

export function GitHubEditor({ token, repo, config }: GitHubEditorProps) {
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
