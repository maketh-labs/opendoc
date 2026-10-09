// Pure text helpers for viewer search results (no DOM) — unit tested.

export interface SearchDoc {
  id: string
  url: string
  title: string
  headings: string[]
  text: string
}

export interface SearchIndexFile {
  version: number
  docs: SearchDoc[]
}

/** A piece of snippet text; `match` pieces are rendered highlighted. */
export interface Segment {
  text: string
  match: boolean
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Regex matching any of the terms (longest first), case-insensitive. Null when there are no usable terms. */
export function termsRegExp(terms: string[]): RegExp | null {
  const unique = [...new Set(terms.map(t => t.trim()).filter(t => t.length > 0))]
    .sort((a, b) => b.length - a.length)
  if (unique.length === 0) return null
  return new RegExp(`(${unique.map(escapeRegExp).join('|')})`, 'gi')
}

/** Split text into highlighted / plain segments for the given terms. */
export function highlight(text: string, terms: string[]): Segment[] {
  const re = termsRegExp(terms)
  if (!re || !text) return text ? [{ text, match: false }] : []
  const segments: Segment[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0
    if (start > last) segments.push({ text: text.slice(last, start), match: false })
    segments.push({ text: m[0], match: true })
    last = start + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false })
  return segments
}

/**
 * A short excerpt of `text` around the first occurrence of any term, cut at word boundaries,
 * with ellipses where trimmed. Falls back to the start of the text when nothing matches.
 */
export function snippet(text: string, terms: string[], radius = 70): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const re = termsRegExp(terms)
  const hit = re ? re.exec(clean) : null
  const center = hit ? hit.index : 0
  let start = Math.max(0, center - radius)
  let end = Math.min(clean.length, center + (hit ? hit[0].length : 0) + radius)
  // Snap to word boundaries so words aren't cut in half
  if (start > 0) {
    const space = clean.indexOf(' ', start)
    if (space !== -1 && space < center) start = space + 1
  }
  if (end < clean.length) {
    const space = clean.lastIndexOf(' ', end)
    if (space > center) end = space
  }
  return `${start > 0 ? '… ' : ''}${clean.slice(start, end)}${end < clean.length ? ' …' : ''}`
}

/** First heading that contains any of the terms. */
export function matchedHeading(headings: string[], terms: string[]): string | null {
  const re = termsRegExp(terms)
  if (!re) return null
  for (const h of headings) {
    re.lastIndex = 0
    if (re.test(h)) return h
  }
  return null
}

/** Slug used for heading anchors — mirrors src/plugins/toc.ts slugify. */
export function headingAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
