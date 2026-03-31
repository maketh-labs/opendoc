import { readdir, readFile, writeFile, access, unlink } from 'fs/promises';
import { join, relative, basename, dirname } from 'path';
import type { NavNode } from './types';
import { parseFrontmatter } from './utils.js';

const FAVICON_NAMES = ['favicon.ico', 'favicon.svg', 'favicon.png'];
const OG_IMAGE_NAMES = ['og-image.png', 'og-image.jpg', 'og-image.webp'];

async function findFile(dir: string, candidates: string[]): Promise<string | null> {
  for (const name of candidates) {
    try {
      await access(join(dir, name));
      return name;
    } catch {}
  }
  return null;
}

export interface PageAssets {
  faviconPath: string | null
  ogImagePath: string | null
  faviconInherited: boolean
  ogImageInherited: boolean
}

export async function resolvePageAssets(rootDir: string, pagePath: string): Promise<PageAssets> {
  const result: PageAssets = { faviconPath: null, ogImagePath: null, faviconInherited: false, ogImageInherited: false }
  let currentDir = pagePath === '.' ? rootDir : join(rootDir, pagePath)
  const resolvedRoot = join(rootDir)
  let isFirst = true

  while (true) {
    if (!result.faviconPath) {
      const found = await findFile(currentDir, FAVICON_NAMES)
      if (found) {
        const rel = relative(rootDir, join(currentDir, found))
        result.faviconPath = '/' + rel
        result.faviconInherited = !isFirst
      }
    }
    if (!result.ogImagePath) {
      const found = await findFile(currentDir, OG_IMAGE_NAMES)
      if (found) {
        const rel = relative(rootDir, join(currentDir, found))
        result.ogImagePath = '/' + rel
        result.ogImageInherited = !isFirst
      }
    }
    if (result.faviconPath && result.ogImagePath) break
    if (currentDir === resolvedRoot) break
    currentDir = dirname(currentDir)
    if (!currentDir.startsWith(resolvedRoot)) break
    isFirst = false
  }

  return result
}

async function readOrder(dir: string): Promise<string[] | null> {
  try {
    const raw = await readFile(join(dir, 'order.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function sortByOrder(dir: string, children: NavNode[], order: string[] | null): Promise<NavNode[]> {
  if (!order) {
    children.sort((a, b) => a.title.localeCompare(b.title));
    return children;
  }
  const existingSlugs = new Set(children.map(c => basename(c.path)));
  const cleanOrder = order.filter(name => existingSlugs.has(name));

  // Self-heal: rewrite order.json if stale entries were removed
  if (cleanOrder.length !== order.length) {
    try {
      if (cleanOrder.length === 0) {
        await unlink(join(dir, 'order.json'));
      } else {
        await writeFile(join(dir, 'order.json'), JSON.stringify(cleanOrder, null, 2) + '\n');
      }
    } catch {}
  }

  const orderMap = new Map(cleanOrder.map((name, i) => [name, i]));
  const ordered: NavNode[] = [];
  const unordered: NavNode[] = [];
  for (const child of children) {
    const folderName = basename(child.path);
    if (orderMap.has(folderName)) {
      ordered.push(child);
    } else {
      unordered.push(child);
    }
  }
  ordered.sort((a, b) => orderMap.get(basename(a.path))! - orderMap.get(basename(b.path))!);
  unordered.sort((a, b) => a.title.localeCompare(b.title));
  return [...ordered, ...unordered];
}

function titleFromFolder(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function decodeUnicodeEscapes(raw: string): string {
  if (!raw || !raw.includes('\\u')) return raw;
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}

interface PageMeta {
  title: string | null;
  icon: string | null;
}

async function extractMeta(filePath: string): Promise<PageMeta> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    const icon = fm["icon"] ? decodeUnicodeEscapes(fm["icon"]) : null;
    const fmTitle = fm["title"] ?? null;
    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = fmTitle || (h1Match ? h1Match[1]!.trim() : null);
    return { title, icon };
  } catch {
    return { title: null, icon: null };
  }
}

export async function walkDir(rootDir: string, currentDir: string = rootDir): Promise<NavNode | null> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const hasIndex = entries.some(e => e.isFile() && e.name === 'index.md');
  const rel = relative(rootDir, currentDir);
  const url = rel ? `/${rel}` : '/';

  const children: NavNode[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.opendoc' || entry.name === 'assets' || entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const child = await walkDir(rootDir, join(currentDir, entry.name));
    if (child) children.push(child);
  }

  const order = await readOrder(currentDir);
  const sortedChildren = await sortByOrder(currentDir, children, order);

  if (!hasIndex && sortedChildren.length === 0) return null;
  if (!hasIndex) {
    if (sortedChildren.length === 1) return sortedChildren[0]!;
    if (sortedChildren.length > 1) return { title: titleFromFolder(basename(currentDir) || 'Home'), path: rel || '.', url, children: sortedChildren };
    return null;
  }

  const indexPath = join(currentDir, 'index.md');
  const meta = await extractMeta(indexPath);
  const title = meta.title || titleFromFolder(basename(currentDir) || 'Home');

  const node: NavNode = { title, path: rel || '.', url, children: sortedChildren };
  if (meta.icon) node.icon = meta.icon;
  return node;
}

export async function getAllPages(rootDir: string, currentDir: string = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const pages: string[] = [];

  if (entries.some(e => e.isFile() && e.name === 'index.md')) {
    const rel = relative(rootDir, currentDir);
    if (rel) pages.push(rel); // skip root — root index.md is not a navigable page
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.opendoc' || entry.name === 'assets' || entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    pages.push(...await getAllPages(rootDir, join(currentDir, entry.name)));
  }

  return pages;
}
