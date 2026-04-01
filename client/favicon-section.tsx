import React, { useState, useEffect, useRef } from 'react'
import { Upload, RefreshCcw } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'


// ── Types ─────────────────────────────────────────────────────────────────────

export interface FaviconConfig {
  darkMode: 'auto-invert' | 'same' | 'custom'
  // Apple Touch Icon
  appleTouchMode: 'as-is' | 'background'
  appleTouchBgColor: string
  appleTouchMargin: number
  appName: string
  // Web App Manifest
  manifestMode: 'as-is' | 'background'
  manifestBgColor: string
  manifestMargin: number
  manifestName: string
  manifestShortName: string
  splashBgColor: string
  themeColor: string
  // Meta
  version: number
}

export const DEFAULT_FAVICON_CONFIG: FaviconConfig = {
  darkMode: 'auto-invert',
  appleTouchMode: 'as-is',
  appleTouchBgColor: '#ffffff',
  appleTouchMargin: 15,
  appName: '',
  manifestMode: 'as-is',
  manifestBgColor: '#ffffff',
  manifestMargin: 15,
  manifestName: '',
  manifestShortName: '',
  splashBgColor: '#ffffff',
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

/** Render icon at exact size — for browser favicons */
function renderIconCanvas(
  img: HTMLImageElement,
  size: number,
  dark: boolean,
  darkMode: FaviconConfig['darkMode'],
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)
  if (dark && darkMode === 'auto-invert') {
    const imageData = ctx.getImageData(0, 0, size, size)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]
    }
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

/** Render icon with optional background + margin — for touch/manifest icons */
function renderPaddedCanvas(
  img: HTMLImageElement,
  size: number,
  mode: 'as-is' | 'background',
  bgColor: string,
  margin: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  if (mode === 'background') {
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, size, size)
    const pad = Math.round(size * margin / 100)
    const drawSize = size - pad * 2
    if (drawSize > 0) ctx.drawImage(img, pad, pad, drawSize, drawSize)
  } else {
    ctx.drawImage(img, 0, 0, size, size)
  }
  return canvas
}

