// OpenDoc Slash Command Palette — for /editor route only

interface SlashCommand {
  id: string
  label: string
  description: string
  icon: string
  insert: string
  keywords: string[]
}

const COMMANDS: SlashCommand[] = [
  { id: "h1", label: "Heading 1", icon: "H1", description: "Large section heading", insert: "# {{cursor}}", keywords: ["heading", "h1", "title"] },
  { id: "h2", label: "Heading 2", icon: "H2", description: "Medium section heading", insert: "## {{cursor}}", keywords: ["heading", "h2"] },
  { id: "h3", label: "Heading 3", icon: "H3", description: "Small section heading", insert: "### {{cursor}}", keywords: ["heading", "h3"] },
  { id: "note", label: "Note callout", icon: "ℹ️", description: "Info callout box", insert: "> [!NOTE]\n> {{cursor}}", keywords: ["note", "callout", "info"] },
  { id: "tip", label: "Tip callout", icon: "💡", description: "Tip callout box", insert: "> [!TIP]\n> {{cursor}}", keywords: ["tip", "callout"] },
  { id: "warning", label: "Warning callout", icon: "⚠️", description: "Warning callout box", insert: "> [!WARNING]\n> {{cursor}}", keywords: ["warning", "callout"] },
  { id: "danger", label: "Danger callout", icon: "🚫", description: "Danger callout box", insert: "> [!DANGER]\n> {{cursor}}", keywords: ["danger", "callout"] },
  { id: "code", label: "Code block", icon: "```", description: "Code with syntax highlighting", insert: "```{{cursor}}\n\n```", keywords: ["code", "block", "snippet"] },
  { id: "table", label: "Table", icon: "⊞", description: "Insert a table", insert: "| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| {{cursor}} | | |", keywords: ["table", "grid"] },
  { id: "image", label: "Image", icon: "🖼", description: "Insert an image", insert: "![Alt text](./assets/{{cursor}})\n*Caption*", keywords: ["image", "photo", "picture"] },
  { id: "math", label: "Math block", icon: "∑", description: "LaTeX math block", insert: "$$\n{{cursor}}\n$$", keywords: ["math", "latex", "equation"] },
  { id: "divider", label: "Divider", icon: "—", description: "Horizontal rule", insert: "\n---\n{{cursor}}", keywords: ["divider", "hr", "rule"] },
  { id: "wikilink", label: "Link to page", icon: "🔗", description: "Link to another doc page", insert: "[[{{cursor}}]]", keywords: ["link", "page", "wiki"] },
  { id: "toggle", label: "Toggle", icon: "▶", description: "Collapsible section", insert: "<details>\n<summary>{{cursor}}</summary>\n\nContent here\n\n</details>", keywords: ["toggle", "collapse", "details"] },
]

let dropdown: HTMLDivElement | null = null
let activeIndex = 0
let slashStart = -1
let filteredCommands: SlashCommand[] = []

function createDropdown(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'od-slash-dropdown'
  el.style.cssText = `
    position: fixed;
    z-index: 9999;
    background: var(--od-color-surface, #fff);
    border: 1px solid var(--od-color-border, #e5e5e5);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    max-height: 280px;
    overflow-y: auto;
    width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  `
  document.body.appendChild(el)
  return el
}

function renderDropdown(commands: SlashCommand[], active: number): void {
  if (!dropdown) return
  dropdown.innerHTML = commands.map((cmd, i) => `
    <div class="od-slash-item${i === active ? ' od-slash-active' : ''}" data-index="${i}" style="
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      cursor: pointer;
      ${i === active ? 'background: var(--od-color-accent, #0066ff); color: #fff;' : ''}
    ">
      <span style="width: 28px; text-align: center; font-size: 16px; flex-shrink: 0;">${cmd.icon}</span>
      <div style="min-width: 0;">
        <div style="font-weight: 500;">${cmd.label}</div>
        <div style="font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cmd.description}</div>
      </div>
    </div>
  `).join('')

  // Scroll active item into view
  const activeEl = dropdown.querySelector('.od-slash-active') as HTMLElement | null
  activeEl?.scrollIntoView({ block: 'nearest' })
}

function positionDropdown(textarea: HTMLTextAreaElement): void {
  if (!dropdown) return
  // Approximate cursor position
  const rect = textarea.getBoundingClientRect()
  const text = textarea.value.substring(0, textarea.selectionStart)
  const lines = text.split('\n')
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20
  const lineNum = lines.length - 1
  const scrollTop = textarea.scrollTop

  const top = rect.top + (lineNum * lineHeight) - scrollTop + lineHeight + 4
  const left = rect.left + 16

  dropdown.style.top = `${Math.min(top, window.innerHeight - 300)}px`
  dropdown.style.left = `${left}px`
}

function dismiss(): void {
  if (dropdown) {
    dropdown.remove()
    dropdown = null
  }
  slashStart = -1
  filteredCommands = []
}

function insertCommand(textarea: HTMLTextAreaElement, cmd: SlashCommand): void {
  const before = textarea.value.substring(0, slashStart)
  const after = textarea.value.substring(textarea.selectionStart)

  const snippet = cmd.insert
  const cursorMarker = '{{cursor}}'
  const cursorPos = snippet.indexOf(cursorMarker)

  const insertText = snippet.replace(cursorMarker, '')
  textarea.value = before + insertText + after

  // Place cursor
  const newPos = cursorPos >= 0 ? slashStart + cursorPos : slashStart + insertText.length
  textarea.selectionStart = textarea.selectionEnd = newPos

  // Trigger input event for live preview
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  dismiss()
}

function filterCommands(query: string): SlashCommand[] {
  if (!query) return COMMANDS
  const q = query.toLowerCase()
  return COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(q) ||
    cmd.id.includes(q) ||
    cmd.keywords.some(k => k.includes(q))
  )
}

export function initSlashCommands(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!dropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex = Math.min(activeIndex + 1, filteredCommands.length - 1)
      renderDropdown(filteredCommands, activeIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex = Math.max(activeIndex - 1, 0)
      renderDropdown(filteredCommands, activeIndex)
    } else if (e.key === 'Enter') {
      if (filteredCommands.length > 0) {
        e.preventDefault()
        insertCommand(textarea, filteredCommands[activeIndex]!)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      dismiss()
    }
  })

  textarea.addEventListener('input', () => {
    const pos = textarea.selectionStart
    const text = textarea.value
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1
    const lineText = text.substring(lineStart, pos)

    // Check if we have a slash at line start
    if (lineText.startsWith('/')) {
      const query = lineText.substring(1)

      if (slashStart === -1) {
        slashStart = lineStart
      }

      filteredCommands = filterCommands(query)
      activeIndex = 0

      if (filteredCommands.length > 0) {
        if (!dropdown) dropdown = createDropdown()
        positionDropdown(textarea)
        renderDropdown(filteredCommands, activeIndex)
      } else {
        dismiss()
      }
    } else if (dropdown) {
      dismiss()
    }
  })

  // Click handler for dropdown items
  document.addEventListener('click', (e: MouseEvent) => {
    if (!dropdown) return
    const item = (e.target as HTMLElement).closest('.od-slash-item') as HTMLElement | null
    if (item && dropdown.contains(item)) {
      const idx = parseInt(item.dataset.index || '0', 10)
      insertCommand(textarea, filteredCommands[idx]!)
    } else if (!dropdown.contains(e.target as HTMLElement)) {
      dismiss()
    }
  })

  // Dismiss on blur
  textarea.addEventListener('blur', () => {
    setTimeout(dismiss, 200)
  })
}
