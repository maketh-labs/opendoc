import React, { useState, useCallback } from 'react'
import type { NavNode } from './editor-utils'

export interface NavSidebarProps {
  nav: NavNode
  currentFile: string
  onNavigate: (filePath: string) => void
  onNewPage: (parentPath: string) => void
  collapsed: boolean
}

export function NavSidebar({ nav, currentFile, onNavigate, onNewPage, collapsed }: NavSidebarProps) {
  return (
    <aside className={`od-sidebar-left${collapsed ? ' od-sidebar-collapsed' : ''}`}>
      {!collapsed && (
        <>
          <div className="od-sidebar-header">
            <span className="od-sidebar-title">{nav.title || 'Pages'}</span>
          </div>
          <nav className="od-nav">
            <ul>
              {nav.children.map(child => (
                <NavItem
                  key={child.path}
                  node={child}
                  currentFile={currentFile}
                  onNavigate={onNavigate}
                  onNewPage={onNewPage}
                  depth={0}
                />
              ))}
            </ul>
          </nav>
        </>
      )}
    </aside>
  )
}

function nodeToFilePath(node: NavNode): string {
  const p = node.path === '.' ? '' : node.path
  return p ? `${p}/index.md` : 'index.md'
}

interface NavItemProps {
  node: NavNode
  currentFile: string
  onNavigate: (filePath: string) => void
  onNewPage: (parentPath: string) => void
  depth: number
}

function NavItem({ node, currentFile, onNavigate, onNewPage, depth }: NavItemProps) {
  const [expanded, setExpanded] = useState(true)
  const filePath = nodeToFilePath(node)
  const isActive = currentFile === filePath
  const hasChildren = node.children.length > 0

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onNavigate(filePath)
  }, [filePath, onNavigate])

  const handleNewPage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onNewPage(node.path === '.' ? '' : node.path)
  }, [node.path, onNewPage])

  return (
    <li>
      <div className={`od-nav-item${isActive ? ' active' : ''}`}>
        {hasChildren && (
          <button
            className="od-nav-chevron"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
        {!hasChildren && <span className="od-nav-chevron-spacer" />}
        <a
          href="#"
          className={isActive ? 'active' : ''}
          onClick={handleClick}
        >
          {node.icon && <span className="od-nav-icon">{node.icon}</span>}
          {node.title}
        </a>
        <button className="od-nav-add" onClick={handleNewPage} title="New sub-page">+</button>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map(child => (
            <NavItem
              key={child.path}
              node={child}
              currentFile={currentFile}
              onNavigate={onNavigate}
              onNewPage={onNewPage}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
