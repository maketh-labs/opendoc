/**
 * Vanilla-JS slash command menu for BlockNote.
 * Subscribes to the built-in SuggestionMenu extension store,
 * renders a custom dropdown, and calls editor actions directly.
 */
import type { BlockNoteEditor } from '@blocknote/core'
import { SuggestionMenu, getDefaultSlashMenuItems, filterSuggestionItems } from '@blocknote/core/extensions'
import type { DefaultSuggestionItem } from '@blocknote/core/extensions'

export function initBlockNoteSlashMenu(editor: BlockNoteEditor): () => void {
  // Get the SuggestionMenu extension instance
  const ext = editor.getExtension(SuggestionMenu as any) as any
  if (!ext) return () => {}

  // Register '/' as the trigger character
  ext.addSuggestionMenu({ triggerCharacter: '/' })

  // Build the dropdown element
  const dropdown = document.createElement('div')
  dropdown.className = 'od-slash-menu'
  dropdown.setAttribute('role', 'listbox')
  dropdown.style.display = 'none'
  document.body.appendChild(dropdown)

  let items: DefaultSuggestionItem[] = []
  let activeIndex = 0

  function render(query: string, refRect: DOMRect): void {
    const allItems = getDefaultSlashMenuItems(editor as any)
    items = filterSuggestionItems(allItems, query) as DefaultSuggestionItem[]
    activeIndex = 0

    if (!items.length) {
      dropdown.style.display = 'none'
      return
    }

    dropdown.innerHTML = items.map((item, i) => `
      <div class="od-sm-item${i === activeIndex ? ' active' : ''}" data-index="${i}" role="option">
        <span class="od-sm-icon">${item.icon ?? ''}</span>
        <span class="od-sm-text">
          <span class="od-sm-title">${item.title}</span>
          ${item.subtext ? `<span class="od-sm-sub">${item.subtext}</span>` : ''}
        </span>
      </div>
    `).join('')

    // Position below cursor
    let top = refRect.bottom + window.scrollY + 4
    let left = refRect.left + window.scrollX

    dropdown.style.display = 'block'

    // Clamp to viewport
    requestAnimationFrame(() => {
      const mr = dropdown.getBoundingClientRect()
      if (mr.right > window.innerWidth - 8) left = window.innerWidth - mr.width - 8
      if (mr.bottom > window.innerHeight - 8) top = refRect.top + window.scrollY - mr.height - 4
      dropdown.style.top = `${top}px`
      dropdown.style.left = `${left}px`
    })

    dropdown.style.top = `${top}px`
    dropdown.style.left = `${left}px`

    // Wire item clicks
    dropdown.querySelectorAll<HTMLElement>('[data-index]').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault() // don't blur editor
        const idx = parseInt(el.dataset.index!, 10)
        selectItem(idx)
      })
    })
  }

  function setActive(idx: number): void {
    activeIndex = Math.max(0, Math.min(idx, items.length - 1))
    dropdown.querySelectorAll<HTMLElement>('.od-sm-item').forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex)
      if (i === activeIndex) el.scrollIntoView({ block: 'nearest' })
    })
  }

  function selectItem(idx: number): void {
    const item = items[idx]
    if (!item) return
    ext.clearQuery()
    ext.closeMenu()
    item.onItemClick(editor as any)
  }

  function hide(): void {
    dropdown.style.display = 'none'
    items = []
  }

  // Subscribe to the extension store
  const unsubscribe = ext.store.subscribe(() => {
    const state = ext.store.state
    if (!state || !state.show || state.triggerCharacter !== '/') {
      hide()
      return
    }
    const refRect: DOMRect = state.referencePos ?? new DOMRect()
    render(state.query ?? '', refRect)
  })

  // Keyboard handling: intercept ArrowUp/Down/Enter/Escape when menu is open
  const onKeyDown = (e: KeyboardEvent) => {
    if (dropdown.style.display === 'none') return
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setActive(activeIndex + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setActive(activeIndex - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); selectItem(activeIndex) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ext.closeMenu(); hide() }
  }

  // Capture phase so we beat BlockNote's own key handlers
  document.addEventListener('keydown', onKeyDown, true)

  return () => {
    unsubscribe()
    document.removeEventListener('keydown', onKeyDown, true)
    dropdown.remove()
  }
}
