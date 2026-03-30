// Theme presets for OpenDoc
// Each preset is a Record<string, string> of --od-xxx → value

export interface ThemePreset {
  id: string
  name: string
  description: string
  vars: Record<string, string>
  darkVars?: Record<string, string>
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'System font, blue accent, clean',
    vars: {},
    darkVars: {},
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'More whitespace, lighter borders, subtle accent',
    vars: {
      '--od-color-bg': '#ffffff',
      '--od-color-surface': '#fafafa',
      '--od-color-surface-2': '#f3f3f3',
      '--od-color-border': '#ececec',
      '--od-color-text': '#2c2c2c',
      '--od-color-text-muted': '#999999',
      '--od-color-accent': '#666666',
      '--od-color-accent-hover': '#444444',
      '--od-content-max': '680px',
      '--od-line-height': '1.85',
      '--od-radius': '4px',
    },
    darkVars: {
      '--od-color-bg': '#111111',
      '--od-color-surface': '#191919',
      '--od-color-surface-2': '#222222',
      '--od-color-border': '#2a2a2a',
      '--od-color-text': '#d4d4d4',
      '--od-color-text-muted': '#777777',
      '--od-color-accent': '#a0a0a0',
      '--od-color-accent-hover': '#cccccc',
    },
  },
  {
    id: 'serif',
    name: 'Serif',
    description: 'Georgia body, heavier headings, warm tones',
    vars: {
      '--od-font-body': 'Georgia, "Times New Roman", serif',
      '--od-font-h1': '"Palatino Linotype", Palatino, Georgia, serif',
      '--od-font-h2': '"Palatino Linotype", Palatino, Georgia, serif',
      '--od-font-h3': '"Palatino Linotype", Palatino, Georgia, serif',
      '--od-color-bg': '#faf8f5',
      '--od-color-surface': '#f3efe8',
      '--od-color-surface-2': '#e8e2d8',
      '--od-color-border': '#ddd5c8',
      '--od-color-text': '#2a2520',
      '--od-color-text-muted': '#8c7e6e',
      '--od-color-accent': '#9b4d2e',
      '--od-color-accent-hover': '#7a3b22',
      '--od-font-size-base': '1.05rem',
      '--od-line-height': '1.8',
      '--od-font-weight-h1': '700',
      '--od-font-weight-h2': '700',
      '--od-content-max': '700px',
    },
    darkVars: {
      '--od-color-bg': '#1a1714',
      '--od-color-surface': '#242019',
      '--od-color-surface-2': '#302b22',
      '--od-color-border': '#3d3528',
      '--od-color-text': '#dcd4c8',
      '--od-color-text-muted': '#9a8e7e',
      '--od-color-accent': '#d4845a',
      '--od-color-accent-hover': '#e09b70',
    },
  },
  {
    id: 'dark-first',
    name: 'Dark-first',
    description: 'Dark background as the default theme',
    vars: {
      '--od-color-bg': '#0d1117',
      '--od-color-surface': '#161b22',
      '--od-color-surface-2': '#21262d',
      '--od-color-border': '#30363d',
      '--od-color-text': '#e6edf3',
      '--od-color-text-muted': '#8b949e',
      '--od-color-accent': '#58a6ff',
      '--od-color-accent-hover': '#79b8ff',
      '--od-color-code-bg': '#161b22',
      '--od-color-code-inline-bg': '#1e2430',
    },
    darkVars: {
      '--od-color-bg': '#0d1117',
      '--od-color-surface': '#161b22',
      '--od-color-surface-2': '#21262d',
      '--od-color-border': '#30363d',
      '--od-color-text': '#e6edf3',
      '--od-color-text-muted': '#8b949e',
      '--od-color-accent': '#58a6ff',
      '--od-color-accent-hover': '#79b8ff',
    },
  },
  {
    id: 'dense',
    name: 'Dense',
    description: 'Smaller font, tighter spacing, narrower sidebar',
    vars: {
      '--od-font-size-base': '0.9rem',
      '--od-line-height': '1.6',
      '--od-sidebar-width': '220px',
      '--od-content-max': '800px',
      '--od-font-size-h1': '2rem',
      '--od-font-size-h2': '1.35rem',
      '--od-font-size-h3': '1.1rem',
      '--od-font-body': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      '--od-radius': '4px',
    },
    darkVars: {},
  },
]

