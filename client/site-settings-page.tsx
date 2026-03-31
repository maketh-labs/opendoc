import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { FaviconSection } from './favicon-section'
import { OGImageSection } from './og-image-section'

export function SiteSettingsPage() {
  const [siteTitle, setSiteTitle]   = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  useEffect(() => {
    fetch('/_opendoc/config.json')
      .then(r => r.json())
      .then(cfg => { setSiteTitle(cfg.title ?? ''); setSavedTitle(cfg.title ?? '') })
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

        <section className="od-ssp-section">
          <h2 className="od-ssp-section-heading">Favicon</h2>
          <FaviconSection siteTitle={savedTitle} />
        </section>

        <div className="od-ssp-divider" />

        <section className="od-ssp-section">
          <h2 className="od-ssp-section-heading">OG Image</h2>
          <OGImageSection siteTitle={savedTitle} />
        </section>
      </div>
    </div>
  )
}
