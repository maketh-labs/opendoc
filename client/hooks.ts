import { useState, useEffect, useCallback, useRef } from 'react'
export type DarkModeHook = { theme: 'light' | 'dark'; toggle: () => void }

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

export function useDarkMode(): { theme: 'light' | 'dark'; toggle: () => void } {
  const mqRef = useRef<MediaQueryList | null>(null)
  if (!mqRef.current) mqRef.current = window.matchMedia('(prefers-color-scheme: dark)')
  const mq = mqRef.current

  const [manual, setManual] = useState<'light' | 'dark' | null>(null)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(mq.matches ? 'dark' : 'light')

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mq])

  const theme = manual ?? systemTheme

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = useCallback(() => {
    setManual(prev => (prev ?? systemTheme) === 'dark' ? 'light' : 'dark')
  }, [systemTheme])

  return { theme, toggle }
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
