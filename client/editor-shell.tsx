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
