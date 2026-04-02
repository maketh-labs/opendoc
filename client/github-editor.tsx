import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Block } from '@blocknote/core'
import { useDarkMode, useKeyboardSave } from './hooks'
import { EditorShell, ThemeIcon, type RightPanel } from './editor-shell'
import { PageHeader } from './page-header'
import { BlockEditor } from './block-editor'
import {
  showToast, extractPageMeta, buildMarkdown,
  getCurrentPagePath, getCommitMessage, type SiteConfig,
} from './editor-utils'
import { markdownToBlocks } from './markdown'
import { Button } from './ui/button'
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
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)

  const { theme: editorTheme } = useDarkMode()

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
      .catch(e => {
        showToast(`Failed to load file: ${e.message}`, 'error')
        setInitialBlocks([{ type: 'paragraph', content: [] } as any])
      })
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
    <div className="flex items-center gap-2 h-10 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
      <span className="flex items-center gap-1 text-sm">
        <span className="text-[var(--color-muted)]">{repo}</span>
        <span className="text-[var(--color-muted)]">/</span>
        <span>{pagePath}</span>
      </span>
      <span className="flex-1" />
      <div className="relative inline-flex">
        <Button variant="default" size="sm" className="h-7 text-xs rounded-r-none" onClick={() => handleSave(false)} disabled={saving}>
          {saving
            ? <><span className="od-spinner" />Saving…</>
            : isDirty
              ? `${isWrite ? 'Save' : 'Suggest Edit'}`
              : isWrite ? 'Saved' : 'Suggest Edit'
          }
        </Button>
        {isWrite && (
          <>
            <Button variant="default" size="sm" className="h-7 px-1.5 rounded-l-none border-l border-l-primary-foreground/20" onClick={() => setShowDropdown(d => !d)}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Button>
            {showDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-popover border rounded-md shadow-md z-50 min-w-[160px]">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md" onClick={() => handleSave(true)}>Open Pull Request</button>
              </div>
            )}
          </>
        )}
      </div>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Change Repo</Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { localStorage.removeItem('github_token'); localStorage.removeItem('github_repo'); window.location.reload() }}>Logout</Button>
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setRightPanel(p => p === 'theme' ? null : 'theme')} title="Themes">
        <ThemeIcon />
      </Button>
    </div>
  )

  return (
    <EditorShell header={header} rightPanel={rightPanel} onRightClose={() => setRightPanel(null)}>
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
        <div className="flex items-center justify-center flex-1 text-[var(--color-muted)] text-sm">Loading…</div>
      )}
    </EditorShell>
  )
}
