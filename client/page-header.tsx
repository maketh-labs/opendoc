import React, { useRef, useEffect } from 'react'

export interface PageHeaderProps {
  title: string
  icon: string
  onTitleChange: (t: string) => void
  onIconChange: (i: string) => void
}

export function PageHeader({ title, icon, onTitleChange, onIconChange }: PageHeaderProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [title])

  return (
    <div className="od-page-header">
      {icon && (
        <button className="od-page-icon" onClick={() => {
          const newIcon = prompt('Enter emoji icon:', icon)
          if (newIcon !== null) onIconChange(newIcon.trim())
        }}>
          {icon}
        </button>
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