// All the CSS variable keys the theme system manages
export const THEME_VARS = {
  // Colors
  '--od-color-bg': '#ffffff',
  '--od-color-surface': '#f8f9fa',
  '--od-color-surface-2': '#e9ecef',
  '--od-color-border': '#e1e4e8',
  '--od-color-text': '#1a1a2e',
  '--od-color-text-muted': '#6b7280',
  '--od-color-accent': '#0969da',
  '--od-color-accent-hover': '#0550ae',
  '--od-color-code-bg': '#f6f8fa',
  '--od-color-code-inline-bg': '#f0f2f5',
  '--od-color-callout-note': '#0969da',
  '--od-color-callout-tip': '#1a7f37',
  '--od-color-callout-warning': '#d1242f',
  '--od-color-callout-important': '#8250df',
  // Typography
  '--od-font-body': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  '--od-font-heading': 'inherit',
  '--od-font-h1': 'inherit',
  '--od-font-h2': 'inherit',
  '--od-font-h3': 'inherit',
  '--od-font-mono': '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  '--od-font-size-base': '1rem',
  '--od-font-size-code': '0.875em',
  '--od-font-size-h1': '2.5rem',
  '--od-font-size-h2': '1.5rem',
  '--od-font-size-h3': '1.2rem',
  '--od-font-weight-body': '400',
  '--od-font-weight-h1': '700',
  '--od-font-weight-h2': '600',
  '--od-font-weight-h3': '600',
  '--od-line-height': '1.75',
  // Layout
  '--od-sidebar-width': '260px',
  '--od-header-height': '48px',
  '--od-content-max': '720px',
  '--od-radius': '6px',
  '--od-transition': '200ms ease',
} as const

export const DARK_DEFAULTS: Record<string, string> = {
  '--od-color-bg': '#0f0f0f',
  '--od-color-surface': '#1a1a1a',
  '--od-color-surface-2': '#252525',
  '--od-color-text': '#e5e5e5',
  '--od-color-text-muted': '#9ca3af',
  '--od-color-border': '#2a2a2a',
  '--od-color-accent': '#58a6ff',
  '--od-color-accent-hover': '#79b8ff',
  '--od-color-code-bg': '#161b22',
  '--od-color-code-inline-bg': '#1e2430',
  '--od-color-callout-note': '#58a6ff',
  '--od-color-callout-tip': '#3fb950',
  '--od-color-callout-warning': '#f85149',
  '--od-color-callout-important': '#a371f7',
}

/** Apply a set of CSS variable overrides to document root */
export function applyVars(vars: Record<string, string>): void {
  const el = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value)
  }
}

/** Clear all inline CSS variable overrides */
export function clearVars(): void {
  const el = document.documentElement
  for (const key of Object.keys(THEME_VARS)) {
    el.style.removeProperty(key)
  }
  for (const key of Object.keys(DARK_DEFAULTS)) {
    el.style.removeProperty(key)
  }
}

/** Apply a preset by ID */
export function applyPreset(presetId: string): void {
  const preset = THEME_PRESETS.find(p => p.id === presetId)
  if (!preset) return

  clearVars()
  if (preset.id !== 'default') {
    applyVars(preset.vars)
  }
}

/** Generate CSS string from current overrides */
export function generateThemeCss(lightOverrides: Record<string, string>, darkOverrides: Record<string, string>): string {
  const lines: string[] = []

  const lightEntries = Object.entries(lightOverrides).filter(([, v]) => v)
  if (lightEntries.length > 0) {
    lines.push(':root {')
    for (const [key, value] of lightEntries) {
      lines.push(`  ${key}: ${value};`)
    }
    lines.push('}')
  }

  const darkEntries = Object.entries(darkOverrides).filter(([, v]) => v)
  if (darkEntries.length > 0) {
    lines.push('[data-theme="dark"] {')
    for (const [key, value] of darkEntries) {
      lines.push(`  ${key}: ${value};`)
    }
    lines.push('}')
  }

  return lines.join('\n')
}

/** Save theme CSS to server */
export async function saveTheme(css: string): Promise<void> {
  await fetch('/_opendoc/theme', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ css }),
  })
}

/** Delete saved theme from server */
export async function deleteTheme(): Promise<void> {
  await fetch('/_opendoc/theme', { method: 'DELETE' })
}

/** Load saved theme CSS from server */
export async function loadTheme(): Promise<string> {
  const res = await fetch('/_opendoc/theme')
  const data = await res.json()
  return data.css || ''
}
