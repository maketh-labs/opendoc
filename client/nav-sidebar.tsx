import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Plus } from 'lucide-react'
import { cn } from './ui/cn'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import type { NavNode } from './editor-utils'

export interface NavSidebarProps {
  nav: NavNode
  currentFile: string
  onNavigate: (filePath: string) => void
  onCreatePage: (parentPath: string, name: string) => Promise<void>
  collapsed: boolean
}

export function NavSidebar({ nav, currentFile, onNavigate, onCreatePage, collapsed }: NavSidebarProps) {
  const [creatingAt, setCreatingAt] = useState<string | null>(null)

  const handleStartCreate = useCallback((parentPath: string) => {
    setCreatingAt(parentPath)
  }, [])

  const handleConfirmCreate = useCallback(async (parentPath: string, name: string) => {
    setCreatingAt(null)
    await onCreatePage(parentPath, name)
  }, [onCreatePage])

  const handleCancelCreate = useCallback(() => {
    setCreatingAt(null)
  }, [])

  return (
    <aside className={`od-sidebar-left${collapsed ? ' od-sidebar-collapsed' : ''}`}>
      {!collapsed && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b text-sm font-semibold">
            <span className="truncate">{nav.title || 'Pages'}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => handleStartCreate('')}
              title="New page"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2">
              <ul className="list-none p-0 m-0">
                {creatingAt === '' && (
                  <InlineNewPageInput
                    onConfirm={(name) => handleConfirmCreate('', name)}
                    onCancel={handleCancelCreate}
                    depth={0}
                  />
                )}
                {nav.children.map(child => (
                  <NavItem
                    key={child.path}
                    node={child}
                    currentFile={currentFile}
                    onNavigate={onNavigate}
                    onStartCreate={handleStartCreate}
                    onConfirmCreate={handleConfirmCreate}
                    onCancelCreate={handleCancelCreate}
                    creatingAt={creatingAt}
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

function InlineNewPageInput({ onConfirm, onCancel, depth }: {
  onConfirm: (name: string) => void
  onCancel: () => void
  depth: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const name = value.trim()
      if (name) onConfirm(name)
      else onCancel()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <li className="list-none">
      <div className="flex items-center gap-1 px-2 py-1">
        <span className="w-4 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-0 text-sm bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:border-accent"
          placeholder="Page name..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onCancel}
        />
      </div>
    </li>
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
  onStartCreate: (parentPath: string) => void
  onConfirmCreate: (parentPath: string, name: string) => Promise<void>
  onCancelCreate: () => void
  creatingAt: string | null
  depth: number
}

function NavItem({ node, currentFile, onNavigate, onStartCreate, onConfirmCreate, onCancelCreate, creatingAt, depth }: NavItemProps) {
  const [expanded, setExpanded] = useState(true)
  const filePath = nodeToFilePath(node)
  const isActive = currentFile === filePath
  const parentPath = node.path === '.' ? '' : node.path
  const hasChildren = node.children.length > 0
  const isCreatingHere = creatingAt === parentPath

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onNavigate(filePath)
  }, [filePath, onNavigate])

  const handleNewPage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onStartCreate(parentPath)
    if (!expanded) setExpanded(true)
  }, [parentPath, onStartCreate, expanded])

  return (
    <li className="list-none">
      <div className={cn('group relative flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer', isActive && 'bg-accent text-accent-foreground font-medium')}>
        {hasChildren || isCreatingHere ? (
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
      {(hasChildren || isCreatingHere) && expanded && (
        <ul className="pl-3 ml-2 border-l list-none">
          {isCreatingHere && (
            <InlineNewPageInput
              onConfirm={(name) => onConfirmCreate(parentPath, name)}
              onCancel={onCancelCreate}
              depth={depth + 1}
            />
          )}
          {node.children.map(child => (
            <NavItem
              key={child.path}
              node={child}
              currentFile={currentFile}
              onNavigate={onNavigate}
              onStartCreate={onStartCreate}
              onConfirmCreate={onConfirmCreate}
              onCancelCreate={onCancelCreate}
              creatingAt={creatingAt}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
