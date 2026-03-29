import React from 'react'
import { ThemePanel } from './theme-panel'

export interface EditorShellProps {
  header: React.ReactNode
  nav?: React.ReactNode
  children: React.ReactNode
  rightOpen: boolean
  onRightToggle: () => void
  onRightClose: () => void
}

export function EditorShell({ header, nav, children, rightOpen, onRightClose }: EditorShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {header}
      <div className="od-editor-body">
        {nav}
        <div className="od-wysiwyg-wrap">{children}</div>
        <aside
          className={`od-editor-right${rightOpen ? ' open' : ''}`}
          id="editor-right-panel"
        >
          {rightOpen && <ThemePanel onClose={onRightClose} />}
        </aside>
      </div>
    </div>
  )
}

export const ThemeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 0 0 20 10 10 0 0 1 0-20z" />
  </svg>
)
