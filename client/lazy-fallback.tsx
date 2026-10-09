import React from 'react'

/** Placeholder shown while a code-split part of the editor loads. */
export function LazyFallback({ label = 'Loading…' }: { label?: string }) {
  return <div className="p-4 text-sm text-[var(--color-muted)]">{label}</div>
}
