import React, { memo, useState, useEffect, useCallback, useRef } from 'react'
import {
  THEME_PRESETS,
  THEME_VARS,
  DARK_DEFAULTS,
  applyVars,
  clearVars,
  generateThemeCss,
  saveTheme,
  deleteTheme,
  loadTheme,
} from './themes'
import { initFaviconPanel } from './favicon'

// ─── Helpers ────────────────────────────────────────────

function getComputedVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function setVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value)
}

// ─── Collapsible Section ────────────────────────────────

function Section({ title, icon, defaultOpen, children }: {
  title: string
  icon: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="od-tp-section">
      <button
        className="od-tp-section-header"
        onClick={() => setOpen(!open)}
      >
        <span className="od-tp-section-icon">{icon}</span>
        <span className="od-tp-section-title">{title}</span>
        <span className={`od-tp-chevron ${open ? 'open' : ''}`}>&#9654;</span>
      </button>
      {open && <div className="od-tp-section-body">{children}</div>}
    </div>
  )
}

// ─── ColorPair ──────────────────────────────────────────

function ColorPair({ label, lightVar, darkVar, onChange }: {
  label: string
  lightVar: string
  darkVar: string
  onChange: () => void
}) {
  const [light, setLight] = useState(() => getComputedVar(lightVar) || (THEME_VARS as any)[lightVar] || '#000000')
  const [dark, setDark] = useState(() => getComputedVar(darkVar) || (DARK_DEFAULTS as any)[darkVar] || '#ffffff')

  useEffect(() => {
    setLight(getComputedVar(lightVar) || (THEME_VARS as any)[lightVar] || '#000000')
    setDark(getComputedVar(darkVar) || (DARK_DEFAULTS as any)[darkVar] || '#ffffff')
  }, [lightVar, darkVar])

  return (
    <div className="od-tp-row">
      <label className="od-tp-label">{label}</label>
      <div className="od-tp-color-pair">
        <div className="od-tp-color-input">
          <span className="od-tp-color-mode-label">L</span>
          <input
            type="color"
            value={normalizeColor(light)}
            onChange={e => {
              setLight(e.target.value)
              setVar(lightVar, e.target.value)
              onChange()
            }}
          />
        </div>
        <div className="od-tp-color-input">
          <span className="od-tp-color-mode-label">D</span>
          <input
            type="color"
            value={normalizeColor(dark)}
            onChange={e => {
              setDark(e.target.value)
              setVar(darkVar, e.target.value)
              onChange()
            }}
          />
        </div>
      </div>
    </div>
  )
}

function normalizeColor(c: string): string {
  if (!c || c === 'inherit' || c === 'transparent') return '#000000'
  if (c.startsWith('#') && (c.length === 4 || c.length === 7)) return c
  // Try to parse via canvas
  try {
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.fillStyle = c
    return ctx.fillStyle
  } catch {
    return '#000000'
  }
}

// ─── FontConfig ─────────────────────────────────────────

const FONT_SUGGESTIONS = [
  'System UI',
  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  '"Inter", sans-serif',
  'Georgia, serif',
  '"Merriweather", serif',
  '"JetBrains Mono", monospace',
]

const FONT_WEIGHTS = [
  { label: '300 Light', value: '300' },
  { label: '400 Regular', value: '400' },
  { label: '500 Medium', value: '500' },
  { label: '600 SemiBold', value: '600' },
  { label: '700 Bold', value: '700' },
]

