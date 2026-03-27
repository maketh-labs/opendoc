// Client-side navigation, sidebar toggles, dark mode, and theme panel

import { initThemePanel } from './themes'

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

  // === Right sidebar toggle ===
  document.getElementById('toggle-right')?.addEventListener('click', () => {
    layout?.classList.toggle('right-open')
    localStorage.setItem('od-right-open', String(layout?.classList.contains('right-open')))
  })

  // === Restore sidebar state from localStorage ===
  const leftOpen = localStorage.getItem('od-left-open')
  if (leftOpen === 'false') {
    layout?.classList.add('left-closed')
  }

  const rightOpen = localStorage.getItem('od-right-open')
  if (rightOpen === 'true') {
    layout?.classList.add('right-open')
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

  // === Init theme panel ===
  initThemePanel()
})
