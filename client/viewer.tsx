// OpenDoc Viewer — React SPA
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavNode {
  title: string
  path: string
  url: string
  icon?: string
  children: NavNode[]
}

interface PageData {
  html: string
  toc: string
  title: string
  icon: string
  backlinks: string
}

// ─── Dark mode ───────────────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light')
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const next = isDark ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pathFromUrl(pathname: string): string {
  return pathname.replace(/^\//, '').replace(/\/$/, '')
}

async function fetchPage(path: string): Promise<PageData> {
  const res = await fetch(`/_opendoc/page?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`Page fetch failed: ${res.status}`)
  return res.json()
}

async function fetchNav(): Promise<NavNode | null> {
  const res = await fetch('/_opendoc/nav.json')
  if (!res.ok) return null
  return res.json()
}

// ─── Nav component ───────────────────────────────────────────────────────────

function NavItem({ node, currentPath, onNavigate }: {
  node: NavNode
  currentPath: string
  onNavigate: (url: string) => void
}) {
  const isActive = node.path === currentPath ||
    (node.path === '.' && currentPath === '')
  return (
    <li>
      <a
        href={node.url}
        className={isActive ? 'active' : ''}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return
          e.preventDefault()
          onNavigate(node.url)
        }}
      >
        {node.icon && <span className="od-nav-icon">{node.icon}</span>}
        {' '}{node.title}
      </a>
      {node.children?.length > 0 && (
        <ul>
          {node.children.map(child => (
            <NavItem key={child.path} node={child} currentPath={currentPath} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  )
}

function NavTree({ nav, currentPath, onNavigate, searchQuery }: {
  nav: NavNode | null
  currentPath: string
  onNavigate: (url: string) => void
  searchQuery: string
}) {
  if (!nav) return null

  function filterNode(node: NavNode, query: string): NavNode | null {
    if (!query) return node
    const matchesSelf = node.title.toLowerCase().includes(query)
    const filteredChildren = node.children
      .map(c => filterNode(c, query))
      .filter((c): c is NavNode => c !== null)
    if (matchesSelf || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren }
    }
    return null
  }

  const filtered = filterNode(nav, searchQuery.toLowerCase())
  if (!filtered) return null

  return (
    <ul>
      <NavItem node={filtered} currentPath={currentPath} onNavigate={onNavigate} />
    </ul>
  )
}

// ─── TOC observer hook ───────────────────────────────────────────────────────

function useTocObserver(tocHtml: string) {
  useEffect(() => {
    if (!tocHtml) return

    const tocLinks = document.querySelectorAll('.od-toc-list a')
    if (tocLinks.length === 0) return

    const headingIds = Array.from(tocLinks).map(a =>
      (a as HTMLAnchorElement).getAttribute('href')?.slice(1) || ''
    )
    const headings = headingIds
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            for (const link of tocLinks) {
              link.classList.toggle('active', (link as HTMLAnchorElement).getAttribute('href') === `#${id}`)
            }
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    for (const heading of headings) observer.observe(heading)
    return () => observer.disconnect()
  }, [tocHtml])
}

// ─── Main App ────────────────────────────────────────────────────────────────

