import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Separator } from './ui/separator'
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
    <div className="flex-1 overflow-y-auto bg-[var(--od-bg)]">
      <div className="max-w-[860px] mx-auto px-10 pt-12 pb-20">
        <h1 className="text-[length:var(--od-text-h1,2.5rem)] font-[number:var(--od-weight-h1,700)] leading-[var(--od-line-height-heading,1.2)] text-[var(--od-text)] mb-8">Site Settings</h1>

        <section className="mb-8">
          <h2 className="text-[length:var(--od-text-h2,1.5rem)] font-[number:var(--od-weight-h2,600)] leading-[var(--od-line-height-heading,1.2)] text-[var(--od-text)] mb-5">General</h2>
          <div className="flex flex-col gap-1.5 mb-[18px]">
            <label className="text-sm font-medium text-[var(--od-text)] flex items-center gap-1.5">Site title</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input
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

        <Separator className="mt-8 mb-10" />

        <section className="mb-8">
          <h2 className="text-[length:var(--od-text-h2,1.5rem)] font-[number:var(--od-weight-h2,600)] leading-[var(--od-line-height-heading,1.2)] text-[var(--od-text)] mb-5">Favicon</h2>
          <FaviconSection siteTitle={savedTitle} />
        </section>

        <Separator className="mt-8 mb-10" />

        <section className="mb-8">
          <h2 className="text-[length:var(--od-text-h2,1.5rem)] font-[number:var(--od-weight-h2,600)] leading-[var(--od-line-height-heading,1.2)] text-[var(--od-text)] mb-5">OG Image</h2>
          <OGImageSection siteTitle={savedTitle} />
        </section>
      </div>
    </div>
  )
}
