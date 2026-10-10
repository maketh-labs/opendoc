import { readFile } from 'fs/promises'
import { join } from 'path'
import { renderFull, type Frontmatter } from './renderer'
import { tocToHtml } from './plugins/toc'
import { backlinksToHtml } from './render-utils.js'
import { extractTitle } from './utils.js'
import { resolvePageAssets } from './walker'
import type { BacklinksIndex } from './types'

/** JSON payload the viewer renders for one page — served by /_opendoc/page and written by the static build. */
export interface PageData {
  html: string
  toc: string
  title: string
  icon: string
  backlinks: string
  faviconUrl: string | null
  ogImageUrl: string | null
  faviconInherited: boolean
  ogImageInherited: boolean
}

/**
 * Render a page ('.' for root) to PageData. Returns null if the page has no index.md —
 * except the root, which returns empty content plus inherited asset info (used by site settings).
 */
export async function renderPageData(
  rootDir: string,
  page: string,
  titleMap: Map<string, string>,
  backlinks: BacklinksIndex,
): Promise<{ data: PageData; frontmatter: Frontmatter; exists: boolean } | null> {
  const assets = await resolvePageAssets(rootDir, page)
  const assetFields = {
    faviconUrl: assets.faviconPath,
    ogImageUrl: assets.ogImagePath,
    faviconInherited: assets.faviconInherited,
    ogImageInherited: assets.ogImageInherited,
  }

  let markdown: string
  try {
    markdown = await readFile(join(rootDir, page, 'index.md'), 'utf-8')
  } catch {
    if (page !== '.') return null
    return {
      data: { html: '', toc: '', title: '', icon: '', backlinks: '', ...assetFields },
      frontmatter: {},
      exists: false,
    }
  }

  const currentPath = page === '.' ? 'index.md' : `${page}/index.md`
  const { html, toc, frontmatter } = await renderFull(markdown, { titleMap, currentPath })
  const normalized = page === '.' ? '' : page

  return {
    data: {
      html,
      toc: tocToHtml(toc),
      title: extractTitle(markdown, 'OpenDoc'),
      icon: (frontmatter.icon as string) || '',
      backlinks: backlinksToHtml(backlinks[normalized] || []),
      ...assetFields,
    },
    frontmatter,
    exists: true,
  }
}
