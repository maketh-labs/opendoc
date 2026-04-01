import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import type { Block } from '@blocknote/core'
import { blocksToMarkdown } from './markdown'
import { CALLOUT_TYPES, type CalloutType } from './callout-block'
import { getEmbedUrl } from './youtube-block'
import { schema } from './editor'

interface BlockEditorProps {
  initialBlocks: Block[]
  pagePath: string
  onContentChange: (md: string) => void
  theme: 'light' | 'dark'
  pageHeader?: React.ReactNode
}

function usePasteHandler(editor: any, uploadFile: (f: File) => Promise<string>) {
  useEffect(() => {
    const container = document.querySelector(".bn-editor")
    if (!container) return

    const handlePaste = async (e: ClipboardEvent) => {
      const mediaFiles = Array.from(e.clipboardData?.files || []).filter(f =>
        f.type.startsWith("image/") || f.type.startsWith("video/")
      )
      if (mediaFiles.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        const pos = editor.getTextCursorPosition()
        for (const file of mediaFiles) {
          try {
            const url = await uploadFile(file)
            const blockType = file.type.startsWith("video/") ? "video" : "image"
            editor.insertBlocks(
              [{ type: blockType as any, props: { url, name: file.name, caption: "" } }],
              pos.block,
              "before"
            )
          } catch (err) {
            console.error("Media upload failed:", err)
          }
        }
        return
      }

      const text = e.clipboardData?.getData("text/plain")?.trim() || ""
      if (/^https?:\/\/[^\s]+$/.test(text)) {
        e.preventDefault()
        e.stopPropagation()
        const pos = editor.getTextCursorPosition()
        const embedUrl = getEmbedUrl(text)
        if (embedUrl) {
          editor.insertBlocks(
            [{ type: "youtube" as const, props: { url: text, caption: "" } }],
            pos.block,
            "before"
          )
        } else {
          editor.insertBlocks(
            [{ type: "bookmark" as const, props: { url: text, title: "", description: "", favicon: "", domain: "", imageUrl: "" } } as any],
            pos.block,
            "before"
          )
        }
      }
    }

    container.addEventListener("paste", handlePaste as unknown as EventListener)
    return () => container.removeEventListener("paste", handlePaste as unknown as EventListener)
  }, [editor, uploadFile])
}

function useDragDropHandler(
  editorWrapperRef: React.RefObject<HTMLDivElement | null>,
  editor: any,
  uploadFile: (f: File) => Promise<string>,
) {
  useEffect(() => {
    const wrapper = editorWrapperRef.current
    if (!wrapper) return

    const handleDragOver = (e: DragEvent) => {
      const hasFiles = Array.from(e.dataTransfer?.items || []).some(
        item => item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))
      )
      if (hasFiles) {
        e.preventDefault()
        e.dataTransfer!.dropEffect = "copy"
        wrapper.classList.add("od-drag-over")
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      if (!wrapper.contains(e.relatedTarget as Node)) {
        wrapper.classList.remove("od-drag-over")
      }
    }

    const handleDrop = async (e: DragEvent) => {
      wrapper.classList.remove("od-drag-over")
      const mediaFiles = Array.from(e.dataTransfer?.files || []).filter(f =>
        f.type.startsWith("image/") || f.type.startsWith("video/")
      )
      if (mediaFiles.length === 0) return
      e.preventDefault()
      e.stopPropagation()

      const pos = editor.getTextCursorPosition()
      for (const file of mediaFiles) {
        try {
          const url = await uploadFile(file)
          const blockType = file.type.startsWith("video/") ? "video" : "image"
          editor.insertBlocks(
            [{ type: blockType as any, props: { url, name: file.name, caption: "" } }],
            pos.block,
            "before"
          )
        } catch (err) {
          console.error("Media drop upload failed:", err)
        }
      }
    }

    wrapper.addEventListener("dragover", handleDragOver)
    wrapper.addEventListener("dragleave", handleDragLeave)
    wrapper.addEventListener("drop", handleDrop)

    return () => {
      wrapper.removeEventListener("dragover", handleDragOver)
      wrapper.removeEventListener("dragleave", handleDragLeave)
      wrapper.removeEventListener("drop", handleDrop)
    }
  }, [editor, uploadFile])
}

