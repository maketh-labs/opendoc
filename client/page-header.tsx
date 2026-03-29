import React, { useRef, useEffect, useState, useCallback } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

export interface PageHeaderProps {
  title: string
  icon: string
  onTitleChange: (t: string) => void
  onIconChange: (i: string) => void
  darkMode?: 'light' | 'dark'
}

export function PageHeader({ title, icon, onTitleChange, onIconChange, darkMode }: PageHeaderProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [title])

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    onIconChange(emoji.native)
    setPickerOpen(false)
  }, [onIconChange])

  return (
    <div className="od-page-header">
      {icon && (
        <div className="od-page-icon-wrap">
          <button
            ref={buttonRef}
            className="od-page-icon"
            onClick={() => setPickerOpen(o => !o)}
          >
            {icon}
          </button>
          {pickerOpen && (
            <div ref={pickerRef} className="od-emoji-picker">
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme={darkMode === 'dark' ? 'dark' : 'light'}
                previewPosition="none"
                skinTonePosition="search"
              />
            </div>
          )}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="od-page-title"
        value={title}
        placeholder="Untitled"
        onChange={e => onTitleChange(e.target.value)}
        rows={1}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault() }
        }}
      />
    </div>
  )
}