function Viewer() {
  const [nav, setNav] = useState<NavNode | null>(null)
  const [page, setPage] = useState<PageData | null>(null)
  const [currentPath, setCurrentPath] = useState(() => pathFromUrl(window.location.pathname))
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('od-left-open') !== 'false')
  const contentRef = useRef<HTMLElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Navigate to a URL
  const navigateTo = useCallback(async (url: string, pushState = true) => {
    const path = pathFromUrl(url)
    setLoading(true)
    showProgress()
    try {
      const data = await fetchPage(path)
      setPage(data)
      setCurrentPath(path)
      document.title = data.title
      if (pushState) history.pushState({ url }, '', url)
      contentRef.current?.scrollTo(0, 0)
    } catch {
      window.location.href = url
    } finally {
      setLoading(false)
      finishProgress()
    }
  }, [])

  // Progress bar
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showProgress() {
    const bar = progressRef.current
    if (!bar) return
    bar.style.width = '0%'
    bar.style.opacity = '1'
    if (progressTimer.current) clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => { if (bar) bar.style.width = '70%' }, 10)
  }

  function finishProgress() {
    const bar = progressRef.current
    if (!bar) return
    if (progressTimer.current) clearTimeout(progressTimer.current)
    bar.style.width = '100%'
    setTimeout(() => { if (bar) bar.style.opacity = '0' }, 200)
  }

  // Initial load
  useEffect(() => {
    async function load() {
      const navData = await fetchNav()
      setNav(navData)

      // If at root with no content, redirect to first page
      let targetPath = currentPath
      if (!targetPath) {
        const firstPage = navData?.path && navData.path !== '.' ? navData.path : navData?.children?.[0]?.path
        if (firstPage && firstPage !== '.') {
          targetPath = firstPage
          history.replaceState({}, '', `/${firstPage}`)
          setCurrentPath(firstPage)
        }
      }

      if (targetPath) {
        const pageData = await fetchPage(targetPath)
        setPage(pageData)
        document.title = pageData.title
      }
      setLoading(false)
    }
    load()
  }, [])

  // Handle popstate
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      navigateTo(e.state?.url || window.location.href, false)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [navigateTo])

  // Intercept internal link clicks in article content
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const handler = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        if (href.startsWith('/_opendoc') || href.startsWith('/__reload')) return
        if (href.startsWith('#')) return
      } catch { return }
      if (e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      navigateTo(href)
    }
    content.addEventListener('click', handler as EventListener)
    return () => content.removeEventListener('click', handler as EventListener)
  }, [navigateTo])

  // Code block copy buttons
  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const pres = content.querySelectorAll<HTMLElement>('pre')
    const cleanups: (() => void)[] = []

    for (const pre of pres) {
      if (pre.querySelector('.od-copy-btn')) continue // already injected

      pre.style.position = 'relative'

      const btn = document.createElement('button')
      btn.className = 'od-copy-btn'
      btn.setAttribute('aria-label', 'Copy code')
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`

      const handleClick = () => {
        const code = pre.querySelector('code')
        navigator.clipboard.writeText(code?.textContent ?? pre.textContent ?? '').then(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
          setTimeout(() => {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
          }, 1500)
        })
      }

      btn.addEventListener('click', handleClick)
      pre.appendChild(btn)
      cleanups.push(() => { btn.removeEventListener('click', handleClick); btn.remove() })
    }

    return () => cleanups.forEach(c => c())
  }, [page?.html])

  // Sidebar toggle persistence
  useEffect(() => {
    localStorage.setItem('od-left-open', String(sidebarOpen))
  }, [sidebarOpen])

  // TOC observer
  useTocObserver(page?.toc || '')

  // Hot reload
  useEffect(() => {
    const es = new EventSource('/__reload')
    es.onmessage = () => location.reload()
    return () => es.close()
  }, [])

  // Loading state
  if (!page) {
    return (
      <>
        <div ref={progressRef} style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 9999,
          background: 'var(--color-accent, #0969da)',
          transition: 'width 0.2s ease, opacity 0.3s ease',
          width: '70%', opacity: 1,
        }} />
        <header className="od-header">
          <div className="od-header-left">
            <a href="/" className="od-logo">OpenDoc</a>
          </div>
        </header>
      </>
    )
  }

  return (
    <>
      {/* Progress bar */}
      <div ref={progressRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 9999,
        background: 'var(--color-accent, #0969da)',
        transition: 'width 0.2s ease, opacity 0.3s ease',
        width: '0%', opacity: 0,
      }} />

      {/* Header */}
      <header className="od-header">
        <div className="od-header-left">
          <button
            className="od-toggle-btn"
            title="Toggle navigation"
            aria-label="Toggle navigation"
            onClick={() => setSidebarOpen(v => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <a
            href="/"
            className="od-logo"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return
              e.preventDefault()
              navigateTo('/')
            }}
          >OpenDoc</a>
        </div>
        <div className="od-header-center">
          <div className="od-search-box">
            <input
              type="search"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="od-header-right">
          <button className="od-theme-toggle" title="Toggle dark mode" onClick={toggleTheme}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className={`od-layout${sidebarOpen ? '' : ' left-closed'}`} id="od-layout">
        {/* Sidebar */}
        <aside className="od-sidebar-left" id="sidebar-left">
          <nav className="od-nav">
            <NavTree nav={nav} currentPath={currentPath} onNavigate={navigateTo} searchQuery={searchQuery} />
          </nav>
        </aside>

        {/* Content */}
        <main className="od-content" ref={contentRef}>
          <div className="od-content-wrap">
            <article className="od-article">
              <div className="od-page-header">
                {page.icon && <span className="od-page-icon">{page.icon}</span>}
              </div>
              <div dangerouslySetInnerHTML={{ __html: page.html }} />
            </article>
            {page.backlinks && (
              <div dangerouslySetInnerHTML={{ __html: page.backlinks }} />
            )}
          </div>
          {page.toc && (
            <div dangerouslySetInnerHTML={{ __html: page.toc }} />
          )}
        </main>
      </div>
    </>
  )
}

// ─── Mount ───────────────────────────────────────────────────────────────────

initTheme()
const root = createRoot(document.getElementById('od-viewer-root')!)
root.render(<Viewer />)
