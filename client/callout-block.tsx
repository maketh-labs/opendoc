import React from "react"
import { createReactBlockSpec } from "@blocknote/react"

export const CALLOUT_TYPES = {
  info:      { icon: "ℹ️",  label: "Info",      bg: "#eff6ff", border: "#93c5fd" },
  note:      { icon: "📝",  label: "Note",      bg: "#f9fafb", border: "#d1d5db" },
  tip:       { icon: "💡",  label: "Tip",       bg: "#ecfdf5", border: "#6ee7b7" },
  warning:   { icon: "⚠️",  label: "Warning",   bg: "#fffbeb", border: "#fcd34d" },
  caution:   { icon: "🔥",  label: "Caution",   bg: "#fef2f2", border: "#fca5a5" },
  important: { icon: "❗",  label: "Important", bg: "#f5f3ff", border: "#c4b5fd" },
  danger:    { icon: "🔥",  label: "Danger",    bg: "#fef2f2", border: "#fca5a5" },
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
        <div className={`od-callout-${ct} flex items-start gap-3 py-3 px-4 rounded-[var(--od-radius,6px)] border-l-4 my-0.5`}>
          <button
            className="text-lg leading-[1.5] shrink-0 bg-transparent border-none cursor-pointer p-0 rounded select-none transition-transform duration-100 hover:scale-[1.2]"
            contentEditable={false}
            onClick={cycleType}
            title={`${label} — click to change type`}
            aria-label={`${label} callout — click to change type`}
          >
            {icon}
          </button>
          <div className="flex-1 min-w-0" ref={contentRef} />
        </div>
      )
    },
  },
)
