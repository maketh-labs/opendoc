// Client-side navigation, sidebar toggles, and dark mode

function initDarkMode() {
  const darkToggle = document.getElementById('dark-mode-toggle')
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  }
  darkToggle?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const newTheme = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  })
}

function initSidebar() {
  const layout = document.getElementById('od-layout')
  document.getElementById('toggle-left')?.addEventListener('click', () => {
    layout?.classList.toggle('left-closed')
    localStorage.setItem('od-left-open', String(!layout?.classList.contains('left-closed')))
  })
  const leftOpen = localStorage.getItem('od-left-open')
  if (leftOpen === 'false') layout?.classList.add('left-closed')
}

function updateNavActive(pathname: string) {
  const currentPath = pathname.replace(/\/$/, '') || '/'
  for (const link of document.querySelectorAll('.od-nav a')) {
    const href = (link as HTMLAnchorElement).getAttribute('href')?.replace(/\/$/, '') || '/'
    link.classList.toggle('active', href === currentPath)
  }
}

function initSearch() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase()
    for (const item of document.querySelectorAll('.od-nav li')) {
      const text = (item as HTMLElement).textContent?.toLowerCase() || ''
      ;(item as HTMLElement).style.display = text.includes(query) ? '' : 'none'
    }
  })
}

let tocObserver: IntersectionObserver | null = null

function initTocObserver() {
  tocObserver?.disconnect()
  tocObserver = null

  const tocLinks = document.querySelectorAll('.od-toc-list a')
  if (tocLinks.length === 0) return

  const headingIds = Array.from(tocLinks).map(a =>
    (a as HTMLAnchorElement).getAttribute('href')?.slice(1) || ''
  )
  const headings = headingIds
    .map(id => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null)

  if (headings.length === 0) return

  tocObserver = new IntersectionObserver(
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
  for (const heading of headings) tocObserver.observe(heading)
}

// ── Progress bar ──────────────────────────────────────────────────────────────

let progressTimer: ReturnType<typeof setTimeout> | null = null

function showProgress() {
  let bar = document.getElementById('od-progress')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'od-progress'
    bar.style.cssText = `
      position:fixed;top:0;left:0;right:0;height:2px;z-index:9999;
      background:var(--color-accent,#0969da);
      transition:width 0.2s ease,opacity 0.3s ease;
      width:0%;opacity:1;
    `
    document.body.appendChild(bar)
  }
  bar.style.width = '0%'
  bar.style.opacity = '1'
  if (progressTimer) clearTimeout(progressTimer)
  progressTimer = setTimeout(() => { if (bar) bar.style.width = '70%' }, 10)
}

function finishProgress() {
  const bar = document.getElementById('od-progress')
  if (!bar) return
  if (progressTimer) clearTimeout(progressTimer)
  bar.style.width = '100%'
  setTimeout(() => { bar.style.opacity = '0' }, 200)
}

// ── SPA navigation ────────────────────────────────────────────────────────────

let navigating = false

async function navigate(url: string, pushState = true) {
  if (navigating) return
  navigating = true
  showProgress()

  try {
    const res = await fetch(url)
    if (!res.ok) { window.location.href = url; return }

    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')

    // Swap article content
    const newArticle = doc.querySelector('.od-article')
    const curArticle = document.querySelector('.od-article')
    if (newArticle && curArticle) curArticle.innerHTML = newArticle.innerHTML

    // Swap TOC
    const newTocWrap = doc.querySelector('.od-toc')
    const curTocWrap = document.querySelector('.od-toc')
    if (curTocWrap) {
      if (newTocWrap) {
        curTocWrap.innerHTML = newTocWrap.innerHTML
      } else {
        curTocWrap.innerHTML = ''
      }
    }

    // Update title
    document.title = doc.title

    // Update URL
    const pathname = new URL(url, window.location.origin).pathname
    if (pushState) history.pushState({ url }, '', url)

    // Scroll to top
    document.querySelector('.od-content')?.scrollTo(0, 0)

    // Update nav active state
    updateNavActive(pathname)

    // Re-init TOC observer with new headings
    initTocObserver()

  } catch {
    window.location.href = url
  } finally {
    finishProgress()
    navigating = false
  }
}

function isInternalLink(href: string): boolean {
  try {
    const url = new URL(href, window.location.origin)
    return url.origin === window.location.origin &&
      !href.startsWith('/_opendoc') &&
      !href.startsWith('/editor') &&
      !href.startsWith('/__reload')
  } catch { return false }
}

function interceptLinks(root: Element | Document = document) {
  root.addEventListener('click', (e) => {
    const a = (e.target as Element).closest('a')
    if (!a) return
    const href = a.getAttribute('href')
    if (!href || !isInternalLink(href)) return
    // Allow modifier keys to open in new tab
    if ((e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey || (e as MouseEvent).shiftKey) return
    e.preventDefault()
    navigate(href)
  })
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode()
  initSidebar()
  initSearch()
  updateNavActive(window.location.pathname)
  initTocObserver()
  interceptLinks()

  window.addEventListener('popstate', (e) => {
    navigate(e.state?.url || window.location.href, false)
  })
})
