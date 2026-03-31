import React, { useState, useEffect, useRef } from 'react'
import { Upload, RefreshCcw } from 'lucide-react'
import { Button } from './ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FaviconConfig {
  bgColor: string
  padding: number
  brightness: number
  darkMode: 'auto-invert' | 'same' | 'custom'
  appName: string
  themeColor: string
  version: number
}

export const DEFAULT_FAVICON_CONFIG: FaviconConfig = {
  bgColor: '',
  padding: 0,
  brightness: 0,
  darkMode: 'auto-invert',
  appName: '',
  themeColor: '#ffffff',
  version: 1,
}

// ── Canvas processing ─────────────────────────────────────────────────────────

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function renderFaviconCanvas(
  img: HTMLImageElement,
  cfg: FaviconConfig,
  size: number,
  dark: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  if (cfg.bgColor) {
    ctx.fillStyle = cfg.bgColor
    ctx.fillRect(0, 0, size, size)
  }

  const pad = Math.round(size * cfg.padding / 100)
  const drawSize = size - pad * 2
  if (drawSize > 0) ctx.drawImage(img, pad, pad, drawSize, drawSize)

  const needsBrightness = cfg.brightness !== 0
  const needsInvert = dark && cfg.darkMode === 'auto-invert'
  if (needsBrightness || needsInvert) {
    const imageData = ctx.getImageData(0, 0, size, size)
    const d = imageData.data
    const b = cfg.brightness * 2.55
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      if (needsInvert) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2] }
      if (needsBrightness) {
        d[i]     = Math.min(255, Math.max(0, d[i]     + b))
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + b))
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + b))
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

function useProcessedFavicon(
  sourceUrl: string | null,
  cfg: FaviconConfig,
  darkCustomUrl?: string | null,
): { light: string | null; dark: string | null; large: string | null } {
  const [urls, setUrls] = useState<{ light: string | null; dark: string | null; large: string | null }>({
    light: null, dark: null, large: null,
  })

  useEffect(() => {
    if (!sourceUrl) { setUrls({ light: null, dark: null, large: null }); return }
    let cancelled = false
    const result: { light: string | null; dark: string | null; large: string | null } = {
      light: null, dark: null, large: null,
    }

    const tasks: Promise<void>[] = [
      loadImage(sourceUrl).then(img => {
        if (cancelled) return
        result.light = renderFaviconCanvas(img, cfg, 32, false).toDataURL('image/png')
        result.large = renderFaviconCanvas(img, cfg, 180, false).toDataURL('image/png')
        if (cfg.darkMode !== 'custom') {
          result.dark = cfg.darkMode === 'same'
            ? result.light
            : renderFaviconCanvas(img, cfg, 32, true).toDataURL('image/png')
        }
      }),
    ]

    if (cfg.darkMode === 'custom' && darkCustomUrl) {
      tasks.push(
        loadImage(darkCustomUrl).then(img => {
          if (cancelled) return
          result.dark = renderFaviconCanvas(img, { ...cfg, darkMode: 'same' }, 32, false).toDataURL('image/png')
        })
      )
    }

    Promise.all(tasks).then(() => { if (!cancelled) setUrls({ ...result }) })
    return () => { cancelled = true }
  }, [sourceUrl, cfg, darkCustomUrl])

  return urls
}

// ── Preview components ────────────────────────────────────────────────────────

