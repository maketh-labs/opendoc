// Theme management for OpenDoc

interface Theme {
  id: string
  name: string
  author: string
  description: string
  tags: string[]
  css: string
  source?: string
}

const BUILTIN_THEMES: Theme[] = [
  {
    id: "default",
    name: "Default",
    author: "OpenDoc",
    description: "Clean and minimal",
    tags: ["minimal", "light"],
    css: `/* Default theme — uses base variables */`
  },
  {
    id: "clean",
    name: "Clean",
    author: "OpenDoc",
    description: "GitBook-inspired clean layout",
    tags: ["minimal", "light", "popular"],
    css: `:root {
  --od-color-bg: #ffffff;
  --od-color-surface: #f7f7f7;
  --od-color-surface-2: #eeeeee;
  --od-color-accent: #4f46e5;
  --od-color-accent-hover: #4338ca;
  --od-font-body: "Inter", -apple-system, sans-serif;
  --od-content-max: 760px;
}`
  },
  {
    id: "dark",
    name: "Dark",
    author: "OpenDoc",
    description: "Dark background, light text",
    tags: ["dark"],
    css: `:root {
  --od-color-bg: #0d1117;
  --od-color-surface: #161b22;
  --od-color-surface-2: #21262d;
  --od-color-text: #e6edf3;
  --od-color-text-muted: #8b949e;
  --od-color-accent: #58a6ff;
  --od-color-accent-hover: #79b8ff;
  --od-color-border: #30363d;
  --od-font-body: "Inter", -apple-system, sans-serif;
}
[data-theme="dark"] {
  --od-color-bg: #0d1117;
  --od-color-surface: #161b22;
  --od-color-surface-2: #21262d;
  --od-color-text: #e6edf3;
  --od-color-text-muted: #8b949e;
  --od-color-accent: #58a6ff;
  --od-color-accent-hover: #79b8ff;
  --od-color-border: #30363d;
}`
  },
  {
    id: "prose",
    name: "Prose",
    author: "OpenDoc",
    description: "Notion-inspired full-width reading layout",
    tags: ["minimal", "serif", "full-width"],
    css: `:root {
  --od-color-bg: #ffffff;
  --od-color-surface: #f9f9f9;
  --od-color-surface-2: #f0f0f0;
  --od-font-body: "Georgia", "Times New Roman", serif;
  --od-content-max: 900px;
  --od-font-size: 17px;
  --od-line-height: 1.9;
}`
  },
  {
    id: "mono",
    name: "Mono",
    author: "OpenDoc",
    description: "Monospace everything, developer aesthetic",
    tags: ["dark", "mono", "terminal"],
    css: `:root {
  --od-color-bg: #0a0a0a;
  --od-color-surface: #141414;
  --od-color-surface-2: #1e1e1e;
  --od-color-text: #39ff14;
  --od-color-text-muted: #22aa0e;
  --od-color-accent: #39ff14;
  --od-color-accent-hover: #50ff30;
  --od-color-border: #1f1f1f;
  --od-font-body: "JetBrains Mono", "Fira Code", monospace;
  --od-font-mono: "JetBrains Mono", "Fira Code", monospace;
  --od-font-size: 13px;
}
[data-theme="dark"] {
  --od-color-bg: #0a0a0a;
  --od-color-surface: #141414;
  --od-color-surface-2: #1e1e1e;
  --od-color-text: #39ff14;
  --od-color-text-muted: #22aa0e;
  --od-color-accent: #39ff14;
  --od-color-accent-hover: #50ff30;
  --od-color-border: #1f1f1f;
}`
  }
]

class ThemeManager {
  private currentTheme: Theme
  private previewTheme: Theme | null = null
  private beforePreviewTheme: Theme | null = null
  private styleEl: HTMLStyleElement

  constructor() {
    this.styleEl = document.createElement('style')
    this.styleEl.id = 'od-theme-override'
    document.head.appendChild(this.styleEl)

    const savedId = localStorage.getItem('od-theme') || 'default'
    this.currentTheme = BUILTIN_THEMES.find(t => t.id === savedId) || BUILTIN_THEMES[0]!
    this.apply(this.currentTheme)
  }

  apply(theme: Theme): void {
    this.currentTheme = theme
    this.styleEl.textContent = theme.css
  }

  preview(theme: Theme): void {
    if (!this.previewTheme) {
      this.beforePreviewTheme = this.currentTheme
    }
    this.previewTheme = theme
    this.styleEl.textContent = theme.css
  }

