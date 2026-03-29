import { useState, useEffect, useCallback, useRef } from 'react'

export interface GitStatus {
  isRepo: boolean
  branch?: string
  remote?: string
  changes: number
}

export function useGitStatus() {
  const [status, setStatus] = useState<GitStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/_opendoc/git-status')
      if (r.ok) setStatus(await r.json())
    } catch {}
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { status, refresh }
}

export function useDarkMode(): 'light' | 'dark' {
  const mqRef = useRef<MediaQueryList | null>(null)
  if (!mqRef.current) mqRef.current = window.matchMedia('(prefers-color-scheme: dark)')
  const mq = mqRef.current

  const [theme, setTheme] = useState<'light' | 'dark'>(mq.matches ? 'dark' : 'light')

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mq])

  return theme
}

export function useKeyboardSave(onSave: () => void) {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSaveRef.current()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
