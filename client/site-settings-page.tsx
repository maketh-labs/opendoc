import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, RefreshCcw } from 'lucide-react'
import { Button } from './ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FaviconConfig {
  bgColor: string       // '' = transparent
  padding: number       // 0–40, percent of canvas
  brightness: number    // -50 to +50
  darkMode: 'auto-invert' | 'same' | 'custom'
  appName: string       // '' = use site title
  themeColor: string    // #rrggbb
  version: number
}

const DEFAULT_FAVICON_CONFIG: FaviconConfig = {
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
  canvas.width = size
  canvas.height = size
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
      if (needsInvert) {
        d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]
      }
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

    const tasks: Promise<void>[] = []
    const result: { light: string | null; dark: string | null; large: string | null } = {
      light: null, dark: null, large: null,
    }

    tasks.push(
      loadImage(sourceUrl).then(img => {
        if (cancelled) return
        result.light = renderFaviconCanvas(img, cfg, 32, false).toDataURL('image/png')
        result.large = renderFaviconCanvas(img, cfg, 180, false).toDataURL('image/png')
        if (cfg.darkMode !== 'custom') {
          result.dark = cfg.darkMode === 'same'
            ? result.light
            : renderFaviconCanvas(img, cfg, 32, true).toDataURL('image/png')
        }
      })
    )

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
      {/* Tab row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {/* Active tab */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', background: tabBg,
          borderRadius: '6px 6px 0 0', flex: '0 0 auto', maxWidth: 160,
        }}>
          {favicon
            ? <img src={favicon} width={13} height={13} style={{ flexShrink: 0, objectFit: 'contain' }} />
            : <div style={{ width: 13, height: 13, background: lineBg, borderRadius: 2, flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: textCol, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'system-ui' }}>
            {siteTitle || 'My Docs'}
          </span>
        </div>
        {/* Inactive tab */}
        <div style={{ width: 72, height: 26, background: inactBg, borderRadius: '5px 5px 0 0' }} />
      </div>
      {/* Address bar */}
      <div style={{ height: 30, background: barBg, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, borderTop: `1px solid ${lineBg}` }}>
        <div style={{ flex: 1, height: 18, borderRadius: 9, background: urlBg, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          <span style={{ fontSize: 10, color: urlCol, fontFamily: 'system-ui' }}>localhost:3000</span>
        </div>
      </div>
      {/* Page stub */}
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
    <div style={{
      background: dk ? '#202124' : '#ffffff',
      borderRadius: 10,
      padding: '14px 16px',
      width: 340,
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 13,
          background: dk ? '#303134' : '#f1f3f4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
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
      <div style={{
        width: 60, height: 60, borderRadius: 13,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,.18)',
        background: '#f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
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

// ── Preview grid label ────────────────────────────────────────────────────────

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

// ── Favicon section ───────────────────────────────────────────────────────────

function FaviconSection({ siteTitle }: { siteTitle: string }) {
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
      .then(data => {
        if (data.faviconUrl) setRawUrl(data.faviconUrl)
        if (data.faviconConfig) setCfg({ ...DEFAULT_FAVICON_CONFIG, ...data.faviconConfig })
      })
      .catch(() => {})
  }, [])

  const processed = useProcessedFavicon(rawUrl, cfg, cfg.darkMode === 'custom' ? darkRawUrl : null)

  const displayedDarkFavicon = cfg.darkMode === 'same' ? processed.light : processed.dark

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setRawUrl(url)
    setSaved(false)
  }

  function handleDarkFile(file: File) {
    setDarkRawUrl(URL.createObjectURL(file))
    setSaved(false)
  }

  async function handleSave() {
    if (!rawUrl) return
    setSaving(true)
    try {
      const toBlob = (dataUrl: string) => fetch(dataUrl).then(r => r.blob())

      // Upload light favicon (processed)
      if (processed.light) {
        const form = new FormData()
        form.append('file', new File([await toBlob(processed.light)], 'favicon.png', { type: 'image/png' }))
        form.append('pagePath', '.')
        form.append('type', 'favicon')
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }

      // Upload dark favicon
      if (processed.dark && cfg.darkMode !== 'same') {
        const form = new FormData()
        form.append('file', new File([await toBlob(processed.dark)], 'favicon-dark.png', { type: 'image/png' }))
        form.append('pagePath', '.')
        form.append('type', 'favicon-dark')
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }

      // Upload apple touch icon
      if (processed.large) {
        const form = new FormData()
        form.append('file', new File([await toBlob(processed.large)], 'apple-touch-icon.png', { type: 'image/png' }))
        form.append('pagePath', '.')
        form.append('type', 'apple-touch-icon')
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }

      // Save config with version bump
      const newCfg = { ...cfg, version: cfg.version + 1 }
      setCfg(newCfg)
      await fetch('/_opendoc/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faviconConfig: newCfg }),
      })

      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const appName = cfg.appName || siteTitle || 'My Docs'

  return (
    <div className="od-ssp-favicon-layout">
      {/* Left: controls */}
      <div className="od-ssp-favicon-controls">

        {/* Upload */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">Source image</label>
          <p className="od-ssp-hint">SVG or PNG recommended. At least 512×512px for best results.</p>
          <input ref={fileRef} type="file" accept=".svg,.png" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          <div
            className="od-ssp-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active') }}
            onDragLeave={e => e.currentTarget.classList.remove('active')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('active'); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            {rawUrl
              ? <img src={rawUrl} width={36} height={36} style={{ objectFit: 'contain', borderRadius: 4 }} />
              : <Upload style={{ width: 20, height: 20, color: 'var(--od-text-muted, #6b7280)' }} />}
            <span className="od-ssp-dropzone-label">
              {rawUrl ? 'Click or drag to replace' : 'Click or drag SVG / PNG here'}
            </span>
          </div>
        </div>

        {/* Background */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">Background</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" className="od-ssp-color"
              value={cfg.bgColor || '#ffffff'}
              onChange={e => { setCfg(c => ({ ...c, bgColor: e.target.value })); setSaved(false) }} />
            <button className="od-ssp-btn-sm"
              onClick={() => { setCfg(c => ({ ...c, bgColor: '' })); setSaved(false) }}>
              Transparent
            </button>
            {cfg.bgColor && (
              <span style={{ fontSize: 12, color: 'var(--od-text-muted, #6b7280)' }}>{cfg.bgColor}</span>
            )}
          </div>
        </div>

        {/* Padding */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">
            Padding <span className="od-ssp-value">{cfg.padding}%</span>
          </label>
          <input type="range" min={0} max={40} step={1} value={cfg.padding}
            onChange={e => { setCfg(c => ({ ...c, padding: +e.target.value })); setSaved(false) }}
            className="od-ssp-range" />
        </div>

        {/* Brightness */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">
            Brightness <span className="od-ssp-value">{cfg.brightness > 0 ? '+' : ''}{cfg.brightness}</span>
          </label>
          <input type="range" min={-50} max={50} step={1} value={cfg.brightness}
            onChange={e => { setCfg(c => ({ ...c, brightness: +e.target.value })); setSaved(false) }}
            className="od-ssp-range" />
        </div>

        {/* Dark mode */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">Dark mode favicon</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(['same', 'auto-invert', 'custom'] as const).map(opt => (
              <label key={opt} className="od-ssp-radio-label">
                <input type="radio" name="darkMode" value={opt}
                  checked={cfg.darkMode === opt}
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

        {/* App name */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">App name</label>
          <p className="od-ssp-hint">iOS home screen label and web app manifest name. Defaults to site title.</p>
          <input type="text" className="od-ssp-input"
            placeholder={siteTitle || 'My Docs'}
            value={cfg.appName}
            onChange={e => { setCfg(c => ({ ...c, appName: e.target.value })); setSaved(false) }} />
        </div>

        {/* Theme color */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">Theme color</label>
          <p className="od-ssp-hint">Browser chrome color when installed as a PWA.</p>
          <input type="color" className="od-ssp-color"
            value={cfg.themeColor}
            onChange={e => { setCfg(c => ({ ...c, themeColor: e.target.value })); setSaved(false) }} />
        </div>

        {/* Version */}
        <div className="od-ssp-field">
          <label className="od-ssp-label">
            Cache version <span className="od-ssp-value">v{cfg.version}</span>
          </label>
          <p className="od-ssp-hint">Increment to force browsers to reload the cached favicon.</p>
          <button className="od-ssp-btn-sm"
            onClick={() => { setCfg(c => ({ ...c, version: c.version + 1 })); setSaved(false) }}>
            <RefreshCcw style={{ width: 12, height: 12 }} /> Bump version
          </button>
        </div>

        {/* Save */}
        <Button onClick={handleSave} disabled={!rawUrl || saving} className="w-full">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Favicon'}
        </Button>
      </div>

      {/* Right: previews */}
      <div className="od-ssp-favicon-previews">
        <div className="od-ssp-preview-pair">
          <div>
            <PreviewLabel>Browser — Light</PreviewLabel>
            <BrowserPreview favicon={processed.light} siteTitle={siteTitle} theme="light" />
          </div>
          <div>
            <PreviewLabel>Browser — Dark</PreviewLabel>
            <BrowserPreview favicon={displayedDarkFavicon} siteTitle={siteTitle} theme="dark" />
          </div>
        </div>

        <div className="od-ssp-preview-pair">
          <div>
            <PreviewLabel>Google — Light</PreviewLabel>
            <GooglePreview favicon={processed.light} siteTitle={siteTitle} theme="light" />
          </div>
          <div>
            <PreviewLabel>Google — Dark</PreviewLabel>
            <GooglePreview favicon={displayedDarkFavicon} siteTitle={siteTitle} theme="dark" />
          </div>
        </div>

        <div>
          <PreviewLabel>Apple Touch Icon (180×180)</PreviewLabel>
          <AppleTouchPreview favicon={processed.large} appName={appName} />
        </div>
      </div>
    </div>
  )
}

// ── OG Image section ──────────────────────────────────────────────────────────

function OGImageSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fetch('/_opendoc/page?path=').then(r => r.json())
      setCurrentUrl(data.ogImageUrl || null)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  async function upload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('pagePath', '.')
      form.append('type', 'og-image')
      await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      await load()
    } finally { setUploading(false) }
  }

  async function remove() {
    await fetch('/_opendoc/page-asset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagePath: '.', type: 'og-image' }),
    })
    setCurrentUrl(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
      <p className="od-ssp-hint">
        Default social share image for all pages. Shown when shared on Twitter/X, Slack, iMessage, etc.
        Recommended: 1200×630px PNG or JPG.
      </p>
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      {currentUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--od-border, #e2e8f0)',
            width: '100%', maxWidth: 400, aspectRatio: '1200/630', background: '#f0f0f0',
          }}>
            <img src={currentUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="od-ssp-btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload style={{ width: 12, height: 12 }} />
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button className="od-ssp-btn-sm od-ssp-btn-danger" onClick={remove}>Remove</button>
          </div>
        </div>
      ) : (
        <div
          className="od-ssp-dropzone"
          style={{ maxWidth: 400, aspectRatio: '1200/630' }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active') }}
          onDragLeave={e => e.currentTarget.classList.remove('active')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('active'); const f = e.dataTransfer.files[0]; if (f) upload(f) }}
        >
          <Upload style={{ width: 20, height: 20, color: 'var(--od-text-muted, #6b7280)' }} />
          <span className="od-ssp-dropzone-label">Click or drag PNG / JPG (1200×630)</span>
        </div>
      )}
    </div>
  )
}


// ── OG Image Generator (Canvas) ──────────────────────────────────────────────

type OGTemplate = 'gradient' | 'minimal' | 'dark' | 'image'

interface OGConfig {
  template: OGTemplate
  title: string
  description: string
  accentColor: string
  bgColor: string
  textColor: string
  bgImageDataUrl: string | null
  showLogo: boolean
}

const DEFAULT_OG_CONFIG: OGConfig = {
  template: 'gradient',
  title: '',
  description: '',
  accentColor: '#4f46e5',
  bgColor: '#ffffff',
  textColor: '#1a1a1a',
  bgImageDataUrl: null,
  showLogo: true,
}

const W = 1200
const H = 630

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function lightenHex(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

async function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

async function renderOGCanvas(cfg: OGConfig, logoUrl: string | null): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  const title = cfg.title || 'Documentation'
  const accent = cfg.accentColor

  // ── Background ───────────────────────────────────────────────────────────
  if (cfg.template === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, accent)
    grad.addColorStop(1, lightenHex(accent, 60))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

  } else if (cfg.template === 'minimal') {
    ctx.fillStyle = cfg.bgColor || '#ffffff'
    ctx.fillRect(0, 0, W, H)
    // Accent left bar
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, 14, H)

  } else if (cfg.template === 'dark') {
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, W, H)
    // Radial glow
    const { r, g, b } = hexToRgb(accent)
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 500)
    glow.addColorStop(0, `rgba(${r},${g},${b},0.25)`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

  } else if (cfg.template === 'image') {
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, W, H)
    if (cfg.bgImageDataUrl) {
      try {
        const img = await loadImg(cfg.bgImageDataUrl)
        ctx.drawImage(img, 0, 0, W, H)
      } catch {}
    }
    // Dark gradient overlay (bottom-heavy)
    const overlay = ctx.createLinearGradient(0, 0, 0, H)
    overlay.addColorStop(0, 'rgba(0,0,0,0)')
    overlay.addColorStop(0.4, 'rgba(0,0,0,0.35)')
    overlay.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = overlay
    ctx.fillRect(0, 0, W, H)
  }

  // ── Logo ─────────────────────────────────────────────────────────────────
  let logoY = cfg.template === 'minimal' ? 80 : 64
  if (cfg.showLogo && logoUrl) {
    try {
      const logo = await loadImg(logoUrl)
      const logoX = cfg.template === 'minimal' ? 80 : 80
      const logoSize = 52
      // Rounded clip
      ctx.save()
      ctx.beginPath()
      const r = 10
      ctx.roundRect(logoX, logoY, logoSize, logoSize, r)
      ctx.clip()
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
      ctx.restore()
      logoY += logoSize + 28
    } catch {}
  }

  // ── Text color ───────────────────────────────────────────────────────────
  const isLight = cfg.template === 'gradient' || cfg.template === 'dark' || cfg.template === 'image'
  const titleColor = isLight ? '#ffffff' : (cfg.textColor || '#1a1a1a')
  const descColor  = isLight ? 'rgba(255,255,255,0.78)' : '#6b7280'

  const padLeft = cfg.template === 'minimal' ? 100 : 80
  const maxW    = W - padLeft - 80

  // ── Title ────────────────────────────────────────────────────────────────
  ctx.fillStyle = titleColor
  ctx.font = `700 ${72}px -apple-system, "Segoe UI", sans-serif`
  const titleLines = wrapText(ctx, title, maxW).slice(0, 2)
  const lineH = 84
  const textBlockH = titleLines.length * lineH + (cfg.description ? 36 + 38 : 0)
  let textY = cfg.template === 'minimal'
    ? Math.max(logoY, H / 2 - textBlockH / 2)
    : H - textBlockH - 64

  for (const line of titleLines) {
    ctx.fillText(line, padLeft, textY + 72)
    textY += lineH
  }

  // ── Description ──────────────────────────────────────────────────────────
  if (cfg.description) {
    textY += 16
    ctx.fillStyle = descColor
    ctx.font = `400 32px -apple-system, "Segoe UI", sans-serif`
    const descLines = wrapText(ctx, cfg.description, maxW).slice(0, 2)
    for (const line of descLines) {
      ctx.fillText(line, padLeft, textY + 32)
      textY += 42
    }
  }

  return canvas.toDataURL('image/png')
}

const TEMPLATES: { id: OGTemplate; label: string }[] = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'minimal',  label: 'Minimal'  },
  { id: 'dark',     label: 'Dark'     },
  { id: 'image',    label: 'Image BG' },
]

function OGImageGenerator({ siteTitle, faviconUrl }: { siteTitle: string; faviconUrl: string | null }) {
  const bgFileRef = useRef<HTMLInputElement>(null)
  const [cfg, setCfg] = useState<OGConfig>({ ...DEFAULT_OG_CONFIG, title: siteTitle })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCfg(c => ({ ...c, title: c.title || siteTitle }))
  }, [siteTitle])

  // Debounced render whenever config changes
  useEffect(() => {
    if (renderTimer.current) clearTimeout(renderTimer.current)
    setRendering(true)
    renderTimer.current = setTimeout(async () => {
      try {
        const url = await renderOGCanvas(cfg, cfg.showLogo ? faviconUrl : null)
        setPreviewUrl(url)
        setSaved(false)
      } catch (e) {
        console.error('OG render error', e)
      } finally {
        setRendering(false)
      }
    }, 300)
    return () => { if (renderTimer.current) clearTimeout(renderTimer.current) }
  }, [cfg, faviconUrl])

  async function handleSave() {
    if (!previewUrl) return
    setSaving(true)
    try {
      const blob = await fetch(previewUrl).then(r => r.blob())
      const form = new FormData()
      form.append('file', new File([blob], 'og-image.png', { type: 'image/png' }))
      form.append('pagePath', '.')
      form.append('type', 'og-image')
      await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      setSaved(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="od-ssp-favicon-layout">
      {/* Left: controls */}
      <div className="od-ssp-favicon-controls">

        <div className="od-ssp-field">
          <label className="od-ssp-label">Template</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TEMPLATES.map(t => (
              <button key={t.id}
                className={`od-ssp-btn-sm${cfg.template === t.id ? ' od-ssp-btn-active' : ''}`}
                onClick={() => setCfg(c => ({ ...c, template: t.id }))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Title</label>
          <input type="text" className="od-ssp-input"
            placeholder={siteTitle || 'My Docs'}
            value={cfg.title}
            onChange={e => setCfg(c => ({ ...c, title: e.target.value }))} />
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Description <span className="od-ssp-value">(optional)</span></label>
          <input type="text" className="od-ssp-input"
            placeholder="The official documentation"
            value={cfg.description}
            onChange={e => setCfg(c => ({ ...c, description: e.target.value }))} />
        </div>

        <div className="od-ssp-field">
          <label className="od-ssp-label">Accent color</label>
          <input type="color" className="od-ssp-color"
            value={cfg.accentColor}
            onChange={e => setCfg(c => ({ ...c, accentColor: e.target.value }))} />
        </div>

        {cfg.template === 'minimal' && (
          <div className="od-ssp-field">
            <label className="od-ssp-label">Background</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" className="od-ssp-color"
                value={cfg.bgColor}
                onChange={e => setCfg(c => ({ ...c, bgColor: e.target.value }))} />
              <input type="color" className="od-ssp-color"
                value={cfg.textColor}
                onChange={e => setCfg(c => ({ ...c, textColor: e.target.value }))} />
              <span className="od-ssp-hint">bg / text</span>
            </div>
          </div>
        )}

        {cfg.template === 'image' && (
          <div className="od-ssp-field">
            <label className="od-ssp-label">Background image</label>
            <input ref={bgFileRef} type="file" accept=".png,.jpg,.jpeg,.webp" hidden
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = ev => setCfg(c => ({ ...c, bgImageDataUrl: ev.target?.result as string }))
                reader.readAsDataURL(f)
                e.target.value = ''
              }} />
            <button className="od-ssp-btn-sm" onClick={() => bgFileRef.current?.click()}>
              <Upload style={{ width: 12, height: 12 }} />
              {cfg.bgImageDataUrl ? 'Replace image' : 'Upload image'}
            </button>
          </div>
        )}

        {faviconUrl && (
          <div className="od-ssp-field">
            <label className="od-ssp-radio-label" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.showLogo}
                onChange={e => setCfg(c => ({ ...c, showLogo: e.target.checked }))} />
              Show favicon as logo
            </label>
          </div>
        )}

        <Button onClick={handleSave} disabled={!previewUrl || saving} className="w-full">
          {saving ? 'Saving…' : saved ? '✓ Saved as OG Image' : 'Save as OG Image'}
        </Button>
      </div>

      {/* Right: preview */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <PreviewLabel>Preview (1200×630)</PreviewLabel>
        <div style={{
          width: '100%', aspectRatio: '1200/630',
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--od-color-border, #e5e7eb)',
          background: '#f0f0f0', position: 'relative',
        }}>
          {previewUrl
            ? <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#9ca3af' }}>
                Generating…
              </div>}
          {rendering && previewUrl && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.4)' }} />
          )}
        </div>
        {saved && <p className="od-ssp-hint" style={{ marginTop: 8, color: 'var(--color-accent, #0969da)' }}>✓ Saved to site root.</p>}
      </div>
    </div>
  )
}

