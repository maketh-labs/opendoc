import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, Plus } from 'lucide-react'
import { cn } from './ui/cn'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
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
          <div className="flex items-center justify-between px-3 py-2 border-b text-sm font-semibold">
            <span className="truncate">{nav.title || 'Pages'}</span>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2">
              <ul className="list-none p-0 m-0">
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
          </ScrollArea>
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
    <li className="list-none">
      <div className={cn('group relative flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer', isActive && 'bg-accent text-accent-foreground font-medium')}>
        {hasChildren ? (
          <button
            className="flex items-center justify-center h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <a
          href="#"
          className={cn(
            'flex-1 truncate no-underline text-muted-foreground hover:text-foreground',
            isActive && 'text-accent-foreground'
          )}
          onClick={handleClick}
        >
          {node.icon && <span className="mr-1">{node.icon}</span>}
          {node.title}
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
          onClick={handleNewPage}
          title="New sub-page"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {hasChildren && expanded && (
        <ul className="pl-3 ml-2 border-l list-none">
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
