import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { LazyFallback } from './lazy-fallback'
import type { Block } from '@blocknote/core'
import { useDarkMode, useKeyboardSave } from './hooks'
import { EditorShell, ThemeIcon, type RightPanel } from './editor-shell'
import { PageHeader } from './page-header'
import { LazyBlockEditor as BlockEditor, markdownToBlocks } from './lazy-editor'
import {
  showToast, getCurrentPagePath, getCommitMessage, type SiteConfig,
} from './editor-utils'
import { usePageDraft } from './page-draft'
import { Button } from './ui/button'
import {
  checkRepoAccess, fetchFileFromGitHub,
  commitFile, saveToPullRequest, loadPrSession,
  type RepoAccess,
} from './github-api'

export interface GitHubEditorProps {
  token: string
  repo: string
  config: SiteConfig
}

export function GitHubEditor({ token, repo, config }: GitHubEditorProps) {
  // The editor root (no page segment) edits the site's home page
  const pagePath = getCurrentPagePath(config.editorPath) ?? 'index.md'
  const baseBranch = config.github?.branch || 'main'

  const draft = usePageDraft()
  const d = draft.api
  const shaRef = useRef<string | undefined>(undefined)
  const savingRef = useRef(false)

  const [initialBlocks, setInitialBlocks] = useState<Block[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [repoAccess, setRepoAccess] = useState<RepoAccess>('none')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [openPr, setOpenPr] = useState<{ number: number; url: string } | null>(() => {
    const s = loadPrSession(repo, baseBranch)
    return s ? { number: s.number, url: s.url } : null
  })

  const { theme: editorTheme } = useDarkMode()

  useEffect(() => {
    checkRepoAccess(repo, token).then(setRepoAccess)

    fetchFileFromGitHub(repo, pagePath, token, baseBranch)
      .then(async file => {
        shaRef.current = file.sha
        const body = d.load(file.content || '# New Page\n\nStart writing here...')
        setInitialBlocks(await markdownToBlocks(body))
      })
      .catch(e => {
        // Don't fall back to an empty editor — saving it would overwrite the real file
        setLoadError(`Failed to load ${pagePath}: ${e.message}`)
      })
  }, [])

  // Warn before closing the tab with unsaved changes (GitHub mode has no autosave)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (d.dirtyRef.current || savingRef.current) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [d])

  const handleSave = useCallback(async (forcePR = false) => {
    setShowDropdown(false)
    if (savingRef.current) return
    if (!d.dirtyRef.current) { showToast('No changes to save', 'warning'); return }
    savingRef.current = true
    setSaving(true)
    try {
      const snap = d.snapshot()
      const content = d.getMarkdown()
      const message = getCommitMessage(pagePath, shaRef.current ? d.originalText() : undefined, content)

      if (repoAccess === 'write' && !forcePR) {
        const result = await commitFile(repo, pagePath, content, message, token, baseBranch, shaRef.current)
        shaRef.current = result.sha
        d.markSaved(content, snap)
        showToast('Saved', 'success', result.url)
      } else {
        // Every suggested edit in this session lands on one PR branch
        const result = await saveToPullRequest({
          repo, path: pagePath, content, message, token, baseBranch,
          loadedSha: shaRef.current, loadedText: d.originalText(),
        })
        // The edit now lives on the PR branch; the draft is clean relative to it
        d.markSaved(content, snap)
        setOpenPr({ number: result.number, url: result.url })
        showToast(result.updated ? `Updated PR #${result.number}` : `Opened PR #${result.number}`, 'success', { linkUrl: result.url, linkText: 'View PR →' })
      }
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [repo, pagePath, token, baseBranch, repoAccess, d])

  useKeyboardSave(() => handleSave(false))

  const isWrite = repoAccess === 'write'
  const suggestLabel = openPr ? `Add to PR #${openPr.number}` : 'Suggest Edit'

  const header = (
    <div className="flex items-center gap-2 h-10 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
      <span className="flex items-center gap-1 text-sm">
        <span className="text-[var(--color-muted)]">{repo}</span>
        <span className="text-[var(--color-muted)]">/</span>
        <span>{pagePath}</span>
      </span>
      <span className="flex-1" />
      {openPr && (
        <a className="text-xs text-[var(--color-muted)] hover:underline" href={openPr.url} target="_blank" rel="noopener noreferrer" title="Suggested edits in this session go to this pull request">
          PR #{openPr.number}
        </a>
      )}
      <div className="relative inline-flex">
        <Button variant="default" size="sm" className="h-7 text-xs rounded-r-none" onClick={() => handleSave(false)} disabled={saving || !draft.isDirty}>
          {saving
            ? <><span className="od-spinner" />Saving…</>
            : draft.isDirty
              ? (isWrite ? 'Save' : suggestLabel)
              : isWrite ? 'Saved' : suggestLabel
          }
        </Button>
        {isWrite && (
          <>
            <Button variant="default" size="sm" className="h-7 px-1.5 rounded-l-none border-l border-l-primary-foreground/20" onClick={() => setShowDropdown(d => !d)}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Button>
            {showDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-popover border rounded-md shadow-md z-50 min-w-[160px]">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md" onClick={() => handleSave(true)} disabled={!draft.isDirty}>{openPr ? `Add to PR #${openPr.number}` : 'Open Pull Request'}</button>
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
      <Suspense fallback={<LazyFallback label="Loading editor…" />}>
      {initialBlocks ? (
        <BlockEditor
          key={pagePath}
          initialBlocks={initialBlocks}
          pagePath={pagePath}
          onContentChange={d.setBody}
          onBaseline={d.setBaseline}
          theme={editorTheme}
          pageHeader={
            <PageHeader
              title={draft.title}
              icon={draft.icon}
              onTitleChange={d.changeTitle}
              onIconChange={d.changeIcon}
            />
          }
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-[var(--color-muted)] text-sm">{loadError ?? 'Loading…'}</div>
      )}
      </Suspense>
    </EditorShell>
  )
}