  cancelPreview(): void {
    if (this.beforePreviewTheme) {
      this.apply(this.beforePreviewTheme)
    }
    this.previewTheme = null
    this.beforePreviewTheme = null
  }

  save(): void {
    if (this.previewTheme) {
      this.currentTheme = this.previewTheme
      this.previewTheme = null
      this.beforePreviewTheme = null
    }
    localStorage.setItem('od-theme', this.currentTheme.id)
  }

  getCustomCSS(): string {
    return this.styleEl.textContent || ''
  }

  applyCustomCSS(css: string): void {
    this.styleEl.textContent = css
  }

  getCurrentId(): string {
    return this.previewTheme?.id || this.currentTheme.id
  }

  isPreviewing(): boolean {
    return this.previewTheme !== null
  }
}

function filterThemes(themes: Theme[], query: string): Theme[] {
  if (!query.trim()) return themes
  const q = query.toLowerCase()
  return themes.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.includes(q))
  )
}

function renderThemeCard(theme: Theme, isActive: boolean): string {
  const activeClass = isActive ? ' active' : ''
  const tags = theme.tags.map(t => `<span class="od-theme-tag">${t}</span>`).join('')
  return `<div class="od-theme-card${activeClass}" data-theme-id="${theme.id}">
    <div class="od-theme-card-name">${theme.name}</div>
    <div class="od-theme-card-author">${theme.author}</div>
    <div class="od-theme-card-tags">${tags}</div>
  </div>`
}

export function initThemePanel(): void {
  const grid = document.getElementById('theme-grid')
  const searchInput = document.getElementById('theme-search-input') as HTMLInputElement | null
  const actions = document.getElementById('theme-actions')
  const cancelBtn = document.getElementById('theme-cancel')
  const saveBtn = document.getElementById('theme-save')
  const closeBtn = document.getElementById('close-right')
  const cssEditor = document.getElementById('css-editor') as HTMLTextAreaElement | null
  const cssReset = document.getElementById('css-reset')
  const cssCopy = document.getElementById('css-copy')
  const cssSave = document.getElementById('css-save')

  if (!grid) return

  const manager = new ThemeManager()

  function renderGrid(query: string = '') {
    const filtered = filterThemes(BUILTIN_THEMES, query)
    grid!.innerHTML = filtered.map(t => renderThemeCard(t, t.id === manager.getCurrentId())).join('')

    // Wire up card clicks
    grid!.querySelectorAll('.od-theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.themeId!
        const theme = BUILTIN_THEMES.find(t => t.id === id)
        if (!theme) return

        manager.preview(theme)
        updateUI()
      })
    })
  }

  function updateUI() {
    renderGrid((searchInput as HTMLInputElement)?.value || '')
    if (actions) {
      actions.style.display = manager.isPreviewing() ? 'flex' : 'none'
    }
    if (cssEditor) {
      cssEditor.value = manager.getCustomCSS()
    }
  }

  // Search
  searchInput?.addEventListener('input', () => {
    renderGrid(searchInput.value)
  })

  // Cancel preview
  cancelBtn?.addEventListener('click', () => {
    manager.cancelPreview()
    updateUI()
  })

  // Save theme
  saveBtn?.addEventListener('click', () => {
    manager.save()
    updateUI()
  })

  // Close right sidebar
  closeBtn?.addEventListener('click', () => {
    const layout = document.getElementById('od-layout')
    layout?.classList.remove('right-open')
    localStorage.setItem('od-right-open', 'false')
  })

  // CSS editor
  cssEditor?.addEventListener('input', () => {
    manager.applyCustomCSS(cssEditor.value)
  })

  cssReset?.addEventListener('click', () => {
    manager.cancelPreview()
    updateUI()
  })

  cssCopy?.addEventListener('click', () => {
    if (cssEditor) {
      navigator.clipboard.writeText(cssEditor.value)
    }
  })

  cssSave?.addEventListener('click', () => {
    manager.save()
    localStorage.setItem('od-custom-css', cssEditor?.value || '')
  })

  // Load custom CSS if saved
  const savedCustom = localStorage.getItem('od-custom-css')
  if (savedCustom) {
    manager.applyCustomCSS(savedCustom)
  }

  // Initial render
  renderGrid()
  if (cssEditor) {
    cssEditor.value = manager.getCustomCSS()
  }
}
