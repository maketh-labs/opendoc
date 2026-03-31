import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from './ui/button'
import { Upload, Trash2, Image, Globe } from 'lucide-react'

interface PageAssetSectionProps {
  label: string
  icon: React.ReactNode
  currentUrl: string | null
  inherited: boolean
  inheritedFrom?: string
  onUpload: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  uploading: boolean
}

function PageAssetSection({ label, icon, currentUrl, inherited, onUpload, onDelete, uploading }: PageAssetSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const accept = label === 'Favicon'
    ? '.ico,.svg,.png'
    : '.png,.jpg,.jpeg,.webp'

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
          {inherited && (
            <span className="od-ps-inherited">Inherited</span>
          )}
          <div className="od-ps-actions">
            <input ref={fileRef} type="file" accept={accept} hidden onChange={e => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }} />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-3 w-3 mr-1" />{uploading ? 'Uploading…' : 'Replace'}
            </Button>
            {!inherited && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={onDelete}>
                <Trash2 className="h-3 w-3 mr-1" />Remove
              </Button>
            )}
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
          <span className="od-ps-hint">No {label.toLowerCase()} set for this page</span>
        </div>
      )}
    </div>
  )
}

export interface PageSettingsPanelProps {
  pagePath: string
  onClose: () => void
}

export function PageSettingsPanel({ pagePath, onClose }: PageSettingsPanelProps) {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null)
  const [faviconInherited, setFaviconInherited] = useState(false)
  const [ogImageInherited, setOgImageInherited] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Derive the page directory from the file path (e.g. "guides/index.md" -> "guides")
  const pageDir = pagePath.replace(/\/index\.md$/, '') || '.'

  const fetchAssets = useCallback(async () => {
    try {
      const dirPath = pageDir === '.' ? '' : pageDir
      const r = await fetch(`/_opendoc/page?path=${encodeURIComponent(dirPath)}`)
      if (!r.ok) return
      const data = await r.json()
      setFaviconUrl(data.faviconUrl || null)
      setOgImageUrl(data.ogImageUrl || null)
      setFaviconInherited(data.faviconInherited || false)
      setOgImageInherited(data.ogImageInherited || false)
    } catch {}
  }, [pageDir])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  async function uploadAsset(file: File, type: 'favicon' | 'og-image') {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('pagePath', pageDir)
      form.append('type', type)
      const r = await fetch('/_opendoc/page-asset', { method: 'POST', body: form })
      if (r.ok) {
        await fetchAssets()
      }
    } finally {
      setUploading(false)
    }
  }

  async function deleteAsset(type: 'favicon' | 'og-image') {
    try {
      await fetch('/_opendoc/page-asset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagePath: pageDir, type }),
      })
      await fetchAssets()
    } catch {}
  }

  return (
    <div className="od-page-settings">
      <div className="od-page-settings-header">
        <h3>Page Settings</h3>
        <button className="od-close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="od-page-settings-body">
        <PageAssetSection
          label="Favicon"
          icon={<Globe className="h-4 w-4" />}
          currentUrl={faviconUrl}
          inherited={faviconInherited}
          onUpload={f => uploadAsset(f, 'favicon')}
          onDelete={() => deleteAsset('favicon')}
          uploading={uploading}
        />
        <div className="od-ps-separator" />
        <PageAssetSection
          label="OG Image"
          icon={<Image className="h-4 w-4" />}
          currentUrl={ogImageUrl}
          inherited={ogImageInherited}
          onUpload={f => uploadAsset(f, 'og-image')}
          onDelete={() => deleteAsset('og-image')}
          uploading={uploading}
        />
      </div>
    </div>
  )
}