function FontConfig({ label, familyVar, sizeVar, weightVar, lineHeightVar, onChange }: {
  label: string
  familyVar?: string
  sizeVar?: string
  weightVar?: string
  lineHeightVar?: string
  onChange: () => void
}) {
  const [family, setFamily] = useState(() => familyVar ? getComputedVar(familyVar) || '' : '')
  const [size, setSize] = useState(() => sizeVar ? getComputedVar(sizeVar) || '' : '')
  const [weight, setWeight] = useState(() => weightVar ? getComputedVar(weightVar) || '' : '')
  const [lh, setLh] = useState(() => lineHeightVar ? getComputedVar(lineHeightVar) || '' : '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="od-tp-font-config">
      <div className="od-tp-font-label">{label}</div>
      {familyVar && (
        <div className="od-tp-row" ref={suggestRef}>
          <label className="od-tp-label-sm">Family</label>
          <div className="od-tp-font-family-wrap">
            <input
              className="od-tp-input"
              value={family}
              placeholder="inherit"
              onFocus={() => setShowSuggestions(true)}
              onChange={e => {
                setFamily(e.target.value)
                setVar(familyVar, e.target.value || 'inherit')
                onChange()
              }}
            />
            {showSuggestions && (
              <div className="od-tp-suggestions">
                {FONT_SUGGESTIONS.map(f => (
                  <button
                    key={f}
                    className="od-tp-suggestion"
                    onMouseDown={e => {
                      e.preventDefault()
                      setFamily(f)
                      setVar(familyVar, f)
                      setShowSuggestions(false)
                      onChange()
                    }}
                  >
                    {f.split(',')[0].replace(/"/g, '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {sizeVar && (
        <div className="od-tp-row">
          <label className="od-tp-label-sm">Size</label>
          <input
            className="od-tp-input od-tp-input-sm"
            value={size}
            placeholder="1rem"
            onChange={e => {
              setSize(e.target.value)
              setVar(sizeVar, e.target.value)
              onChange()
            }}
          />
        </div>
      )}
      {weightVar && (
        <div className="od-tp-row">
          <label className="od-tp-label-sm">Weight</label>
          <select
            className="od-tp-select"
            value={weight}
            onChange={e => {
              setWeight(e.target.value)
              setVar(weightVar, e.target.value)
              onChange()
            }}
          >
            {FONT_WEIGHTS.map(w => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
      )}
      {lineHeightVar && (
        <div className="od-tp-row">
          <label className="od-tp-label-sm">Line height</label>
          <input
            className="od-tp-input od-tp-input-sm"
            type="number"
            step="0.05"
            min="1"
            max="3"
            value={lh}
            placeholder="1.75"
            onChange={e => {
              setLh(e.target.value)
              setVar(lineHeightVar, e.target.value)
              onChange()
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Slider Row ─────────────────────────────────────────

function SliderRow({ label, varName, min, max, unit, step, onChange }: {
  label: string
  varName: string
  min: number
  max: number
  unit: string
  step?: number
  onChange: () => void
}) {
  const [val, setVal] = useState(() => {
    const raw = getComputedVar(varName) || (THEME_VARS as any)[varName] || ''
    return parseInt(raw, 10) || min
  })

  return (
    <div className="od-tp-row">
      <label className="od-tp-label">{label}</label>
      <div className="od-tp-slider-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step ?? 1}
          value={val}
          className="od-tp-slider"
          onChange={e => {
            const v = Number(e.target.value)
            setVal(v)
            setVar(varName, `${v}${unit}`)
            onChange()
          }}
        />
        <span className="od-tp-slider-value">{val}{unit}</span>
      </div>
    </div>
  )
}

// ─── Main ThemePanel ────────────────────────────────────

export const ThemePanel = memo(function ThemePanel({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState('default')
  const [dirty, setDirty] = useState(false)
  const faviconInitRef = useRef(false)

  const markDirty = useCallback(() => setDirty(true), [])

  // Load saved theme on mount
  useEffect(() => {
    loadTheme().then(css => {
      if (css) {
        // Parse saved CSS and apply vars
        const lightMatch = css.match(/:root\s*\{([^}]+)\}/)
        const darkMatch = css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)
        if (lightMatch) {
          const vars = parseCssVars(lightMatch[1])
          applyVars(vars)
        }
        if (darkMatch) {
          const vars = parseCssVars(darkMatch[1])
          applyVars(vars)
        }
        setPreset('custom')
      }
    })
  }, [])

  // Init favicon panel
  useEffect(() => {
    if (faviconInitRef.current) return
    faviconInitRef.current = true
    initFaviconPanel()
  }, [])

  function handlePresetChange(id: string) {
    setPreset(id)
    clearVars()
    const p = THEME_PRESETS.find(pr => pr.id === id)
    if (p && p.id !== 'default') {
      applyVars(p.vars)
    }
    setDirty(true)
  }

  async function handleSave() {
    // Collect all overrides from inline styles
    const el = document.documentElement
    const lightOverrides: Record<string, string> = {}
    const darkOverrides: Record<string, string> = {}

    for (const key of Object.keys(THEME_VARS)) {
      const val = el.style.getPropertyValue(key).trim()
      if (val) lightOverrides[key] = val
    }
    for (const key of Object.keys(DARK_DEFAULTS)) {
      const val = el.style.getPropertyValue(key).trim()
      if (val) darkOverrides[key] = val
    }

    const css = generateThemeCss(lightOverrides, darkOverrides)
    await saveTheme(css)
    setDirty(false)
  }

  async function handleReset() {
    clearVars()
    await deleteTheme()
    setPreset('default')
    setDirty(false)
  }

  return (
    <div className="od-theme-panel">
      <div className="od-theme-panel-header">
        <h3>Theme</h3>
        <button className="od-close-btn" onClick={onClose}>&times;</button>
      </div>

      {/* Preset selector */}
      <div className="od-tp-preset-row">
        <select
          className="od-tp-select od-tp-preset-select"
          value={preset}
          onChange={e => handlePresetChange(e.target.value)}
        >
          {THEME_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
          ))}
          {preset === 'custom' && <option value="custom">Custom</option>}
        </select>
      </div>

      <div className="od-tp-separator" />

      {/* Scrollable sections */}
      <div className="od-tp-scroll">

        {/* Colors */}
        <Section title="Colors" icon="&#127912;" defaultOpen={true}>
          <ColorPair label="Background" lightVar="--od-color-bg" darkVar="--od-color-bg" onChange={markDirty} />
          <ColorPair label="Surface" lightVar="--od-color-surface" darkVar="--od-color-surface" onChange={markDirty} />
          <ColorPair label="Border" lightVar="--od-color-border" darkVar="--od-color-border" onChange={markDirty} />
          <div className="od-tp-sub-separator" />
          <ColorPair label="Text" lightVar="--od-color-text" darkVar="--od-color-text" onChange={markDirty} />
          <ColorPair label="Muted text" lightVar="--od-color-text-muted" darkVar="--od-color-text-muted" onChange={markDirty} />
          <div className="od-tp-sub-separator" />
          <ColorPair label="Accent" lightVar="--od-color-accent" darkVar="--od-color-accent" onChange={markDirty} />
          <ColorPair label="Accent hover" lightVar="--od-color-accent-hover" darkVar="--od-color-accent-hover" onChange={markDirty} />
          <div className="od-tp-sub-separator" />
          <ColorPair label="Code bg" lightVar="--od-color-code-bg" darkVar="--od-color-code-bg" onChange={markDirty} />
        </Section>

        <div className="od-tp-separator" />

        {/* Typography */}
        <Section title="Typography" icon="&#9997;&#65039;">
          <FontConfig
            label="Body"
            familyVar="--od-font-body"
            sizeVar="--od-font-size-base"
            weightVar="--od-font-weight-body"
            lineHeightVar="--od-line-height"
            onChange={markDirty}
          />
          <FontConfig
            label="H1"
            familyVar="--od-font-h1"
            sizeVar="--od-font-size-h1"
            weightVar="--od-font-weight-h1"
            onChange={markDirty}
          />
          <FontConfig
            label="H2"
            familyVar="--od-font-h2"
            sizeVar="--od-font-size-h2"
            weightVar="--od-font-weight-h2"
            onChange={markDirty}
          />
          <FontConfig
            label="H3"
            familyVar="--od-font-h3"
            sizeVar="--od-font-size-h3"
            weightVar="--od-font-weight-h3"
            onChange={markDirty}
          />
          <FontConfig
            label="Code"
            familyVar="--od-font-mono"
            sizeVar="--od-font-size-code"
            onChange={markDirty}
          />
        </Section>

        <div className="od-tp-separator" />

        {/* Layout */}
        <Section title="Layout" icon="&#128208;">
          <SliderRow label="Content width" varName="--od-content-max" min={600} max={960} unit="px" onChange={markDirty} />
          <SliderRow label="Sidebar width" varName="--od-sidebar-width" min={200} max={320} unit="px" onChange={markDirty} />
        </Section>

        <div className="od-tp-separator" />

        {/* Elements */}
        <Section title="Elements" icon="&#129521;">
          <SliderRow label="Border radius" varName="--od-radius" min={0} max={16} unit="px" onChange={markDirty} />
          <div className="od-tp-sub-separator" />
          <div className="od-tp-font-label">Callout colors</div>
          <ColorPair label="Note" lightVar="--od-color-callout-note" darkVar="--od-color-callout-note" onChange={markDirty} />
          <ColorPair label="Tip" lightVar="--od-color-callout-tip" darkVar="--od-color-callout-tip" onChange={markDirty} />
          <ColorPair label="Warning" lightVar="--od-color-callout-warning" darkVar="--od-color-callout-warning" onChange={markDirty} />
          <ColorPair label="Important" lightVar="--od-color-callout-important" darkVar="--od-color-callout-important" onChange={markDirty} />
        </Section>

        <div className="od-tp-separator" />

        {/* Favicon */}
        <details className="od-favicon-panel">
          <summary>Favicon</summary>
          <div className="od-favicon-content">
            <div className="od-favicon-drop" id="favicon-drop">
              <input type="file" id="favicon-upload" accept="image/png,image/svg+xml" hidden />
              <div className="od-favicon-drop-inner" id="favicon-drop-inner">
                <p>Drop a 512x512 PNG or SVG</p>
                <button className="od-btn od-btn-secondary" id="favicon-browse">Browse</button>
              </div>
            </div>
            <div className="od-favicon-preview" id="favicon-preview" style={{ display: 'none' }}>
              <img id="favicon-preview-img" alt="favicon preview" />
              <div className="od-favicon-sizes">
                <canvas id="preview-16" width="16" height="16" />
                <canvas id="preview-32" width="32" height="32" />
                <canvas id="preview-180" width="180" height="180" />
              </div>
            </div>
            <div className="od-favicon-tags" id="favicon-tags" style={{ display: 'none' }}>
              <label>HTML tags</label>
              <textarea className="od-css-editor" id="favicon-tags-output" readOnly />
              <div className="od-css-editor-actions">
                <button className="od-btn od-btn-ghost" id="favicon-copy-tags">Copy tags</button>
                <button className="od-btn od-btn-primary" id="favicon-download-all">Download all</button>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Action bar */}
      <div className="od-tp-action-bar">
        <button className="od-btn od-btn-ghost" onClick={handleReset}>Reset to default</button>
        <button className="od-btn od-btn-primary" onClick={handleSave} disabled={!dirty}>
          Save
        </button>
      </div>
    </div>
  )
})

function parseCssVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {}
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(block))) {
    vars[m[1]] = m[2].trim()
  }
  return vars
}
