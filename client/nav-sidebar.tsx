import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Plus, MoreHorizontal } from 'lucide-react'
import { cn } from './ui/cn'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu'
import type { NavNode } from './editor-utils'
import { saveOrder, movePageApi, fetchOrder, deletePageApi, renamePageApi, duplicatePageApi, flattenNav } from './editor-utils'

export interface NavSidebarProps {
  nav: NavNode
  currentFile: string
  onNavigate: (filePath: string) => void
  onCreatePage: (parentPath: string, name: string) => Promise<void>
  onRefreshNav: () => Promise<void>
  collapsed: boolean
  onOpenSiteSettings?: () => void
}

type DropZone = { type: 'between'; parentPath: string; index: number } | { type: 'onto'; targetPath: string } | null

type ContextMenuState = {
  nodePath: string
  nodeTitle: string
  x: number
  y: number
  confirmingDelete?: boolean
} | null

// Get the folder name (basename) from a NavNode path
function folderName(nodePath: string): string {
  const parts = nodePath.split('/')
  return parts[parts.length - 1] || nodePath
}

// Get the parent directory path from a NavNode path
function parentDir(nodePath: string): string {
  const parts = nodePath.split('/')
  if (parts.length <= 1) return '.'
  return parts.slice(0, -1).join('/')
}

export function NavSidebar({ nav, currentFile, onNavigate, onCreatePage, onRefreshNav, collapsed, onOpenSiteSettings }: NavSidebarProps) {
  const [creatingAt, setCreatingAt] = useState<string | null>(null)
  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<DropZone>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

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

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleContextMenuAction = useCallback(async (action: string) => {
    if (!contextMenu) return
    const nodePath = contextMenu.nodePath

    if (action === 'rename') {
      setContextMenu(null)
      setRenamingPath(nodePath)
    } else if (action === 'new-sub-page') {
      setContextMenu(null)
      handleStartCreate(nodePath)
    } else if (action === 'confirm-delete') {
      setContextMenu(prev => prev ? { ...prev, confirmingDelete: true } : null)
    } else if (action === 'delete') {
      setContextMenu(null)
      await deletePageApi(nodePath)
      await onRefreshNav()
      // If deleted page is currently open, navigate to first available page
      const filePath = nodePath ? `${nodePath}/index.md` : 'index.md'
      if (currentFile === filePath || currentFile.startsWith(nodePath + '/')) {
        const pages = flattenNav(nav)
        const firstAvailable = pages.find(p => !p.filePath.startsWith(nodePath + '/') && p.filePath !== filePath)
        if (firstAvailable) onNavigate(firstAvailable.filePath)
      }
    } else if (action === 'duplicate') {
      setContextMenu(null)
      await duplicatePageApi(nodePath)
      await onRefreshNav()
    }
  }, [contextMenu, currentFile, nav, onNavigate, onRefreshNav, handleStartCreate])

  const handleRenameConfirm = useCallback(async (oldPath: string, newSlug: string) => {
    setRenamingPath(null)
    const parent = parentDir(oldPath)
    const newPath = parent === '.' ? newSlug : `${parent}/${newSlug}`
    if (newPath === oldPath) return
    await renamePageApi(oldPath, newPath)
    await onRefreshNav()
    // If renamed page is currently open, navigate to new path
    const oldFile = `${oldPath}/index.md`
    if (currentFile === oldFile) {
      onNavigate(`${newPath}/index.md`)
    }
  }, [currentFile, onNavigate, onRefreshNav])

  const handleRenameCancel = useCallback(() => setRenamingPath(null), [])

  const handleDragStart = useCallback((nodePath: string) => {
    setDraggedPath(nodePath)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedPath(null)
    setDropZone(null)
  }, [])

  const handleDrop = useCallback(async (zone: DropZone) => {
    if (!draggedPath || !zone) return
    setDraggedPath(null)
    setDropZone(null)

    const draggedFolder = folderName(draggedPath)
    const sourceParent = parentDir(draggedPath)

    if (zone.type === 'between') {
      const targetParent = zone.parentPath

      if (sourceParent === targetParent) {
        // Same-level reorder
        const currentOrder = await fetchOrder(targetParent)
        // Get siblings from nav tree
        const siblings = targetParent === '.'
          ? nav.children.map(c => folderName(c.path))
          : findNode(nav, targetParent)?.children.map(c => folderName(c.path)) ?? []

        // Use currentOrder as base, fallback to nav order for unlisted
        const ordered = currentOrder.length > 0 ? [...currentOrder] : [...siblings]
        // Ensure all siblings are in the list
        for (const s of siblings) {
          if (!ordered.includes(s)) ordered.push(s)
        }

        const fromIdx = ordered.indexOf(draggedFolder)
        if (fromIdx !== -1) ordered.splice(fromIdx, 1)
        // Insert at target index, adjust if needed
        let insertIdx = zone.index
        if (fromIdx !== -1 && fromIdx < insertIdx) insertIdx--
        ordered.splice(insertIdx, 0, draggedFolder)

        await saveOrder(targetParent, ordered)
      } else {
        // Cross-level move: move folder then update both orders
        const newPath = targetParent === '.' ? draggedFolder : `${targetParent}/${draggedFolder}`
        await movePageApi(draggedPath, newPath)

        // Remove from source order
        const srcOrder = await fetchOrder(sourceParent)
        const filtered = srcOrder.filter(n => n !== draggedFolder)
        await saveOrder(sourceParent, filtered)

        // Add to destination order at correct position
        const destOrder = await fetchOrder(targetParent)
        destOrder.splice(zone.index, 0, draggedFolder)
        await saveOrder(targetParent, destOrder)
      }
      await onRefreshNav()
    } else if (zone.type === 'onto') {
      // Move into target as child
      if (draggedPath === zone.targetPath) return
      // Don't allow dropping into own descendants
      if (zone.targetPath.startsWith(draggedPath + '/')) return

      const newPath = `${zone.targetPath}/${draggedFolder}`
      await movePageApi(draggedPath, newPath)

      // Remove from source order
      const srcOrder = await fetchOrder(sourceParent)
      await saveOrder(sourceParent, srcOrder.filter(n => n !== draggedFolder))

      // Add to destination order
      const destOrder = await fetchOrder(zone.targetPath)
      destOrder.push(draggedFolder)
      await saveOrder(zone.targetPath, destOrder)

      await onRefreshNav()
    }
  }, [draggedPath, nav, onRefreshNav])

  return (
    <aside className={`od-sidebar-left${collapsed ? ' od-sidebar-collapsed' : ''}`}>
      {!collapsed && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b text-sm font-semibold">
            <button
              className="truncate text-left hover:text-accent transition-colors cursor-pointer bg-transparent border-none p-0 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              onClick={onOpenSiteSettings}
              title="Site settings"
            >
              {nav.title || 'Pages'}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                {nav.children.map((child, idx) => (
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
                    draggedPath={draggedPath}
                    dropZone={dropZone}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDropZoneChange={setDropZone}
                    onDrop={handleDrop}
                    parentPath="."
                    index={idx}
                    isLast={idx === nav.children.length - 1}
                    onContextMenu={setContextMenu}
                    renamingPath={renamingPath}
                    onRenameConfirm={handleRenameConfirm}
                    onRenameCancel={handleRenameCancel}
                  />
                ))}
              </ul>
            </nav>
          </ScrollArea>
        </>
      )}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => { if (!open) setContextMenu(null) }}>
        <DropdownMenuTrigger asChild>
          <span
            className="pointer-events-none fixed w-0 h-0 p-0 m-0"
            style={{ left: contextMenu?.x ?? 0, top: contextMenu?.y ?? 0 }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-[160px]">
          {contextMenu?.confirmingDelete ? (
            <div className="px-3 py-2">
              <p className="text-sm mb-2">Delete page and all sub-pages?</p>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
                  onClick={closeContextMenu}
                >
                  Cancel
                </button>
                <button
                  className="px-2 py-1 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => handleContextMenuAction('delete')}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => handleContextMenuAction('rename')}>Rename</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleContextMenuAction('new-sub-page')}>New sub-page</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => { e.preventDefault(); handleContextMenuAction('confirm-delete') }}
              >
                Delete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleContextMenuAction('duplicate')}>Duplicate</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  )
}