// ── OG Image tabs (upload | generate) ────────────────────────────────────────

function OGImageTabs({ siteTitle, faviconUrl }: { siteTitle: string; faviconUrl: string | null }) {
  const [tab, setTab] = useState<'upload' | 'generate'>('generate')
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--od-color-border, #e5e7eb)' }}>
        {(['generate', 'upload'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--color-accent, #0969da)' : 'var(--od-color-text-muted, #6b7280)',
            background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--color-accent, #0969da)' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1,
          }}>
            {t === 'generate' ? '✦ Generate' : '↑ Upload'}
          </button>
        ))}
      </div>
      {tab === 'generate'
        ? <OGImageGenerator siteTitle={siteTitle} faviconUrl={faviconUrl} />
        : <OGImageSection />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SiteSettingsPage() {
  const [siteTitle, setSiteTitle] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/_opendoc/config.json')
      .then(r => r.json())
      .then(cfg => {
        setSiteTitle(cfg.title ?? '')
        setSavedTitle(cfg.title ?? '')
      })
      .catch(() => {})
    fetch('/_opendoc/page?path=')
      .then(r => r.json())
      .then(data => { if (data.faviconUrl) setFaviconUrl(data.faviconUrl) })
      .catch(() => {})
  }, [])

  async function saveTitle() {
    setSavingTitle(true)
    try {
      await fetch('/_opendoc/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: siteTitle }),
      })
      setSavedTitle(siteTitle)
    } finally { setSavingTitle(false) }
  }

  const titleDirty = siteTitle !== savedTitle

  return (
    <div className="od-ssp-wrap">
      <div className="od-ssp-content">
        <h1 className="od-ssp-heading">Site Settings</h1>

        {/* General */}
        <section className="od-ssp-section">
          <h2 className="od-ssp-section-heading">General</h2>
          <div className="od-ssp-field">
            <label className="od-ssp-label">Site title</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="od-ssp-input"
                type="text"
                value={siteTitle}
                placeholder="My Docs"
                onChange={e => setSiteTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && titleDirty) saveTitle() }}
              />
              {titleDirty && (
                <Button size="sm" className="h-8 text-xs shrink-0" onClick={saveTitle} disabled={savingTitle}>
                  {savingTitle ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="od-ssp-divider" />

        {/* Favicon */}
        <section className="od-ssp-section">
          <h2 className="od-ssp-section-heading">Favicon</h2>
          <FaviconSection siteTitle={savedTitle} />
        </section>

        <div className="od-ssp-divider" />

        {/* OG Image */}
        <section className="od-ssp-section">
          <h2 className="od-ssp-section-heading">OG Image</h2>
          <OGImageTabs siteTitle={savedTitle} faviconUrl={faviconUrl} />
        </section>

      </div>
    </div>
  )
}
