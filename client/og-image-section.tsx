import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'

function TwitterCardPreview({ imageUrl, siteTitle }: { imageUrl: string | null; siteTitle: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#536471', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Twitter / X</div>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #cfd9de', width: 360 }}>
        {imageUrl
          ? <img src={imageUrl} alt="" style={{ width: '100%', aspectRatio: '1200/630', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', aspectRatio: '1200/630', background: '#e7e7e7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#8899a6' }}>1200 × 630</span>
            </div>}
        <div style={{ padding: '10px 12px', background: '#fff' }}>
          <div style={{ fontSize: 11, color: '#536471', marginBottom: 2 }}>localhost:3000</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f1419', lineHeight: 1.3 }}>{siteTitle || 'My Docs'}</div>
        </div>
      </div>
    </div>
  )
}

function SlackPreview({ imageUrl, siteTitle }: { imageUrl: string | null; siteTitle: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#536471', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slack</div>
      <div style={{ borderLeft: '3px solid #ddd', paddingLeft: 10, maxWidth: 360 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1264a3', marginBottom: 3 }}>localhost:3000</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1d1c1d', marginBottom: 6 }}>{siteTitle || 'My Docs'}</div>
        {imageUrl
          ? <img src={imageUrl} alt="" style={{ width: '100%', maxWidth: 360, aspectRatio: '1200/630', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
          : <div style={{ width: '100%', maxWidth: 360, aspectRatio: '1200/630', background: '#f1f1f1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#999' }}>no image</span>
            </div>}
      </div>
    </div>
  )
}

function IMessagePreview({ imageUrl, siteTitle }: { imageUrl: string | null; siteTitle: string }) {
  return (
    <div style={{ fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#536471', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>iMessage</div>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e0e0e0', background: '#fff', width: 240 }}>
        {imageUrl
          ? <img src={imageUrl} alt="" style={{ width: '100%', aspectRatio: '1200/630', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', aspectRatio: '1200/630', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>1200 × 630</span>
            </div>}
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 1 }}>LOCALHOST:3000</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#000' }}>{siteTitle || 'My Docs'}</div>
        </div>
      </div>
    </div>
  )
}

export function OGImageSection({ siteTitle }: { siteTitle: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fetch('/_opendoc/page').then(r => r.json())
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
    <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">
          Recommended: <strong>1200 × 630 px</strong>, PNG or JPG.
          Shown when pages are shared on social media, Slack, iMessage, and in Google search results.
        </p>
        <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        {currentUrl ? (
          <>
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--od-border, #e1e4e8)', aspectRatio: '1200/630', background: '#f0f0f0' }}>
              <img src={currentUrl} alt="OG image preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload style={{ width: 12, height: 12 }} />
                {uploading ? 'Uploading...' : 'Replace'}
              </Button>
              <Button variant="destructive" size="sm" onClick={remove}>Remove</Button>
            </div>
          </>
        ) : (
          <div className="od-ssp-dropzone flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[var(--od-border)] rounded-lg cursor-pointer transition-all duration-150 min-h-[80px] bg-[var(--od-bg-surface)] hover:border-[var(--od-accent)]" style={{ aspectRatio: '1200/630' }}
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active') }}
            onDragLeave={e => e.currentTarget.classList.remove('active')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('active'); const f = e.dataTransfer.files[0]; if (f) upload(f) }}
          >
            <Upload style={{ width: 20, height: 20, color: 'var(--od-text-muted, #6b7280)' }} />
            <span className="text-sm text-[var(--od-text-muted)] text-center">Click or drag — PNG / JPG</span>
            <span className="text-[0.78rem] text-[var(--od-text-muted)] m-0 leading-normal">1200 × 630 px</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <TwitterCardPreview imageUrl={currentUrl} siteTitle={siteTitle} />
        <SlackPreview       imageUrl={currentUrl} siteTitle={siteTitle} />
        <IMessagePreview    imageUrl={currentUrl} siteTitle={siteTitle} />
      </div>
    </div>
  )
}
