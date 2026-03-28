// Theme management for OpenDoc

type ThemeMode = "light" | "dark" | "both"

interface Theme {
  id: string
  name: string
  author: string
  description: string
  tags: string[]
  mode: ThemeMode
  css: string          // light CSS (or fixed CSS if mode !== "both")
  darkCss?: string     // only present if mode === "both"
  source?: string
}

const BUILTIN_THEMES: Theme[] = [
  {
    id: "default",
    name: "Default",
    author: "OpenDoc",
    description: "Clean and minimal",
    tags: ["minimal"],
    mode: "both",
    css: `:root {
  /* Default theme — uses base variables */
}`,
    darkCss: `[data-theme="dark"] {
  /* Default dark — uses base dark variables */
}`
  },
  {
    id: "clean",
    name: "Clean",
    author: "OpenDoc",
    description: "GitBook-inspired clean layout",
    tags: ["minimal", "popular"],
    mode: "both",
    css: `:root {
  --od-color-bg: #ffffff;
  --od-color-surface: #f7f7f7;
  --od-color-surface-2: #eeeeee;
  --od-color-accent: #4f46e5;
  --od-color-accent-hover: #4338ca;
  --od-font-body: "Inter", -apple-system, sans-serif;
  --od-content-max: 760px;
}`,
    darkCss: `[data-theme="dark"] {
  --od-color-bg: #111318;
  --od-color-surface: #1a1d24;
  --od-color-surface-2: #252830;
  --od-color-text: #e0e0e0;
  --od-color-text-muted: #9098a8;
  --od-color-accent: #818cf8;
  --od-color-accent-hover: #a5b4fc;
  --od-color-border: #2d3140;
}`
  },
  {
    id: "prose",
    name: "Prose",
    author: "OpenDoc",
    description: "Notion-inspired full-width reading layout",
    tags: ["serif", "full-width"],
    mode: "both",
    css: `:root {
  --od-color-bg: #ffffff;
  --od-color-surface: #f9f9f9;
  --od-color-surface-2: #f0f0f0;
  --od-font-body: "Georgia", "Times New Roman", serif;
  --od-content-max: 900px;
  --od-font-size: 17px;
  --od-line-height: 1.9;
}`,
    darkCss: `[data-theme="dark"] {
  --od-color-bg: #191919;
  --od-color-surface: #222222;
  --od-color-surface-2: #2c2c2c;
  --od-color-text: #d4d4d4;
  --od-color-text-muted: #9a9a9a;
  --od-color-accent: #6d9eeb;
  --od-color-accent-hover: #93b8f0;
  --od-color-border: #333333;
}`
  },
  {
    id: "dark",
    name: "Dark",
    author: "OpenDoc",
    description: "Dark background, light text",
    tags: ["dark"],
    mode: "dark",
    css: `[data-theme="dark"] {
  --od-color-bg: #0d1117;
  --od-color-surface: #161b22;
  --od-color-surface-2: #21262d;
  --od-color-text: #e6edf3;
  --od-color-text-muted: #8b949e;
  --od-color-accent: #58a6ff;
  --od-color-accent-hover: #79b8ff;
  --od-color-border: #30363d;
  --od-font-body: "Inter", -apple-system, sans-serif;
}`
  },
  {
    id: "mono",
    name: "Mono",
    author: "OpenDoc",
    description: "Monospace everything, developer aesthetic",
    tags: ["dark", "mono", "terminal"],
    mode: "dark",
    css: `[data-theme="dark"] {
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
}`
  }
]

