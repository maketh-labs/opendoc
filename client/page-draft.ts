// Draft state shared by the local and GitHub editors.
//
// Tracks the loaded file text and decides whether the user actually changed anything.
// BlockNote's markdown output is lossy/normalizing, so comparing it with the original
// file text would mark every opened page dirty. Instead the editor reports a *baseline*
// (its own serialization of the freshly loaded document) and only differences from that
// baseline count as edits. Unchanged pages are never rewritten.

import { useState, useRef, useCallback, useMemo } from 'react'
import { extractPageMeta, buildMarkdown } from './markdown-text'

interface Loaded {
  text: string
  title: string
  icon: string
  frontmatter: string
  rawBody: string
  baselineBody: string | null
}

export function usePageDraft() {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const loadedRef = useRef<Loaded>({ text: '', title: '', icon: '', frontmatter: '', rawBody: '', baselineBody: null })
  const bodyRef = useRef('')
  const titleRef = useRef('')
  const iconRef = useRef('')
  const dirtyRef = useRef(false)

  const recompute = useCallback(() => {
    const L = loadedRef.current
    const body = bodyRef.current
    const bodyChanged = L.baselineBody !== null ? body !== L.baselineBody && body !== L.rawBody : body !== L.rawBody
    const dirty = titleRef.current !== L.title || iconRef.current !== L.icon || bodyChanged
    dirtyRef.current = dirty
    setIsDirty(dirty)
  }, [])

  /** Load file text; returns the body markdown to hand to the block editor. */
  const load = useCallback((text: string) => {
    const meta = extractPageMeta(text)
    loadedRef.current = { text, ...meta, rawBody: meta.body, baselineBody: null }
    bodyRef.current = meta.body
    titleRef.current = meta.title
    iconRef.current = meta.icon
    setTitle(meta.title)
    setIcon(meta.icon)
    dirtyRef.current = false
    setIsDirty(false)
    return meta.body
  }, [])

  /** The editor's serialization of the just-loaded document. */
  const setBaseline = useCallback((md: string) => {
    loadedRef.current.baselineBody = md
    recompute()
  }, [recompute])

  const setBody = useCallback((md: string) => { bodyRef.current = md; recompute() }, [recompute])
  const changeTitle = useCallback((t: string) => { titleRef.current = t; setTitle(t); recompute() }, [recompute])
  const changeIcon = useCallback((i: string) => { iconRef.current = i; setIcon(i); recompute() }, [recompute])

  /** Markdown to write. Returns the original text untouched when nothing changed. */
  const getMarkdown = useCallback(() => {
    const L = loadedRef.current
    if (!dirtyRef.current) return L.text
    const bodyChanged = L.baselineBody !== null ? bodyRef.current !== L.baselineBody && bodyRef.current !== L.rawBody : bodyRef.current !== L.rawBody
    const body = bodyChanged ? bodyRef.current : L.rawBody
    return buildMarkdown(titleRef.current, iconRef.current, body, L.frontmatter)
  }, [])

  /** Record that `content` was persisted. Edits made after the snapshot stay dirty. */
  const markSaved = useCallback((content: string, snapshot: { title: string; icon: string; body: string }) => {
    const meta = extractPageMeta(content)
    loadedRef.current = {
      text: content, title: snapshot.title, icon: snapshot.icon, frontmatter: meta.frontmatter,
      rawBody: meta.body, baselineBody: snapshot.body,
    }
    recompute()
  }, [recompute])

  const snapshot = useCallback(() => ({ title: titleRef.current, icon: iconRef.current, body: bodyRef.current }), [])

  // Stable identity — safe to use in hook dependency lists
  const api = useMemo(() => ({
    dirtyRef, load, setBaseline, setBody, changeTitle, changeIcon, getMarkdown, markSaved, snapshot,
    originalText: () => loadedRef.current.text,
  }), [load, setBaseline, setBody, changeTitle, changeIcon, getMarkdown, markSaved, snapshot])

  return { title, icon, isDirty, api }
}
