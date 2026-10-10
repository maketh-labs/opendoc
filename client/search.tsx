// Full-text search box for the viewer — loads /_opendoc/search-index.json on first use
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch, { type SearchResult } from 'minisearch'
import {
  highlight, snippet, matchedHeading, headingAnchor,
  type SearchDoc, type SearchIndexFile, type Segment,
} from './search-text'

const MAX_RESULTS = 8

interface Hit {
  doc: SearchDoc
  terms: string[]
  heading: string | null
  excerpt: string
}

type IndexState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; search: MiniSearch<SearchDoc>; docs: Map<string, SearchDoc> }
  | { status: 'error' }

function buildIndex(file: SearchIndexFile): { search: MiniSearch<SearchDoc>; docs: Map<string, SearchDoc> } {
  const search = new MiniSearch<SearchDoc>({
    fields: ['title', 'headings', 'text'],
    storeFields: [],
    // headings is an array — index it as one string
    extractField: (doc, field) => {
      const value = doc[field as keyof SearchDoc]
      return Array.isArray(value) ? value.join(' ') : String(value ?? '')
    },
    searchOptions: {
      boost: { title: 3, headings: 2 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.15 : 0),
      combineWith: 'AND',
    },
  })
  search.addAll(file.docs)
  return { search, docs: new Map(file.docs.map(d => [d.id, d])) }
}

function Highlighted({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <React.Fragment key={i}>{s.text}</React.Fragment>))}
    </>
  )
}

const STYLES = `
.od-search-box { position: relative; }
.od-search-results {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 200;
  max-height: min(70vh, 520px); overflow-y: auto;
  background: var(--od-bg, #fff); color: var(--od-text, inherit);
  border: 1px solid var(--od-border, #ddd); border-radius: var(--od-radius, 6px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 4px; margin: 0; list-style: none;
}
.od-search-result { display: block; padding: 8px 10px; border-radius: var(--od-radius, 6px); cursor: pointer; text-decoration: none; color: inherit; }
.od-search-result[aria-selected="true"] { background: var(--od-bg-surface, rgba(0,0,0,0.05)); }
.od-search-result-title { font-weight: 600; font-size: var(--od-text-sm, 14px); }
.od-search-result-heading { font-size: 12px; opacity: 0.75; margin-top: 2px; }
.od-search-result-snippet { font-size: 12px; opacity: 0.7; margin-top: 4px; line-height: 1.45; }
.od-search-results mark { background: color-mix(in srgb, var(--od-accent, #0969da) 22%, transparent); color: inherit; border-radius: 2px; padding: 0 1px; }
.od-search-empty { padding: 10px; font-size: var(--od-text-sm, 14px); opacity: 0.7; }
`

export function SearchBox({ query, onQueryChange, onNavigate }: {
  query: string
  onQueryChange: (q: string) => void
  onNavigate: (url: string) => void
}) {
  const [index, setIndex] = useState<IndexState>({ status: 'idle' })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const ensureIndex = useCallback(() => {
    if (index.status !== 'idle' && index.status !== 'error') return
    setIndex({ status: 'loading' })
    fetch('/_opendoc/search-index.json')
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<SearchIndexFile> })
      .then(file => setIndex({ status: 'ready', ...buildIndex(file) }))
      .catch(() => setIndex({ status: 'error' }))
  }, [index.status])

  // "/" or Cmd/Ctrl+K focuses the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const hits: Hit[] = useMemo(() => {
    const q = query.trim()
    if (!q || index.status !== 'ready') return []
    const queryTerms = q.split(/\s+/)
    return index.search.search(q).slice(0, MAX_RESULTS).flatMap((r: SearchResult) => {
      const doc = index.docs.get(String(r.id))
      if (!doc) return []
      const terms = [...r.terms, ...queryTerms]
      return [{ doc, terms, heading: matchedHeading(doc.headings, terms), excerpt: snippet(doc.text, terms) }]
    })
  }, [query, index])

  useEffect(() => { setActive(0) }, [query])

  function go(hit: Hit) {
    setOpen(false)
    inputRef.current?.blur()
    onQueryChange('')
    onNavigate(hit.doc.url)
    if (hit.heading) {
      const id = headingAnchor(hit.heading)
      // Wait for the page to render, then jump to the matched section
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 300)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (open && query) { onQueryChange(''); } else { inputRef.current?.blur() }
      setOpen(false)
      return
    }
    if (!hits.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => (i + 1) % hits.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(i => (i - 1 + hits.length) % hits.length) }
    else if (e.key === 'Enter') { e.preventDefault(); const hit = hits[active]; if (hit) go(hit) }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div className="od-search-box" ref={boxRef}>
      <style>{STYLES}</style>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search docs…  /"
        aria-label="Search documentation"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="od-search-results"
        aria-autocomplete="list"
        value={query}
        onFocus={() => { ensureIndex(); setOpen(true) }}
        onChange={(e) => { ensureIndex(); onQueryChange(e.target.value); setOpen(true) }}
        onKeyDown={onKeyDown}
      />
      {showDropdown && (
        <ul className="od-search-results" id="od-search-results" role="listbox">
          {index.status === 'loading' && <li className="od-search-empty">Loading search…</li>}
          {index.status === 'error' && <li className="od-search-empty">Search is unavailable.</li>}
          {index.status === 'ready' && hits.length === 0 && <li className="od-search-empty">No results for “{query.trim()}”</li>}
          {hits.map((hit, i) => (
            <li key={hit.doc.id} role="option" aria-selected={i === active}>
              <a
                className="od-search-result"
                href={hit.doc.url}
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault() /* keep focus until click completes */}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return
                  e.preventDefault()
                  go(hit)
                }}
              >
                <div className="od-search-result-title"><Highlighted segments={highlight(hit.doc.title || hit.doc.url, hit.terms)} /></div>
                {hit.heading && hit.heading !== hit.doc.title && (
                  <div className="od-search-result-heading">§ <Highlighted segments={highlight(hit.heading, hit.terms)} /></div>
                )}
                {hit.excerpt && (
                  <div className="od-search-result-snippet"><Highlighted segments={highlight(hit.excerpt, hit.terms)} /></div>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