class ThemeManager {
  private currentTheme: Theme
  private previewTheme: Theme | null = null
  private beforePreviewTheme: Theme | null = null
  private styleEl: HTMLStyleElement
  private cssEditTab: "light" | "dark" = "light"
  private customCss: { light: string; dark: string } = { light: "", dark: "" }

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
    this.applyThemeCSS(theme)
    this.updateDarkModeState(theme)
  }

  private applyThemeCSS(theme: Theme): void {
    if (theme.mode === "both") {
      this.styleEl.textContent = (this.customCss.light || theme.css) + "\n" + (this.customCss.dark || theme.darkCss || "")
    } else {
      this.styleEl.textContent = this.customCss.light || this.customCss.dark || theme.css
    }
  }

  private updateDarkModeState(theme: Theme): void {
    const html = document.documentElement
    const toggle = document.getElementById('dark-mode-toggle')

    if (theme.mode === "dark") {
      html.setAttribute('data-theme', 'dark')
      html.setAttribute('data-mode', 'dark')
      if (toggle) toggle.style.display = 'none'
    } else if (theme.mode === "light") {
      html.removeAttribute('data-theme')
      html.setAttribute('data-mode', 'light')
      if (toggle) toggle.style.display = 'none'
    } else {
      // "both" — restore user preference
      html.removeAttribute('data-mode')
      if (toggle) toggle.style.display = ''
      const saved = localStorage.getItem('theme')
      if (saved === 'dark') {
        html.setAttribute('data-theme', 'dark')
      } else {
        html.setAttribute('data-theme', 'light')
      }
    }
  }

  preview(theme: Theme): void {
    if (!this.previewTheme) {
      this.beforePreviewTheme = this.currentTheme
    }
    this.previewTheme = theme
    this.applyThemeCSS(theme)
    this.updateDarkModeState(theme)
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

  getActiveTheme(): Theme {
    return this.previewTheme || this.currentTheme
  }

  getEditableCSS(tab: "light" | "dark"): string {
    if (this.customCss[tab]) return this.customCss[tab]
    const theme = this.getActiveTheme()
    if (theme.mode === "both") return tab === "light" ? theme.css : (theme.darkCss || "")
    return theme.css
  }

  setCssEditTab(tab: "light" | "dark"): void {
    this.cssEditTab = tab
  }

  getCssEditTab(): "light" | "dark" {
    return this.cssEditTab
  }

  applyCustomCSS(css: string, tab: "light" | "dark"): void {
    this.customCss[tab] = css
    this.applyThemeCSS(this.getActiveTheme())
  }

  getCustomCSS(): string {
    return this.styleEl.textContent || ''
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

function modeBadge(mode: ThemeMode): string {
  const labels: Record<ThemeMode, string> = {
    both: "light + dark",
    light: "light only",
    dark: "dark only"
  }
  return `<span class="od-theme-mode-badge od-mode-${mode}">${labels[mode]}</span>`
}

function renderThemeCard(theme: Theme, isActive: boolean): string {
  const activeClass = isActive ? ' active' : ''
  const tags = theme.tags.map(t => `<span class="od-theme-tag">${t}</span>`).join('')
  return `<div class="od-theme-card${activeClass}" data-theme-id="${theme.id}">
    <div class="od-theme-card-header">
      <div class="od-theme-card-name">${theme.name}</div>
      ${modeBadge(theme.mode)}
    </div>
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
  const cssTabs = document.getElementById('css-tabs')
  const cssTabLight = document.getElementById('css-tab-light')
  const cssTabDark = document.getElementById('css-tab-dark')

  if (!grid) return

  const manager = new ThemeManager()

  function renderGrid(query: string = '') {
    const filtered = filterThemes(BUILTIN_THEMES, query)
    grid!.innerHTML = filtered.map(t => renderThemeCard(t, t.id === manager.getCurrentId())).join('')

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

  function updateCssTabs() {
    const theme = manager.getActiveTheme()
    if (cssTabs) {
      cssTabs.style.display = theme.mode === "both" ? "flex" : "none"
    }
    // If theme is not "both", reset tab to default
    if (theme.mode !== "both") {
      manager.setCssEditTab("light")
    }
    // Update active tab styling
    const tab = manager.getCssEditTab()
    cssTabLight?.classList.toggle('active', tab === 'light')
    cssTabDark?.classList.toggle('active', tab === 'dark')
  }

  function updateUI() {
    renderGrid((searchInput as HTMLInputElement)?.value || '')
    if (actions) {
      actions.style.display = manager.isPreviewing() ? 'flex' : 'none'
    }
    updateCssTabs()
    if (cssEditor) {
      cssEditor.value = manager.getEditableCSS(manager.getCssEditTab())
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

  // CSS tab switching
  cssTabLight?.addEventListener('click', () => {
    manager.setCssEditTab('light')
    updateCssTabs()
    if (cssEditor) {
      cssEditor.value = manager.getEditableCSS('light')
    }
  })

  cssTabDark?.addEventListener('click', () => {
    manager.setCssEditTab('dark')
    updateCssTabs()
    if (cssEditor) {
      cssEditor.value = manager.getEditableCSS('dark')
    }
  })

  // CSS editor
  cssEditor?.addEventListener('input', () => {
    manager.applyCustomCSS(cssEditor.value, manager.getCssEditTab())
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
    manager.applyCustomCSS(savedCustom, manager.getCssEditTab())
  }

  // Initial render
  renderGrid()
  updateCssTabs()
  if (cssEditor) {
    cssEditor.value = manager.getEditableCSS(manager.getCssEditTab())
  }
}
