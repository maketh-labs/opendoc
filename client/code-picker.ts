// OpenDoc Code Block Language Picker — for /editor route only

interface Language {
  id: string
  label: string
  aliases?: string[]
}

const LANGUAGES: Language[] = [
  { id: "javascript", label: "JavaScript", aliases: ["js"] },
  { id: "typescript", label: "TypeScript", aliases: ["ts"] },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "bash", label: "Bash / Shell", aliases: ["sh", "shell"] },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML", aliases: ["yml"] },
  { id: "sql", label: "SQL" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "java", label: "Java" },
  { id: "markdown", label: "Markdown", aliases: ["md"] },
  { id: "plaintext", label: "Plain text", aliases: ["text"] },
]

let dropdown: HTMLDivElement | null = null
let activeIndex = 0
let backtickStart = -1
let filteredLangs: Language[] = []

function createDropdown(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'od-code-picker'
  el.style.cssText = `
    position: fixed;
    z-index: 9999;
    background: var(--od-color-surface, #fff);
    border: 1px solid var(--od-color-border, #e5e5e5);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    max-height: 240px;
    overflow-y: auto;
    width: 220px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  `
  document.body.appendChild(el)
  return el
}

function renderDropdown(langs: Language[], active: number): void {
  if (!dropdown) return
  dropdown.innerHTML = langs.map((lang, i) => `
    <div class="od-code-item${i === active ? ' od-code-active' : ''}" data-index="${i}" style="
      padding: 6px 12px;
      cursor: pointer;
      ${i === active ? 'background: var(--od-color-accent, #0066ff); color: #fff;' : ''}
    ">
      <span style="font-weight: 500;">${lang.label}</span>
      <span style="font-size: 12px; opacity: 0.6; margin-left: 6px;">${lang.id}</span>
    </div>
  `).join('')

  const activeEl = dropdown.querySelector('.od-code-active') as HTMLElement | null
  activeEl?.scrollIntoView({ block: 'nearest' })
}

function positionDropdown(textarea: HTMLTextAreaElement): void {
  if (!dropdown) return
  const rect = textarea.getBoundingClientRect()
  const text = textarea.value.substring(0, textarea.selectionStart)
  const lines = text.split('\n')
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20
  const lineNum = lines.length - 1
  const scrollTop = textarea.scrollTop

  const top = rect.top + (lineNum * lineHeight) - scrollTop + lineHeight + 4
  const left = rect.left + 40

  dropdown.style.top = `${Math.min(top, window.innerHeight - 260)}px`
  dropdown.style.left = `${left}px`
}

function dismiss(): void {
  if (dropdown) {
    dropdown.remove()
    dropdown = null
  }
  backtickStart = -1
  filteredLangs = []
}

function selectLanguage(textarea: HTMLTextAreaElement, lang: Language): void {
  // Replace from backtick position to current cursor
  const before = textarea.value.substring(0, backtickStart)
  const after = textarea.value.substring(textarea.selectionStart)

  const insertText = '```' + lang.id + '\n\n```'
  textarea.value = before + insertText + after

  // Place cursor inside the code block (after the opening line)
  const cursorPos = backtickStart + ('```' + lang.id + '\n').length
  textarea.selectionStart = textarea.selectionEnd = cursorPos

  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  dismiss()
}

function filterLanguages(query: string): Language[] {
  if (!query) return LANGUAGES
  const q = query.toLowerCase()
  return LANGUAGES.filter(lang =>
    lang.id.includes(q) ||
    lang.label.toLowerCase().includes(q) ||
    (lang.aliases?.some(a => a.includes(q)) ?? false)
  )
}

export function initCodePicker(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!dropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex = Math.min(activeIndex + 1, filteredLangs.length - 1)
      renderDropdown(filteredLangs, activeIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex = Math.max(activeIndex - 1, 0)
      renderDropdown(filteredLangs, activeIndex)
    } else if (e.key === 'Enter') {
      if (filteredLangs.length > 0) {
        e.preventDefault()
        selectLanguage(textarea, filteredLangs[activeIndex]!)
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

    // Check if line starts with ``` (with optional language filter after)
    const match = lineText.match(/^```(\w*)$/)
    if (match) {
      backtickStart = lineStart
      const query = match[1] || ''
      filteredLangs = filterLanguages(query)
      activeIndex = 0

      if (filteredLangs.length > 0) {
        if (!dropdown) dropdown = createDropdown()
        positionDropdown(textarea)
        renderDropdown(filteredLangs, activeIndex)
      } else {
        dismiss()
      }
    } else if (dropdown) {
      dismiss()
    }
  })

  document.addEventListener('click', (e: MouseEvent) => {
    if (!dropdown) return
    const item = (e.target as HTMLElement).closest('.od-code-item') as HTMLElement | null
    if (item && dropdown.contains(item)) {
      const idx = parseInt(item.dataset.index || '0', 10)
      selectLanguage(textarea, filteredLangs[idx]!)
    } else if (!dropdown.contains(e.target as HTMLElement)) {
      dismiss()
    }
  })

  textarea.addEventListener('blur', () => {
    setTimeout(dismiss, 200)
  })
}