function findNode(root: NavNode, path: string): NavNode | null {
  if (root.path === path || (root.path === '.' && path === '.')) return root
  for (const child of root.children) {
    const found = findNode(child, path)
    if (found) return found
  }
  return null
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
          aria-label="New page name"
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
  draggedPath: string | null
  dropZone: DropZone
  onDragStart: (path: string) => void
  onDragEnd: () => void
  onDropZoneChange: (zone: DropZone) => void
  onDrop: (zone: DropZone) => void
  parentPath: string
  index: number
  isLast: boolean
  onContextMenu: (state: ContextMenuState) => void
  renamingPath: string | null
  onRenameConfirm: (oldPath: string, newSlug: string) => Promise<void>
  onRenameCancel: () => void
}

function InlineRenameInput({ currentSlug, onConfirm, onCancel }: {
  currentSlug: string
  onConfirm: (newSlug: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(currentSlug)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const slug = value.trim()
      if (slug && slug !== currentSlug) onConfirm(slug)
      else onCancel()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="flex-1 min-w-0 text-sm bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:border-accent"
      aria-label="Rename page"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  )
}

function NavItem({
  node, currentFile, onNavigate, onStartCreate, onConfirmCreate, onCancelCreate,
  creatingAt, depth, draggedPath, dropZone, onDragStart, onDragEnd, onDropZoneChange, onDrop,
  parentPath, index, isLast, onContextMenu, renamingPath, onRenameConfirm, onRenameCancel,
}: NavItemProps) {
  const [expanded, setExpanded] = useState(true)
  const itemRef = useRef<HTMLDivElement>(null)
  const filePath = nodeToFilePath(node)
  const isActive = currentFile === filePath
  const nodePath = node.path === '.' ? '' : node.path
  const hasChildren = node.children.length > 0
  const isCreatingHere = creatingAt === nodePath
  const isRenaming = renamingPath === node.path
  const isDragged = draggedPath === node.path  // used for opacity below
  const isDropOnto = dropZone?.type === 'onto' && dropZone.targetPath === node.path
  const isDropBefore = dropZone?.type === 'between' && dropZone.parentPath === parentPath && dropZone.index === index
  const isDropAfter = isLast && dropZone?.type === 'between' && dropZone.parentPath === parentPath && dropZone.index === index + 1

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onNavigate(filePath)
  }, [filePath, onNavigate])

  const handleNewPage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onStartCreate(nodePath)
    if (!expanded) setExpanded(true)
  }, [nodePath, onStartCreate, expanded])

  const openContextMenu = useCallback((x: number, y: number) => {
    onContextMenu({ nodePath: node.path, nodeTitle: node.title, x, y })
  }, [node.path, node.title, onContextMenu])

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openContextMenu(e.clientX, e.clientY)
  }, [openContextMenu])

  const handleMoreClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openContextMenu(rect.right, rect.bottom)
  }, [openContextMenu])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.path)

    // Custom drag image: clone the element so the ghost looks like the actual item
    if (itemRef.current) {
      const clone = itemRef.current.cloneNode(true) as HTMLElement
      clone.style.position = 'absolute'
      clone.style.top = '-9999px'
      clone.style.left = '-9999px'
      clone.style.width = `${itemRef.current.offsetWidth}px`
      // Strip hrefs so the browser doesn't show the URL in the drag tooltip
      clone.querySelectorAll('a').forEach(a => a.removeAttribute('href'))
      document.body.appendChild(clone)
      const rect = itemRef.current.getBoundingClientRect()
      e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top)
      // Clean up after browser captures the image
      requestAnimationFrame(() => document.body.removeChild(clone))
    }

    onDragStart(node.path)
  }, [node.path, onDragStart])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedPath || draggedPath === node.path) return
    // Don't allow dropping into own descendants
    if (node.path.startsWith(draggedPath + '/')) return

    e.dataTransfer.dropEffect = 'move'
    const rect = itemRef.current?.getBoundingClientRect()
    if (!rect) return

    const y = e.clientY - rect.top
    const height = rect.height
    const quarter = height / 4

    if (y < quarter) {
      // Top quarter → drop before
      onDropZoneChange({ type: 'between', parentPath, index })
    } else if (y > height - quarter) {
      // Bottom quarter → drop after (or before next)
      onDropZoneChange({ type: 'between', parentPath, index: index + 1 })
    } else {
      // Middle → drop onto (make child)
      onDropZoneChange({ type: 'onto', targetPath: node.path })
    }
  }, [draggedPath, node.path, parentPath, index, onDropZoneChange])

  const handleDropEvent = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDrop(dropZone)
  }, [dropZone, onDrop])

  // Drop zone clearing is handled at the parent level on drop/dragend
  const handleDragLeave = useCallback((_e: React.DragEvent) => {}, [])

  return (
    <li className="list-none relative">
      {/* Drop-before indicator */}
      {isDropBefore && (
        <div className="absolute left-2 right-2 top-0 h-0.5 bg-blue-500 rounded z-10" />
      )}
      <div
        ref={itemRef}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDropEvent}
        onDragLeave={handleDragLeave}
        onContextMenu={handleRightClick}
        className={cn(
          'group relative flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer',
          isActive && 'bg-accent text-accent-foreground font-medium',
          isDropOnto && 'ring-2 ring-blue-500 bg-blue-500/10 rounded-md',
          isDragged && 'opacity-40',
        )}
      >
        {hasChildren || isCreatingHere ? (
          <button
            className="flex items-center justify-center h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground relative before:absolute before:inset-[-10px] before:content-['']"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {isRenaming ? (
          <InlineRenameInput
            currentSlug={folderName(node.path)}
            onConfirm={(newSlug) => onRenameConfirm(node.path, newSlug)}
            onCancel={onRenameCancel}
          />
        ) : (
          <a
            href={`/${node.path === '.' ? '' : node.path}`}
            className={cn(
              'flex-1 truncate no-underline text-muted-foreground hover:text-foreground',
              isActive && 'text-accent-foreground'
            )}
            onClick={handleClick}
          >
            {node.icon && <span className="mr-1">{node.icon}</span>}
            {node.title}
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 relative before:absolute before:inset-[-8px] before:content-['']"
          onClick={handleMoreClick}
          title="More actions"
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 relative before:absolute before:inset-[-8px] before:content-['']"
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
              onConfirm={(name) => onConfirmCreate(nodePath, name)}
              onCancel={onCancelCreate}
              depth={depth + 1}
            />
          )}
          {node.children.map((child, idx) => (
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
              draggedPath={draggedPath}
              dropZone={dropZone}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropZoneChange={onDropZoneChange}
              onDrop={onDrop}
              parentPath={node.path}
              index={idx}
              isLast={idx === node.children.length - 1}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </ul>
      )}
      {/* Drop-after indicator (only on last item) */}
      {isDropAfter && (
        <div className="absolute left-2 right-2 bottom-0 h-0.5 bg-blue-500 rounded z-10" />
      )}
    </li>
  )
}
