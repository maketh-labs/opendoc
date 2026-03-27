// Client-side navigation, sidebar toggles, and dark mode

document.addEventListener('DOMContentLoaded', () => {
  const layout = document.getElementById('od-layout')

  // === Dark mode toggle ===
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

  // === Left sidebar toggle ===
  document.getElementById('toggle-left')?.addEventListener('click', () => {
    layout?.classList.toggle('left-closed')
    localStorage.setItem('od-left-open', String(!layout?.classList.contains('left-closed')))
  })

  // === Restore sidebar state from localStorage ===
  const leftOpen = localStorage.getItem('od-left-open')
  if (leftOpen === 'false') {
    layout?.classList.add('left-closed')
  }

  // === Highlight active nav link ===
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
  const links = document.querySelectorAll('.od-nav a')
  for (const link of links) {
    const href = (link as HTMLAnchorElement).getAttribute('href')?.replace(/\/$/, '') || '/'
    if (href === currentPath) {
      link.classList.add('active')
    }
  }

  // === Search filter ===
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase()
    const navItems = document.querySelectorAll('.od-nav li')
    for (const item of navItems) {
      const text = (item as HTMLElement).textContent?.toLowerCase() || ''
      ;(item as HTMLElement).style.display = text.includes(query) ? '' : 'none'
    }
  })

  // === TOC active heading tracking ===
  const tocLinks = document.querySelectorAll('.od-toc-list a')
  if (tocLinks.length > 0) {
    const headingIds = Array.from(tocLinks).map(a =>
      (a as HTMLAnchorElement).getAttribute('href')?.slice(1) || ''
    )
    const headings = headingIds
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (headings.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const id = entry.target.id
              for (const link of tocLinks) {
                const href = (link as HTMLAnchorElement).getAttribute('href')
                link.classList.toggle('active', href === `#${id}`)
              }
            }
          }
        },
        { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
      )

      for (const heading of headings) {
        observer.observe(heading)
      }
    }
  }
})
