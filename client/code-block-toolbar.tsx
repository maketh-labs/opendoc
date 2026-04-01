import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { codeBlockOptions } from '@blocknote/code-block'

// Sorted language list from codeBlockOptions
const LANGUAGES: { id: string; name: string }[] = Object.entries(
  codeBlockOptions.supportedLanguages ?? {}
)
  .map(([id, { name }]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

interface ToolbarEntry {
  container: HTMLElement
  blockId: string
}

interface CodeBlockToolbarProps {
  editor: any // BlockNote editor instance
}

function CodeBlockToolbar({ blockId, container, editor }: ToolbarEntry & { editor: any }) {
  const block = editor.getBlock(blockId)
  const language: string = block?.props?.language ?? 'javascript'

  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const pre = container.querySelector('pre, [data-node-view-content]')
    const text = pre?.textContent ?? container.textContent ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [container])

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    editor.updateBlock(blockId, { props: { language: e.target.value } })
  }, [editor, blockId])

  return (
    <div className="od-cb-toolbar absolute top-1.5 right-2 flex items-center gap-1 z-10 opacity-0 transition-opacity duration-[120ms] pointer-events-none" contentEditable={false}>
      <select
        className="h-6 px-1.5 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-[0.7rem] font-inherit cursor-pointer outline-none max-w-[130px] focus:border-[var(--color-accent)]"
        value={language}
        onChange={handleLanguageChange}
        aria-label="Code language"
      >
        {LANGUAGES.map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <button className="flex items-center justify-center w-6 h-6 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--od-color-text-muted)] cursor-pointer transition-all duration-[120ms] shrink-0 hover:bg-[var(--od-color-surface-2)] hover:text-[var(--color-text)]" onClick={handleCopy} title="Copy code">
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function CodeBlockToolbarManager({ editor }: CodeBlockToolbarProps) {
  const [entries, setEntries] = useState<ToolbarEntry[]>([])

  const sync = useCallback(() => {
    const editorEl = document.querySelector('.bn-editor')
    if (!editorEl) return

    const blocks = editorEl.querySelectorAll<HTMLElement>('[data-content-type="codeBlock"]')
    const next: ToolbarEntry[] = []

    for (const el of blocks) {
      const container = el.closest<HTMLElement>('[data-id]')
      if (!container) continue
      const blockId = container.getAttribute('data-id') ?? ''
      if (!blockId) continue

      // Ensure container is relatively positioned for absolute toolbar
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative'
      }

      next.push({ container, blockId })
    }

    setEntries(prev => {
      // Avoid re-render if nothing changed
      if (
        prev.length === next.length &&
        prev.every((e, i) => e.blockId === next[i]?.blockId && e.container === next[i]?.container)
      ) return prev
      return next
    })
  }, [])

  useEffect(() => {
    const editorEl = document.querySelector('.bn-editor')
    if (!editorEl) return

    sync()

    const observer = new MutationObserver(sync)
    observer.observe(editorEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-content-type', 'data-id'] })
    return () => observer.disconnect()
  }, [sync])

  return (
    <>
      {entries.map(entry =>
        createPortal(
          <CodeBlockToolbar key={entry.blockId} {...entry} editor={editor} />,
          entry.container
        )
      )}
    </>
  )
}
