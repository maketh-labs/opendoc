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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {header}
      <div className="od-editor-body">
        {nav}
        <div className="od-wysiwyg-wrap">{children}</div>
        <aside
          className={`od-editor-right${rightPanel ? ' open' : ''}`}
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
