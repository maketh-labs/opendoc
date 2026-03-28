import type { BlockNoteEditor } from '@blocknote/core'

const HANDLE_SVG = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
  <circle cx="2.5" cy="2.5" r="1.5"/>
  <circle cx="7.5" cy="2.5" r="1.5"/>
  <circle cx="2.5" cy="8" r="1.5"/>
  <circle cx="7.5" cy="8" r="1.5"/>
  <circle cx="2.5" cy="13.5" r="1.5"/>
  <circle cx="7.5" cy="13.5" r="1.5"/>
</svg>`

interface TurnIntoItem {
  action: string
  label: string
  type: string
  level?: number
}

const TURN_INTO: TurnIntoItem[] = [
  { action: 'turn-paragraph',  label: '📄 Text',           type: 'paragraph' },
  { action: 'turn-h1',         label: 'H1  Heading 1',     type: 'heading', level: 1 },
  { action: 'turn-h2',         label: 'H2  Heading 2',     type: 'heading', level: 2 },
  { action: 'turn-h3',         label: 'H3  Heading 3',     type: 'heading', level: 3 },
  { action: 'turn-bullet',     label: '•   Bullet List',   type: 'bulletListItem' },
  { action: 'turn-numbered',   label: '1.  Numbered List', type: 'numberedListItem' },
  { action: 'turn-quote',      label: '❝   Quote',         type: 'quote' },
  { action: 'turn-code',       label: '</>  Code Block',   type: 'codeBlock' },
]

function findBlockOuter(target: EventTarget | null, editorEl: HTMLElement): Element | null {
  let node = target as Element | null
  while (node && node !== editorEl) {
    if (node.getAttribute?.('data-node-type') === 'blockOuter') return node
    node = node.parentElement
  }
  return null
}

export function initSideMenu(editor: BlockNoteEditor, editorEl: HTMLElement): () => void {
  // --- Handle button ---
  const handle = document.createElement('button')
  handle.className = 'od-block-handle'
  handle.innerHTML = HANDLE_SVG
  handle.setAttribute('aria-label', 'Block options')
  handle.style.display = 'none'
  document.body.appendChild(handle)

  // --- Context menu ---
  const menu = document.createElement('div')
  menu.className = 'od-block-menu'
  menu.style.display = 'none'
  menu.setAttribute('role', 'menu')
  document.body.appendChild(menu)

  let currentBlockId: string | null = null
  let menuOpen = false

  // --- Position handle (fixed, left of block) ---
  function positionHandle(blockEl: Element): void {
    const rect = blockEl.getBoundingClientRect()
    const top = rect.top + rect.height / 2 - 11
    const left = Math.max(4, rect.left - 26)
    handle.style.top = `${top}px`
    handle.style.left = `${left}px`
    handle.style.display = 'flex'
  }

  // --- Hover tracking ---
  editorEl.addEventListener('mousemove', (e) => {
    if (menuOpen) return
    const blockOuter = findBlockOuter(e.target, editorEl)
    if (blockOuter) {
      currentBlockId = blockOuter.getAttribute('data-id')
      positionHandle(blockOuter)
    }
  })

  editorEl.addEventListener('mouseleave', () => {
    if (!menuOpen) handle.style.display = 'none'
  })

  handle.addEventListener('mouseleave', (e) => {
    const rel = e.relatedTarget as Element | null
    if (!menuOpen && rel && !rel.closest?.('[data-node-type="blockOuter"]')) {
      handle.style.display = 'none'
    }
  })

  // --- Open menu ---
  handle.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!currentBlockId) return
    openMenu(currentBlockId)
  })

  function openMenu(blockId: string): void {
    const block = editor.getBlock(blockId)
    if (!block) return
    menuOpen = true

    const blockType = block.type as string
    const blockLevel = (block.props as any)?.level as number | undefined

    menu.innerHTML = buildMenuHTML(blockType, blockLevel)
    menu.style.display = 'block'

    // Position below handle, clamp to viewport
    const hr = handle.getBoundingClientRect()
    let top = hr.bottom + 4
    let left = hr.left

    menu.style.top = `${top}px`
    menu.style.left = `${left}px`

    requestAnimationFrame(() => {
      const mr = menu.getBoundingClientRect()
      if (mr.right > window.innerWidth - 8) {
        left = window.innerWidth - mr.width - 8
        menu.style.left = `${left}px`
      }
      if (mr.bottom > window.innerHeight - 8) {
        top = hr.top - mr.height - 4
        menu.style.top = `${top}px`
      }
    })

    // Wire clicks
    menu.querySelectorAll<HTMLElement>('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        handleAction(btn.dataset.action!, blockId)
        closeMenu()
      })
    })
  }

  function closeMenu(): void {
    menuOpen = false
    menu.style.display = 'none'
    handle.style.display = 'none'
  }

  // Close on outside click / Escape
  const onDocClick = (e: MouseEvent) => {
    if (menuOpen && !menu.contains(e.target as Node) && !handle.contains(e.target as Node)) {
      closeMenu()
    }
  }
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && menuOpen) closeMenu()
  }
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onEsc)

  // --- Actions ---
  function handleAction(action: string, blockId: string): void {
    const block = editor.getBlock(blockId)
    if (!block) return

    switch (action) {
      case 'turn-paragraph':
        editor.updateBlock(block, { type: 'paragraph', props: {} })
        break
      case 'turn-h1':
        editor.updateBlock(block, { type: 'heading', props: { level: 1 } } as any)
        break
      case 'turn-h2':
        editor.updateBlock(block, { type: 'heading', props: { level: 2 } } as any)
        break
      case 'turn-h3':
        editor.updateBlock(block, { type: 'heading', props: { level: 3 } } as any)
        break
      case 'turn-bullet':
        editor.updateBlock(block, { type: 'bulletListItem', props: {} } as any)
        break
      case 'turn-numbered':
        editor.updateBlock(block, { type: 'numberedListItem', props: {} } as any)
        break
      case 'turn-quote':
        editor.updateBlock(block, { type: 'quote', props: {} } as any)
        break
      case 'turn-code':
        editor.updateBlock(block, { type: 'codeBlock', props: {} } as any)
        break
      case 'duplicate': {
        // Deep clone without id so BlockNote assigns a new one
        const { id: _id, ...rest } = block as any
        editor.insertBlocks([rest], block, 'after')
        break
      }
      case 'delete':
        editor.removeBlocks([block])
        break
      case 'move-up': {
        const all = editor.document
        const idx = all.findIndex(b => b.id === blockId)
        if (idx > 0) {
          const prev = all[idx - 1]!
          editor.removeBlocks([block])
          const fresh = editor.getBlock(prev.id)
          if (fresh) editor.insertBlocks([{ ...block }], fresh, 'before')
        }
        break
      }
      case 'move-down': {
        const all = editor.document
        const idx = all.findIndex(b => b.id === blockId)
        if (idx >= 0 && idx < all.length - 1) {
          const next = all[idx + 1]!
          editor.removeBlocks([block])
          const fresh = editor.getBlock(next.id)
          if (fresh) editor.insertBlocks([{ ...block }], fresh, 'after')
        }
        break
      }
    }
  }

  // --- Menu HTML ---
  function buildMenuHTML(type: string, level?: number): string {
    const items = TURN_INTO.map(item => {
      const active = item.type === type && (item.level === undefined || item.level === level)
      return `<button class="od-bm-item${active ? ' active' : ''}" data-action="${item.action}" role="menuitem">
        ${item.label}
      </button>`
    }).join('')

    return `
      <div class="od-bm-label">Turn into</div>
      ${items}
      <div class="od-bm-sep"></div>
      <button class="od-bm-item" data-action="move-up" role="menuitem">↑&nbsp; Move Up</button>
      <button class="od-bm-item" data-action="move-down" role="menuitem">↓&nbsp; Move Down</button>
      <button class="od-bm-item" data-action="duplicate" role="menuitem">⧉&nbsp; Duplicate</button>
      <div class="od-bm-sep"></div>
      <button class="od-bm-item danger" data-action="delete" role="menuitem">🗑&nbsp; Delete</button>
    `
  }

  // --- Cleanup ---
  return () => {
    handle.remove()
    menu.remove()
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onEsc)
  }
}
