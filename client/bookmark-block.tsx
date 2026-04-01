import React, { useEffect, useState } from "react"
import { createReactBlockSpec } from "@blocknote/react"

interface BookmarkMeta {
  title: string
  description: string
  imageUrl: string
  favicon: string
  domain: string
  url: string
}

async function fetchMeta(url: string): Promise<BookmarkMeta | null> {
  try {
    const r = await fetch(`/_opendoc/fetch-meta?url=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    return await r.json() as BookmarkMeta
  } catch {
    return null
  }
}

const bookmarkBlockConfig = {
  type: "bookmark" as const,
  propSchema: {
    url: { default: "" },
    title: { default: "" },
    description: { default: "" },
    favicon: { default: "" },
    domain: { default: "" },
    imageUrl: { default: "" },
  },
  content: "none" as const,
}

export const BookmarkBlock = createReactBlockSpec(bookmarkBlockConfig, {
  render: ({ block, editor }) => {
    const { url, title, description, favicon, domain, imageUrl } = block.props
    const [loading, setLoading] = useState(!title && !!url)
    const [meta, setMeta] = useState<BookmarkMeta | null>(
      title ? { url, title, description, favicon, domain, imageUrl } : null
    )

    useEffect(() => {
      if (!url || title) return
      let cancelled = false
      setLoading(true)
      fetchMeta(url).then(m => {
        if (cancelled) return
        if (m) {
          setMeta(m)
          editor.updateBlock(block, { props: { ...m } })
        }
        setLoading(false)
      })
      return () => { cancelled = true }
    }, [url])

    const displayMeta = meta || {
      url,
      title: url,
      description: "",
      favicon: "",
      domain: (() => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" } })(),
      imageUrl: "",
    }

    if (loading) {
      return (
        <div className="flex items-stretch border border-[var(--od-color-border)] rounded-[var(--od-radius)] overflow-hidden no-underline text-inherit min-h-[72px] my-0.5 bg-[var(--od-color-surface)]" contentEditable={false}>
          <div className="flex-1 py-3 px-4 flex flex-col gap-1 min-w-0">
            <div className="bg-[var(--od-color-border)] rounded h-4 w-3/5 animate-[od-shimmer_1.2s_ease-in-out_infinite]" />
            <div className="bg-[var(--od-color-border)] rounded h-3 w-4/5 mt-1 animate-[od-shimmer_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
      )
    }

    return (
      <a
        className="flex items-stretch border border-[var(--od-color-border)] rounded-[var(--od-radius)] overflow-hidden no-underline text-inherit transition-all duration-150 cursor-pointer select-none min-h-[72px] my-0.5 hover:border-[var(--od-color-text-muted)] hover:shadow-sm"
        href={displayMeta.url}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 py-3 px-4 flex flex-col gap-1 min-w-0">
          <div className="text-sm font-medium text-[var(--od-color-text)] whitespace-nowrap overflow-hidden text-ellipsis">{displayMeta.title || displayMeta.url}</div>
          {displayMeta.description && (
            <div className="text-xs text-[var(--od-color-text-muted)] line-clamp-2">{displayMeta.description.slice(0, 120)}{displayMeta.description.length > 120 ? "..." : ""}</div>
          )}
          <div className="flex items-center gap-1.5 mt-auto pt-1">
            {displayMeta.favicon && (
              <img
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                src={displayMeta.favicon}
                alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            )}
            <span className="text-xs text-[var(--od-color-text-muted)]">{displayMeta.domain}</span>
          </div>
        </div>
        {displayMeta.imageUrl && (
          <div className="shrink-0 w-40 overflow-hidden">
            <img
              className="w-full h-full object-cover block rounded-none border-none"
              src={displayMeta.imageUrl}
              alt={displayMeta.title}
              onError={e => { (e.target as HTMLElement).parentElement!.style.display = "none" }}
            />
          </div>
        )}
      </a>
    )
  },
})
