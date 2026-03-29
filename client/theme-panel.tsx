import React, { memo, useRef, useEffect } from 'react'
import { initThemePanel } from './themes'
import { initFaviconPanel } from './favicon'

export const ThemePanel = memo(function ThemePanel({ onClose }: { onClose: () => void }) {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initThemePanel()
    initFaviconPanel()
  }, [])

  return (
    <div className="od-theme-panel">
      <div className="od-theme-panel-header">
        <h3>Themes</h3>
        <button className="od-close-btn" id="close-right" onClick={onClose}>&times;</button>
      </div>
      <div className="od-theme-search">
        <input type="search" placeholder="Search themes..." id="theme-search-input" />
      </div>
      <div className="od-theme-grid" id="theme-grid" />
      <div className="od-theme-actions" id="theme-actions" style={{ display: 'none' }}>
        <button className="od-btn od-btn-secondary" id="theme-cancel">Cancel</button>
        <button className="od-btn od-btn-primary" id="theme-save">Save</button>
      </div>
      <details className="od-css-customizer">
        <summary>Customize CSS</summary>
        <div className="od-css-editor-wrap">
          <div className="od-css-tabs" id="css-tabs" style={{ display: 'none' }}>
            <button className="od-css-tab active" id="css-tab-light">Light</button>
            <button className="od-css-tab" id="css-tab-dark">Dark</button>
          </div>
          <textarea className="od-css-editor" id="css-editor" spellCheck={false}>{'/* Loading... */'}</textarea>
          <div className="od-css-editor-actions">
            <button className="od-btn od-btn-ghost" id="css-reset">Reset</button>
            <button className="od-btn od-btn-ghost" id="css-copy">Copy</button>
            <button className="od-btn od-btn-primary" id="css-save">Save</button>
          </div>
        </div>
      </details>
      <details className="od-favicon-panel">
        <summary>Favicon</summary>
        <div className="od-favicon-content">
          <div className="od-favicon-drop" id="favicon-drop">
            <input type="file" id="favicon-upload" accept="image/png,image/svg+xml" hidden />
            <div className="od-favicon-drop-inner" id="favicon-drop-inner">
              <p>Drop a 512×512 PNG or SVG</p>
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
  )
})