function useProcessedFavicon(
  sourceUrl: string | null,
  cfg: FaviconConfig,
  darkCustomUrl?: string | null,
): { light: string | null; dark: string | null; appleTouch: string | null; manifest: string | null } {
  const [urls, setUrls] = useState<{ light: string | null; dark: string | null; appleTouch: string | null; manifest: string | null }>({
    light: null, dark: null, appleTouch: null, manifest: null,
  })

  useEffect(() => {
    if (!sourceUrl) { setUrls({ light: null, dark: null, appleTouch: null, manifest: null }); return }
    let cancelled = false
    const result: { light: string | null; dark: string | null; appleTouch: string | null; manifest: string | null } = {
      light: null, dark: null, appleTouch: null, manifest: null,
    }

    const tasks: Promise<void>[] = [
      loadImage(sourceUrl).then(img => {
        if (cancelled) return
        result.light = renderIconCanvas(img, 96, false, cfg.darkMode).toDataURL('image/png')
        result.appleTouch = renderPaddedCanvas(img, 180, cfg.appleTouchMode, cfg.appleTouchBgColor, cfg.appleTouchMargin).toDataURL('image/png')
        result.manifest = renderPaddedCanvas(img, 192, cfg.manifestMode, cfg.manifestBgColor, cfg.manifestMargin).toDataURL('image/png')
        if (cfg.darkMode !== 'custom') {
          result.dark = cfg.darkMode === 'same'
            ? result.light
            : renderIconCanvas(img, 96, true, cfg.darkMode).toDataURL('image/png')
        }
      }),
    ]

    if (cfg.darkMode === 'custom' && darkCustomUrl) {
      tasks.push(
        loadImage(darkCustomUrl).then(img => {
          if (cancelled) return
          result.dark = renderIconCanvas(img, 96, false, 'same').toDataURL('image/png')
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
            ? <img src={favicon} alt="" width={13} height={13} style={{ flexShrink: 0, objectFit: 'contain' }} />
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
            ? <img src={favicon} alt="" width={16} height={16} style={{ objectFit: 'contain' }} />
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
    <div style={{ position: 'relative', width: 156, height: 182, minWidth: 156, userSelect: 'none' }}>
      <img src="/_opendoc/assets/homescreen-ios.webp" alt="" width={156} height={182} style={{ position: 'absolute', left: 0, top: 0 }} />
      <div style={{ position: 'absolute', left: 88, top: 98, zIndex: 20, width: 56, height: 56, overflow: 'hidden', borderRadius: 12 }}>
        {favicon
          ? <img src={favicon} alt="" width={56} height={56} style={{ objectFit: 'cover' }} />
          : <div style={{ width: 56, height: 56, background: '#e0e0e0' }} />}
      </div>
      <div style={{ position: 'absolute', left: 80, top: 156, width: 72, textAlign: 'center', fontSize: 12, color: '#fff', fontFamily: '-apple-system, SF Pro, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {appName || 'App'}
      </div>
    </div>
  )
}

function ManifestHomePreview({ icon, shortName }: { icon: string | null; shortName: string }) {
  return (
    <div style={{ position: 'relative', width: 156, height: 228, display: 'inline-block', border: '1px solid #e0e0e0', userSelect: 'none' }}>
      <img src="/_opendoc/assets/homescreen-android.webp" alt="" width={156} height={228} style={{ position: 'absolute', left: 0, top: 0 }} />
      {/* App icon */}
      <div style={{ position: 'absolute', left: 90, top: 138, width: 52, height: 52, overflow: 'hidden', borderRadius: '50%', background: '#000', filter: 'drop-shadow(0 1px 1px #444)' }}>
        {icon
          ? <img src={icon} alt="" width={52} height={52} style={{ objectFit: 'cover' }} />
          : <div style={{ width: 52, height: 52, background: '#333' }} />}
      </div>
      {/* Chrome badge */}
      <svg style={{ position: 'absolute', left: 123, top: 171 }} width={24} height={24} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="#fff"/>
        <path d="M24 14.4a9.6 9.6 0 019.17 6.72H24" fill="none"/>
        <path d="M24 2a22 22 0 00-19.05 11l8.32 14.4" fill="#DB4437"/>
        <path d="M4.95 13A22 22 0 0024 46l8.32-14.4" fill="#0F9D58"/>
        <path d="M24 46a22 22 0 0019.05-11L33.17 21.12" fill="#4285F4"/>
        <path d="M32.73 21.12H46A22 22 0 004.95 13l9.78 8.28" fill="#FFCD40"/>
        <circle cx="24" cy="24" r="8" fill="#4285F4"/>
        <circle cx="24" cy="24" r="5.5" fill="#fff"/>
        <circle cx="24" cy="24" r="5.5" fill="#4285F4"/>
      </svg>
      {/* App label */}
      <div style={{ position: 'absolute', left: 90, top: 200, width: 52, textAlign: 'center', fontSize: 13, color: '#fff', fontFamily: 'Roboto, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 4px #000' }}>
        {shortName || 'App'}
      </div>
    </div>
  )
}

function ManifestSplashPreview({ icon, name, bgColor }: { icon: string | null; name: string; bgColor: string }) {
  return (
    <div style={{
      width: 156, height: 228, borderRadius: 8, border: '1px solid #e0e0e0',
      userSelect: 'none', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Status bar */}
      <div style={{ height: 20, background: '#1a1a1a', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 6, color: '#999', fontFamily: 'Roboto, sans-serif' }}>12:30</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="#999"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 00-6 0zm-4-4l2 2a7.07 7.07 0 0110 0l2-2C15.68 9.68 8.32 9.68 5 13z"/></svg>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="#999"><rect x="2" y="6" width="18" height="12" rx="2"/><rect x="20" y="9" width="2" height="6" rx="1"/></svg>
        </div>
      </div>
      {/* Splash content */}
      <div style={{ flex: 1, background: bgColor, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon
              ? <img src={icon} alt="" width={26} height={26} style={{ objectFit: 'cover' }} />
              : <div style={{ width: 26, height: 26, background: 'rgba(0,0,0,.08)', borderRadius: '50%' }} />}
          </div>
        </div>
        <span style={{ fontSize: 8, color: '#000', fontFamily: 'Roboto, sans-serif', textAlign: 'center', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
          {name || 'App'}
        </span>
      </div>
      {/* Nav bar */}
      <div style={{ height: 9, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 2, borderRadius: 1, background: '#666' }} />
      </div>
    </div>
  )
}

function ManifestSwitchPreview({ icon, name, themeColor }: { icon: string | null; name: string; themeColor: string }) {
  return (
    <div style={{ position: 'relative', width: 376, height: 228, display: 'flex', justifyContent: 'center', userSelect: 'none' }}>
      <img src="/_opendoc/assets/app-switch.webp" alt="" width={376} height={228} style={{ position: 'absolute', left: 0, top: 0 }} />
      {/* Icon circle with theme color background */}
      <div style={{ position: 'relative', zIndex: 10, marginTop: 78, width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: themeColor }}>
        <div style={{ position: 'absolute', left: 6, top: 6, width: 24, height: 24, borderRadius: '50%', overflow: 'hidden' }}>
          {icon
            ? <img src={icon} alt="" width={24} height={24} style={{ objectFit: 'cover' }} />
            : <div style={{ width: 24, height: 24, background: 'rgba(0,0,0,.08)' }} />}
        </div>
      </div>
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

function SectionHeading({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h3 style={{ fontSize: 'var(--od-text-h3, 1.2rem)', fontWeight: 'var(--od-weight-h3, 600)', lineHeight: 'var(--od-line-height-heading, 1.2)', color: 'var(--od-text, #1a1a2e)', margin: 0, marginBottom: 6, ...style } as React.CSSProperties}>
      {children}
    </h3>
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
    fetch('/_opendoc/page')
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
      const img = await loadImage(rawUrl)
      const toBlob = (canvas: HTMLCanvasElement) =>
        new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'))

      async function uploadAsset(type: string, file: File) {
        const form = new FormData()
        form.append('file', file); form.append('pagePath', '.'); form.append('type', type)
        await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      }

      // 1. favicon-96x96.png
      const c96 = renderIconCanvas(img, 96, false, cfg.darkMode)
      await uploadAsset('favicon-96x96', new File([await toBlob(c96)], 'favicon-96x96.png', { type: 'image/png' }))

      // 2. favicon.svg
      const c120 = renderIconCanvas(img, 120, false, cfg.darkMode)
      const svgDataUrl = c120.toDataURL('image/png')
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="120" viewBox="0 0 120 120"><image width="120" height="120" xlink:href="${svgDataUrl}"/></svg>`
      await uploadAsset('favicon-svg', new File([svgContent], 'favicon.svg', { type: 'image/svg+xml' }))

      // 3. favicon.ico
      const c48 = renderIconCanvas(img, 48, false, cfg.darkMode)
      const pngBlob48 = await toBlob(c48)
      const pngBuf = new Uint8Array(await pngBlob48.arrayBuffer())
      const ico = new Uint8Array(6 + 16 + pngBuf.length)
      const view = new DataView(ico.buffer)
      view.setUint16(0, 0, true); view.setUint16(2, 1, true); view.setUint16(4, 1, true)
      ico[6] = 48; ico[7] = 48; ico[8] = 0; ico[9] = 0
      view.setUint16(10, 1, true); view.setUint16(12, 32, true)
      view.setUint32(14, pngBuf.length, true); view.setUint32(18, 22, true)
      ico.set(pngBuf, 22)
      await uploadAsset('favicon-ico', new File([ico], 'favicon.ico', { type: 'image/x-icon' }))

      // 4. apple-touch-icon.png (180x180)
      const c180 = renderPaddedCanvas(img, 180, cfg.appleTouchMode, cfg.appleTouchBgColor, cfg.appleTouchMargin)
      await uploadAsset('apple-touch-icon', new File([await toBlob(c180)], 'apple-touch-icon.png', { type: 'image/png' }))

      // 5. web-app-manifest-192x192.png
      const c192 = renderPaddedCanvas(img, 192, cfg.manifestMode, cfg.manifestBgColor, cfg.manifestMargin)
      await uploadAsset('web-app-manifest-192', new File([await toBlob(c192)], 'web-app-manifest-192x192.png', { type: 'image/png' }))

      // 6. web-app-manifest-512x512.png
      const c512 = renderPaddedCanvas(img, 512, cfg.manifestMode, cfg.manifestBgColor, cfg.manifestMargin)
      await uploadAsset('web-app-manifest-512', new File([await toBlob(c512)], 'web-app-manifest-512x512.png', { type: 'image/png' }))

      // 7. site.webmanifest
      const mName = cfg.manifestName || siteTitle || 'My Docs'
      const mShort = cfg.manifestShortName || mName
      const manifest = JSON.stringify({
        name: mName,
        short_name: mShort,
        icons: [
          { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        theme_color: cfg.themeColor,
        background_color: cfg.splashBgColor,
        display: 'standalone',
      }, null, 2)
      await uploadAsset('site-webmanifest', new File([manifest], 'site.webmanifest', { type: 'application/manifest+json' }))

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

  const appleName = cfg.appName || siteTitle || 'My Docs'
  const manifestName = cfg.manifestName || siteTitle || 'My Docs'
  const manifestShortName = cfg.manifestShortName || manifestName

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* ══ Section 1: Classic & SVG Favicons ══ */}
      <SectionHeading>Classic & SVG Favicons</SectionHeading>
      <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal" style={{ marginBottom: 12 }}>
        Generates favicon.ico, favicon.svg, and favicon-96x96.png for all browsers.
      </p>

      <div className="flex gap-12 flex-wrap items-start">
        <div className="flex-[0_0_260px] flex flex-col">
          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Source image</label>
            <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">SVG or PNG recommended. At least 512x512px for best results.</p>
            <input ref={fileRef} type="file" accept=".svg,.png" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
            <div className="od-ssp-dropzone flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[var(--od-border)] rounded-lg cursor-pointer transition-all duration-150 min-h-[80px] bg-[var(--od-bg-surface)] hover:border-[var(--od-accent)]"
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active') }}
              onDragLeave={e => e.currentTarget.classList.remove('active')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('active'); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              {rawUrl
                ? <img src={rawUrl} alt="Favicon source" width={36} height={36} style={{ objectFit: 'contain', borderRadius: 4 }} />
                : <Upload style={{ width: 20, height: 20, color: 'var(--od-text-muted, #6b7280)' }} />}
              <span className="text-sm text-[var(--od-text-muted)] text-center">{rawUrl ? 'Click or drag to replace' : 'Click or drag SVG / PNG here'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Dark mode favicon</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(['same', 'auto-invert', 'custom'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-[var(--od-text)] cursor-pointer">
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
                <Button variant="outline" size="sm" onClick={() => darkFileRef.current?.click()}>
                  <Upload style={{ width: 12, height: 12 }} />
                  {darkRawUrl ? 'Replace dark favicon' : 'Upload dark favicon'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-[300px] flex flex-col gap-8">
          <div className="flex gap-8 flex-wrap">
            <div><PreviewLabel>Browser — Light</PreviewLabel><BrowserPreview favicon={processed.light} siteTitle={siteTitle} theme="light" /></div>
            <div><PreviewLabel>Browser — Dark</PreviewLabel><BrowserPreview favicon={displayedDarkFavicon} siteTitle={siteTitle} theme="dark" /></div>
          </div>
          <div className="flex gap-8 flex-wrap">
            <div><PreviewLabel>Google — Light</PreviewLabel><GooglePreview favicon={processed.light} siteTitle={siteTitle} theme="light" /></div>
            <div><PreviewLabel>Google — Dark</PreviewLabel><GooglePreview favicon={displayedDarkFavicon} siteTitle={siteTitle} theme="dark" /></div>
          </div>
        </div>
      </div>

      {/* ══ Section 2: Apple Touch Icon ══ */}
      <SectionHeading style={{ marginTop: 32 }}>Apple Touch Icon</SectionHeading>
      <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal" style={{ marginBottom: 12 }}>
        180x180 icon for iOS "Add to Home Screen".
      </p>

      <div className="flex gap-12 flex-wrap items-start">
        <div className="flex-[0_0_260px] flex flex-col">
          <div className="flex flex-col gap-1.5 mb-[18px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(['as-is', 'background'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-[var(--od-text)] cursor-pointer">
                  <input type="radio" name="appleTouchMode" value={opt} checked={cfg.appleTouchMode === opt}
                    onChange={() => { setCfg(c => ({ ...c, appleTouchMode: opt })); setSaved(false) }} />
                  {opt === 'as-is' ? 'Use icon as is' : 'Add a plain background and margins'}
                </label>
              ))}
            </div>
            {cfg.appleTouchMode === 'background' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Background color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" className="w-9 h-[34px] p-0.5 border border-[var(--od-border)] rounded-md cursor-pointer bg-transparent" value={cfg.appleTouchBgColor}
                      onChange={e => { setCfg(c => ({ ...c, appleTouchBgColor: e.target.value })); setSaved(false) }} />
                    <span style={{ fontSize: 12, color: 'var(--od-text-muted, #6b7280)' }}>{cfg.appleTouchBgColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Image margin <span className="font-normal text-[var(--od-text-muted)]">{cfg.appleTouchMargin}%</span></label>
                  <input type="range" min={0} max={40} step={1} value={cfg.appleTouchMargin} className="w-full max-w-[280px] accent-[var(--od-accent)] cursor-pointer"
                    onChange={e => { setCfg(c => ({ ...c, appleTouchMargin: +e.target.value })); setSaved(false) }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">App name</label>
            <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">iOS home screen label.</p>
            <Input placeholder={siteTitle || 'My Docs'} value={cfg.appName}
              onChange={e => { setCfg(c => ({ ...c, appName: e.target.value })); setSaved(false) }} />
          </div>
        </div>

        <div className="flex-1 min-w-[300px] flex flex-col gap-8">
          <AppleTouchPreview favicon={processed.appleTouch} appName={appleName} />
        </div>
      </div>

      {/* ══ Section 3: Web App Manifest ══ */}
      <SectionHeading style={{ marginTop: 32 }}>Web App Manifest</SectionHeading>
      <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal" style={{ marginBottom: 12 }}>
        192x192 and 512x512 icons for Android "Add to Home Screen" and PWA install.
      </p>

      <div className="flex gap-12 flex-wrap items-start">
        <div className="flex-[0_0_260px] flex flex-col">
          <div className="flex flex-col gap-1.5 mb-[18px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(['as-is', 'background'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-[var(--od-text)] cursor-pointer">
                  <input type="radio" name="manifestMode" value={opt} checked={cfg.manifestMode === opt}
                    onChange={() => { setCfg(c => ({ ...c, manifestMode: opt })); setSaved(false) }} />
                  {opt === 'as-is' ? 'Use icon as is' : 'Add a plain background and margins'}
                </label>
              ))}
            </div>
            {cfg.manifestMode === 'background' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Icon background color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" className="w-9 h-[34px] p-0.5 border border-[var(--od-border)] rounded-md cursor-pointer bg-transparent" value={cfg.manifestBgColor}
                      onChange={e => { setCfg(c => ({ ...c, manifestBgColor: e.target.value })); setSaved(false) }} />
                    <span style={{ fontSize: 12, color: 'var(--od-text-muted, #6b7280)' }}>{cfg.manifestBgColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Image margin <span className="font-normal text-[var(--od-text-muted)]">{cfg.manifestMargin}%</span></label>
                  <input type="range" min={0} max={40} step={1} value={cfg.manifestMargin} className="w-full max-w-[280px] accent-[var(--od-accent)] cursor-pointer"
                    onChange={e => { setCfg(c => ({ ...c, manifestMargin: +e.target.value })); setSaved(false) }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Name</label>
            <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">Full app name shown on the splash screen.</p>
            <Input placeholder={siteTitle || 'My Docs'} value={cfg.manifestName}
              onChange={e => { setCfg(c => ({ ...c, manifestName: e.target.value })); setSaved(false) }} />
          </div>

          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Short name</label>
            <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">Shown below the icon on the home screen.</p>
            <Input placeholder={manifestName} value={cfg.manifestShortName}
              onChange={e => { setCfg(c => ({ ...c, manifestShortName: e.target.value })); setSaved(false) }} />
          </div>

          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Background color</label>
            <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">Splash screen background color.</p>
            <input type="color" className="w-9 h-[34px] p-0.5 border border-[var(--od-border)] rounded-md cursor-pointer bg-transparent" value={cfg.splashBgColor}
              onChange={e => { setCfg(c => ({ ...c, splashBgColor: e.target.value })); setSaved(false) }} />
          </div>

          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Theme color</label>
            <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">Color shown in the app switcher header bar.</p>
            <input type="color" className="w-9 h-[34px] p-0.5 border border-[var(--od-border)] rounded-md cursor-pointer bg-transparent" value={cfg.themeColor}
              onChange={e => { setCfg(c => ({ ...c, themeColor: e.target.value })); setSaved(false) }} />
          </div>
        </div>

        <div className="flex-1 min-w-[300px] flex flex-col gap-8">
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <PreviewLabel>Home</PreviewLabel>
              <ManifestHomePreview icon={processed.manifest} shortName={manifestShortName} />
            </div>
            <div>
              <PreviewLabel>Splash</PreviewLabel>
              <ManifestSplashPreview icon={processed.manifest} name={manifestName} bgColor={cfg.splashBgColor} />
            </div>
            <div>
              <PreviewLabel>Switch</PreviewLabel>
              <ManifestSwitchPreview icon={processed.manifest} name={manifestName} themeColor={cfg.themeColor} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ Save ══ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 32 }}>
        <Button variant="ghost" size="sm" onClick={() => { setCfg(c => ({ ...c, version: c.version + 1 })); setSaved(false) }}>
          <RefreshCcw style={{ width: 12, height: 12 }} /> Bust cache <span style={{ fontWeight: 400, color: 'var(--od-text-muted, #6b7280)' }}>v{cfg.version}</span>
        </Button>
        <Button onClick={handleSave} disabled={!rawUrl || saving}>
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Favicon'}
        </Button>
      </div>
    </div>
  )
}
