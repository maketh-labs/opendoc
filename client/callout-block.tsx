import React from "react"
import { createReactBlockSpec } from "@blocknote/react"

export const CALLOUT_TYPES = {
  info:      { icon: "ℹ️",  label: "Info",      bg: "#eff6ff", border: "#93c5fd" },
  note:      { icon: "📝",  label: "Note",      bg: "#f9fafb", border: "#d1d5db" },
  tip:       { icon: "💡",  label: "Tip",       bg: "#ecfdf5", border: "#6ee7b7" },
  warning:   { icon: "⚠️",  label: "Warning",   bg: "#fffbeb", border: "#fcd34d" },
  caution:   { icon: "🔥",  label: "Caution",   bg: "#fef2f2", border: "#fca5a5" },
  important: { icon: "❗",  label: "Important", bg: "#f5f3ff", border: "#c4b5fd" },
} as const

export type CalloutType = keyof typeof CALLOUT_TYPES

export const CalloutBlock = createReactBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      calloutType: { default: "info" as CalloutType },
    },
    content: "inline" as const,
  },
  {
    render: ({ block, editor, contentRef }) => {
      const ct = (block.props.calloutType as CalloutType) || "info"
      const { icon, label } = CALLOUT_TYPES[ct] || CALLOUT_TYPES.info

      function cycleType() {
        const keys = Object.keys(CALLOUT_TYPES) as CalloutType[]
        const next = keys[(keys.indexOf(ct) + 1) % keys.length]
        editor.updateBlock(block, { props: { calloutType: next } })
      }

      return (
        <div className={`od-callout od-callout-${ct}`}>
          <button
            className="od-callout-icon"
            contentEditable={false}
            onClick={cycleType}
            title={`${label} — click to change type`}
          >
            {icon}
          </button>
          <div className="od-callout-content" ref={contentRef} />
        </div>
      )
    },
  },
)
