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

export const bookmarkBlockConfig = {
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
        <div className="od-bookmark od-bookmark-loading" contentEditable={false}>
          <div className="od-bookmark-info">
            <div className="od-bookmark-title-skeleton" />
            <div className="od-bookmark-desc-skeleton" />
          </div>
        </div>
      )
    }

    return (
      <a
        className="od-bookmark"
        href={displayMeta.url}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        onClick={e => e.stopPropagation()}
      >
        <div className="od-bookmark-info">
          <div className="od-bookmark-title">{displayMeta.title || displayMeta.url}</div>
          {displayMeta.description && (
            <div className="od-bookmark-desc">{displayMeta.description.slice(0, 120)}{displayMeta.description.length > 120 ? "..." : ""}</div>
          )}
          <div className="od-bookmark-meta">
            {displayMeta.favicon && (
              <img
                className="od-bookmark-favicon"
                src={displayMeta.favicon}
                alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            )}
            <span className="od-bookmark-domain">{displayMeta.domain}</span>
          </div>
        </div>
        {displayMeta.imageUrl && (
          <div className="od-bookmark-cover">
            <img
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
