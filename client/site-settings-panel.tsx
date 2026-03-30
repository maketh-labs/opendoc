import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from './ui/button'
import { Upload, Trash2, Image, Globe, Type } from 'lucide-react'

// ─── Asset section (reused from page-settings-panel pattern) ──────────────────

function AssetSection({ label, icon, currentUrl, onUpload, onDelete, uploading, accept }: {
  label: string
  icon: React.ReactNode
  currentUrl: string | null
  onUpload: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  uploading: boolean
  accept: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="od-ps-section">
      <div className="od-ps-section-header">
        {icon}
        <span className="od-ps-section-title">{label}</span>
      </div>
      {currentUrl ? (
        <div className="od-ps-preview">
          <img
            src={currentUrl}
            alt={label}
            className={label === 'Favicon' ? 'od-ps-favicon-preview' : 'od-ps-og-preview'}
          />
          <div className="od-ps-actions">
            <input ref={fileRef} type="file" accept={accept} hidden onChange={e => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }} />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-3 w-3 mr-1" />{uploading ? 'Uploading…' : 'Replace'}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" />Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="od-ps-empty">
          <input ref={fileRef} type="file" accept={accept} hidden onChange={e => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }} />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-3 w-3 mr-1" />{uploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
          </Button>
          <span className="od-ps-hint">Applies to all pages</span>
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export interface SiteSettingsPanelProps {
  onClose: () => void
}

export function SiteSettingsPanel({ onClose }: SiteSettingsPanelProps) {
  const [siteTitle, setSiteTitle] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Fetch config for site title
      const cfgRes = await fetch('/_opendoc/config.json')
      if (cfgRes.ok) {
        const cfg = await cfgRes.json()
        setSiteTitle(cfg.title ?? '')
        setSavedTitle(cfg.title ?? '')
      }
    } catch {}

    try {
      // Fetch root page assets
      const pageRes = await fetch('/_opendoc/page?path=')
      if (pageRes.ok) {
        const data = await pageRes.json()
        setFaviconUrl(data.faviconUrl || null)
        setOgImageUrl(data.ogImageUrl || null)
      }
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveTitle() {
    setSavingTitle(true)
    try {
      await fetch('/_opendoc/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: siteTitle }),
      })
      setSavedTitle(siteTitle)
    } finally {
      setSavingTitle(false)
    }
  }

  async function uploadAsset(file: File, type: 'favicon' | 'og-image') {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('pagePath', '.')
      form.append('type', type)
      await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      await fetchData()
    } finally {
      setUploading(false)
    }
  }

  async function deleteAsset(type: 'favicon' | 'og-image') {
    try {
      await fetch('/_opendoc/page-asset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagePath: '.', type }),
      })
      await fetchData()
    } catch {}
  }

  const titleDirty = siteTitle !== savedTitle

  return (
    <div className="od-page-settings">
      <div className="od-page-settings-header">
        <h3>Site Settings</h3>
        <button className="od-close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="od-page-settings-body">

        {/* Site title */}
        <div className="od-ps-section">
          <div className="od-ps-section-header">
            <Type className="h-4 w-4" />
            <span className="od-ps-section-title">Site title</span>
          </div>
          <div className="od-ps-title-row">
            <input
              className="od-ps-title-input"
              type="text"
              value={siteTitle}
              placeholder="My Docs"
              onChange={e => setSiteTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && titleDirty) saveTitle() }}
            />
            {titleDirty && (
              <Button size="sm" className="h-7 text-xs shrink-0" onClick={saveTitle} disabled={savingTitle}>
                {savingTitle ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </div>

        <div className="od-ps-separator" />

        {/* Global favicon */}
        <AssetSection
          label="Favicon"
          icon={<Globe className="h-4 w-4" />}
          currentUrl={faviconUrl}
          onUpload={f => uploadAsset(f, 'favicon')}
          onDelete={() => deleteAsset('favicon')}
          uploading={uploading}
          accept=".ico,.svg,.png"
        />

        <div className="od-ps-separator" />

        {/* Global OG image */}
        <AssetSection
          label="OG Image"
          icon={<Image className="h-4 w-4" />}
          currentUrl={ogImageUrl}
          onUpload={f => uploadAsset(f, 'og-image')}
          onDelete={() => deleteAsset('og-image')}
          uploading={uploading}
          accept=".png,.jpg,.jpeg,.webp"
        />

      </div>
    </div>
  )
}
