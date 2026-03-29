import React from 'react'
import { createReactBlockSpec } from '@blocknote/react'

export function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
      let id = u.searchParams.get("v")
      if (!id) id = u.pathname.replace(/^\//, "").split("?")[0] ?? null
      if (id) return `https://www.youtube.com/embed/${id}?rel=0`
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0]
      if (id) return `https://player.vimeo.com/video/${id}`
    }
    if (u.hostname.includes("loom.com")) {
      const id = u.pathname.replace(/\/share\//, "").split("/")[0]
      if (id) return `https://www.loom.com/embed/${id}`
    }
    return null
  } catch {
    return null
  }
}

export const YoutubeBlock = createReactBlockSpec(
  {
    type: "youtube" as const,
    propSchema: {
      url: { default: "" },
      caption: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      const embedUrl = getEmbedUrl(block.props.url)
      if (!embedUrl) {
        return (
          <div style={{ padding: "8px 12px", background: "var(--bn-colors-editor-background)", border: "1px solid var(--bn-colors-editor-border)", borderRadius: 6, color: "var(--bn-colors-editor-text)", fontSize: 14 }}>
            Could not embed: {block.props.url}
          </div>
        )
      }
      return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", background: "#000" }}>
            <iframe
              src={embedUrl}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              frameBorder="0"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="Embedded video"
            />
          </div>
          {block.props.caption && (
            <div style={{ textAlign: "center", fontSize: 13, color: "var(--bn-colors-editor-text)", opacity: 0.6 }}>
              {block.props.caption}
            </div>
          )}
        </div>
      )
    },
  }
)