function BrowserPreview({ favicon, siteTitle, theme }: {
  favicon: string | null; siteTitle: string; theme: 'light' | 'dark'
}) {
  const dk = theme === 'dark'
  const tabBg   = dk ? '#2d2d3f' : '#ffffff'
  const stripBg = dk ? '#1e1e2e' : '#dee1e6'
  const inactBg = dk ? '#252535' : '#c8cdd5'
  const textCol = dk ? '#e0e0f0' : '#1a1a1a'
  const barBg   = dk ? '#2d2d3f' : '#ffffff'
  const urlBg   = dk ? '#1a1a2a' : '#f0f2f5'
  const urlCol  = dk ? '#6b7280' : '#9ca3af'
  const pageBg  = dk ? '#13131f' : '#f8f9fa'
  const lineBg  = dk ? '#2a2a40' : '#e5e7eb'

  return (
    <div style={{ background: stripBg, borderRadius: 8, padding: '7px 7px 0', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: tabBg, borderRadius: '6px 6px 0 0', flex: '0 0 auto', maxWidth: 160 }}>
          {favicon
            ? <img src={favicon} width={13} height={13} style={{ flexShrink: 0, objectFit: 'contain' }} />
            : <div style={{ width: 13, height: 13, background: lineBg, borderRadius: 2, flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: textCol, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'system-ui' }}>
            {siteTitle || 'My Docs'}
          </span>
        </div>
        <div style={{ width: 72, height: 26, background: inactBg, borderRadius: '5px 5px 0 0' }} />
      </div>
      <div style={{ height: 30, background: barBg, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, borderTop: `1px solid ${lineBg}` }}>
        <div style={{ flex: 1, height: 18, borderRadius: 9, background: urlBg, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          <span style={{ fontSize: 10, color: urlCol, fontFamily: 'system-ui' }}>localhost:3000</span>
        </div>
      </div>
      <div style={{ height: 36, background: pageBg, padding: 8 }}>
        <div style={{ height: 6, background: lineBg, borderRadius: 3, width: '55%' }} />
        <div style={{ height: 4, background: lineBg, borderRadius: 3, width: '75%', marginTop: 5, opacity: 0.5 }} />
      </div>
    </div>
  )
}

function GooglePreview({ favicon, siteTitle, theme }: {
  favicon: string | null; siteTitle: string; theme: 'light' | 'dark'
}) {
  const dk = theme === 'dark'
  return (
    <div style={{ background: dk ? '#202124' : '#ffffff', borderRadius: 10, padding: '14px 16px', width: 340, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: dk ? '#303134' : '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {favicon
            ? <img src={favicon} width={16} height={16} style={{ objectFit: 'contain' }} />
            : <div style={{ width: 16, height: 16, background: dk ? '#555' : '#ccc', borderRadius: 2 }} />}
        </div>
        <div>
          <div style={{ fontSize: 13, color: dk ? '#bdc1c6' : '#202124', lineHeight: 1.2 }}>{siteTitle || 'My Docs'}</div>
          <div style={{ fontSize: 12, color: dk ? '#9aa0a6' : '#4d5156', lineHeight: 1.2 }}>localhost:3000</div>
        </div>
      </div>
      <div style={{ fontSize: 19, color: dk ? '#8ab4f8' : '#1a0dab', marginBottom: 4, lineHeight: 1.3 }}>
        {siteTitle || 'My Docs'} – Home
      </div>
      <div style={{ fontSize: 13, color: dk ? '#bdc1c6' : '#4d5156', lineHeight: 1.5 }}>
        Welcome to the documentation. Get started with installation and configuration.
      </div>
    </div>
  )
}

function AppleTouchPreview({ favicon, appName }: { favicon: string | null; appName: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, userSelect: 'none' }}>
      <div style={{ width: 60, height: 60, borderRadius: 13, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.18)', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {favicon
          ? <img src={favicon} width={60} height={60} style={{ objectFit: 'contain' }} />
          : <div style={{ width: 60, height: 60, background: '#ddd' }} />}
      </div>
      <span style={{ fontSize: 10, color: '#666', fontFamily: 'system-ui', maxWidth: 68, textAlign: 'center', lineHeight: 1.2 }}>
        {appName || 'App'}
      </span>
    </div>
  )
}

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

// ── Favicon section ───────────────────────────────────────────────────────────

export function FaviconSection({ siteTitle }: { siteTitle: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const darkFileRef = useRef<HTMLInputElement>(null)
  const [rawUrl, setRawUrl] = useState<string | null>(null)
  const [darkRawUrl, setDarkRawUrl] = useState<string | null>(null)
  const [cfg, setCfg] = useState<FaviconConfig>(DEFAULT_FAVICON_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/_opendoc/page?path=')
      .then(r => r.json())
      .then(data => { if (data.faviconUrl) setRawUrl(data.faviconUrl) })
      .catch(() => {})
    fetch('/_opendoc/config.json')
      .then(r => r.json())
      .then(cfg => { if (cfg.faviconConfig) setCfg({ ...DEFAULT_FAVICON_CONFIG, ...cfg.faviconConfig }) })
      .catch(() => {})
  }, [])

  const processed = useProcessedFavicon(rawUrl, cfg, cfg.darkMode === 'custom' ? darkRawUrl : null)
  const displayedDarkFavicon = cfg.darkMode === 'same' ? processed.light : processed.dark

  function handleFile(file: File) { setRawUrl(URL.createObjectURL(file)); setSaved(false) }
  function handleDarkFile(file: File) { setDarkRawUrl(URL.createObjectURL(file)); setSaved(false) }

  async function handleSave() {
    if (!rawUrl) return
    setSaving(true)
    try {
      const toBlob = (dataUrl: string) => fetch(dataUrl).then(r => r.blob())

      if (processed.light) {
        const form = new FormData()
        form.append('file', new File([await toBlob(processed.light)], 'favicon.png', { type: 'image/png' }))
        form.append('pagePath', '.'); form.append('type', 'favicon')
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }
      if (processed.dark && cfg.darkMode !== 'same') {
        const form = new FormData()
        form.append('file', new File([await toBlob(processed.dark)], 'favicon-dark.png', { type: 'image/png' }))
        form.append('pagePath', '.'); form.append('type', 'favicon-dark')
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }
      if (processed.large) {
        const form = new FormData()
        form.append('file', new File([await toBlob(processed.large)], 'apple-touch-icon.png', { type: 'image/png' }))
        form.append('pagePath', '.'); form.append('type', 'apple-touch-icon')
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }

      const newCfg = { ...cfg, version: cfg.version + 1 }
      setCfg(newCfg)
      await fetch('/_opendoc/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faviconConfig: newCfg }),
      })
      setSaved(true)
    } finally { setSaving(false) }
  }

  const appName = cfg.appName || siteTitle || 'My Docs'

  return (
    <div className="od-ssp-favicon-layout">
      <div className="od-ssp-favicon-controls">
        <div className="od-ssp-field">
          <label className="od-ssp-label">Source image</label>
          <p className="od-ssp-hint">SVG or PNG recommended. At least 512×512px for best results.</p>
          <input ref={fileRef} type="file" accept=".svg,.png" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          <div className="od-ssp-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active') }}
            onDragLeave={e => e.currentTarget.classList.remove('active')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('active'); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            {rawUrl
              ? <img src={rawUrl} width={36} height={36} style={{ objectFit: 'contain', borderRadius: 4 }} />
              : <Upload style={{ width: 20, height: 20, color: 'var(--od-text-muted, #6b7280)' }} />}
            <span className="od-ssp-dropzone-label">{rawUrl ? 'Click or drag to replace' : 'Click or drag SVG / PNG here'}</span>
          </div>
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Background</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" className="od-ssp-color" value={cfg.bgColor || '#ffffff'}
              onChange={e => { setCfg(c => ({ ...c, bgColor: e.target.value })); setSaved(false) }} />
            <button className="od-ssp-btn-sm" onClick={() => { setCfg(c => ({ ...c, bgColor: '' })); setSaved(false) }}>Transparent</button>
            {cfg.bgColor && <span style={{ fontSize: 12, color: 'var(--od-text-muted, #6b7280)' }}>{cfg.bgColor}</span>}
          </div>
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Padding <span className="od-ssp-value">{cfg.padding}%</span></label>
          <input type="range" min={0} max={40} step={1} value={cfg.padding} className="od-ssp-range"
            onChange={e => { setCfg(c => ({ ...c, padding: +e.target.value })); setSaved(false) }} />
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Brightness <span className="od-ssp-value">{cfg.brightness > 0 ? '+' : ''}{cfg.brightness}</span></label>
          <input type="range" min={-50} max={50} step={1} value={cfg.brightness} className="od-ssp-range"
            onChange={e => { setCfg(c => ({ ...c, brightness: +e.target.value })); setSaved(false) }} />
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Dark mode favicon</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(['same', 'auto-invert', 'custom'] as const).map(opt => (
              <label key={opt} className="od-ssp-radio-label">
                <input type="radio" name="darkMode" value={opt} checked={cfg.darkMode === opt}
                  onChange={() => { setCfg(c => ({ ...c, darkMode: opt })); setSaved(false) }} />
                {opt === 'same' ? 'Same as light' : opt === 'auto-invert' ? 'Auto-invert colors' : 'Upload custom'}
              </label>
            ))}
          </div>
          {cfg.darkMode === 'custom' && (
            <div style={{ marginTop: 8 }}>
              <input ref={darkFileRef} type="file" accept=".svg,.png" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) handleDarkFile(f); e.target.value = '' }} />
              <button className="od-ssp-btn-sm" onClick={() => darkFileRef.current?.click()}>
                <Upload style={{ width: 12, height: 12 }} />
                {darkRawUrl ? 'Replace dark favicon' : 'Upload dark favicon'}
              </button>
            </div>
          )}
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">App name</label>
          <p className="od-ssp-hint">iOS home screen label and web app manifest name. Defaults to site title.</p>
          <input type="text" className="od-ssp-input" placeholder={siteTitle || 'My Docs'} value={cfg.appName}
            onChange={e => { setCfg(c => ({ ...c, appName: e.target.value })); setSaved(false) }} />
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Theme color</label>
          <p className="od-ssp-hint">Browser chrome color when installed as a PWA.</p>
          <input type="color" className="od-ssp-color" value={cfg.themeColor}
            onChange={e => { setCfg(c => ({ ...c, themeColor: e.target.value })); setSaved(false) }} />
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Cache version <span className="od-ssp-value">v{cfg.version}</span></label>
          <p className="od-ssp-hint">Increment to force browsers to reload the cached favicon.</p>
          <button className="od-ssp-btn-sm" onClick={() => { setCfg(c => ({ ...c, version: c.version + 1 })); setSaved(false) }}>
            <RefreshCcw style={{ width: 12, height: 12 }} /> Bump version
          </button>
        </div>

        <Button onClick={handleSave} disabled={!rawUrl || saving} className="w-full">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Favicon'}
        </Button>
      </div>

      <div className="od-ssp-favicon-previews">
        <div className="od-ssp-preview-pair">
          <div><PreviewLabel>Browser — Light</PreviewLabel><BrowserPreview favicon={processed.light} siteTitle={siteTitle} theme="light" /></div>
          <div><PreviewLabel>Browser — Dark</PreviewLabel><BrowserPreview favicon={displayedDarkFavicon} siteTitle={siteTitle} theme="dark" /></div>
        </div>
        <div className="od-ssp-preview-pair">
          <div><PreviewLabel>Google — Light</PreviewLabel><GooglePreview favicon={processed.light} siteTitle={siteTitle} theme="light" /></div>
          <div><PreviewLabel>Google — Dark</PreviewLabel><GooglePreview favicon={displayedDarkFavicon} siteTitle={siteTitle} theme="dark" /></div>
        </div>
        <div><PreviewLabel>Apple Touch Icon (180×180)</PreviewLabel><AppleTouchPreview favicon={processed.large} appName={appName} /></div>
      </div>
    </div>
  )
}