export function BlockEditor({ initialBlocks, pagePath, onContentChange, theme, pageHeader }: BlockEditorProps) {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    form.append('pagePath', pagePath.replace(/\/[^/]+$/, '') || '.')
    const r = await fetch('/_opendoc/upload', { method: 'POST', body: form })
    if (!r.ok) throw new Error('Upload failed')
    return (await r.json()).url as string
  }, [pagePath])

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks as any,
    uploadFile,
    tables: { headers: true },
  })

  usePasteHandler(editor, uploadFile)
  useDragDropHandler(editorWrapperRef, editor, uploadFile)

  const [editorEmpty, setEditorEmpty] = useState(() => {
    if (!initialBlocks.length) return true
    if (initialBlocks.length === 1 && initialBlocks[0].type === 'paragraph') {
      const c = initialBlocks[0].content
      if (!c || (Array.isArray(c) && c.length === 0)) return true
    }
    return false
  })

  const handleChange = useCallback(() => {
    const md = blocksToMarkdown(editor.document as any[])
    onContentChange(md)
    setEditorEmpty(md.trim() === '')
  }, [editor, onContentChange])

  const getSlashMenuItems = useCallback(async (query: string) => {
    const defaults = getDefaultReactSlashMenuItems(editor)
    const calloutItems = Object.entries(CALLOUT_TYPES).map(([key, { icon, label }]) => ({
      title: label,
      subtext: `${label} callout`,
      aliases: [key, "callout", "alert"],
      group: "Callouts",
      icon: <span style={{ fontSize: 16 }}>{icon}</span>,
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: "callout" as const, props: { calloutType: key as CalloutType } } as any],
          editor.getTextCursorPosition().block,
          "before"
        )
      },
    }))
    const bookmarkItem = {
      title: "Bookmark",
      subtext: "Embed a link preview card",
      aliases: ["bookmark", "link", "embed", "url", "preview"],
      group: "Media",
      icon: <span style={{ fontSize: 16 }}>🔗</span>,
      onItemClick: () => {
        const url = prompt("Paste a URL to bookmark:")
        if (!url || !/^https?:\/\//.test(url)) return
        const pos = editor.getTextCursorPosition()
        editor.insertBlocks(
          [{ type: "bookmark" as const, props: { url, title: "", description: "", favicon: "", domain: "", imageUrl: "" } } as any],
          pos.block,
          "before"
        )
      },
    }
    const youtubeItem = {
      title: "YouTube / Embed",
      subtext: "Embed a YouTube, Vimeo, or Loom video",
      onItemClick: () => {
        const url = window.prompt("Paste a YouTube, Vimeo, or Loom URL:")
        if (!url) return
        const pos = editor.getTextCursorPosition()
        editor.insertBlocks(
          [{ type: "youtube" as const, props: { url, caption: "" } }],
          pos.block,
          "before"
        )
      },
      aliases: ["youtube", "vimeo", "loom", "embed", "video url"],
      group: "Media",
      icon: <span style={{ fontSize: 18 }}>&#9654;&#65039;</span>,
    }
    return filterSuggestionItems([...defaults, ...calloutItems, bookmarkItem, youtubeItem], query)
  }, [editor])

  return (
    <div className="w-full flex flex-col" ref={editorWrapperRef}>
      {pageHeader}
      <div style={{ position: 'relative' }}>
        {editorEmpty && (
          <div className="absolute top-3 left-[54px] text-[var(--od-color-text-muted)] pointer-events-none text-[length:var(--od-font-size,16px)] leading-[var(--od-line-height,1.7)] opacity-50 z-[1] select-none">Start writing...</div>
        )}
        <BlockNoteView editor={editor} theme={theme} onChange={handleChange} slashMenu={false}>
          <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />
        </BlockNoteView>
      </div>
    </div>
  )
}
