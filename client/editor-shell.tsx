import React from 'react'
import { ThemePanel } from './theme-panel'
import { PageSettingsPanel } from './page-settings-panel'

export type RightPanel = 'theme' | 'page-settings' | null

export interface EditorShellProps {
  header: React.ReactNode
  nav?: React.ReactNode
  children: React.ReactNode
  rightPanel: RightPanel
  onRightClose: () => void
  pagePath?: string
}

export const ThemeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 0 0 20 10 10 0 0 1 0-20z" />
  </svg>
)

export function EditorShell({ header, nav, children, rightPanel, onRightClose, pagePath }: EditorShellProps) {
  return (
    <div className="flex flex-col h-screen">
      {header}
      <div className="flex flex-1 overflow-hidden">
        {nav}
        <div className="od-wysiwyg-wrap flex-1 overflow-y-auto flex py-16 px-8 bg-[var(--od-color-bg)]">{children}</div>
        <aside
          className={`od-editor-right shrink-0 border-l transition-all duration-200 ${rightPanel ? 'open w-[var(--od-theme-panel-width)] border-l-[var(--color-border)] overflow-y-auto' : 'w-0 overflow-hidden border-transparent'}`}
          id="editor-right-panel"
        >
          {rightPanel === 'theme' && <ThemePanel onClose={onRightClose} />}
          {rightPanel === 'page-settings' && pagePath && (
            <PageSettingsPanel pagePath={pagePath} onClose={onRightClose} />
          )}
        </aside>
      </div>
    </div>
  )
}
