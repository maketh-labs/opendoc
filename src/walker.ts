import { readdir, readFile } from 'fs/promises';
import { join, relative, basename } from 'path';
import type { NavNode } from './types';
import { parseFrontmatter } from './utils.js';

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
    if (entry.name === '.opendoc' || entry.name === 'assets' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const child = await walkDir(rootDir, join(currentDir, entry.name));
    if (child) children.push(child);
  }

  children.sort((a, b) => a.title.localeCompare(b.title));

  if (!hasIndex && children.length === 0) return null;
  if (!hasIndex) {
    if (children.length === 1) return children[0]!;
    if (children.length > 1) return { title: titleFromFolder(basename(currentDir) || 'Home'), path: rel || '.', url, children };
    return null;
  }

  const indexPath = join(currentDir, 'index.md');
  const meta = await extractMeta(indexPath);
  const title = meta.title || titleFromFolder(basename(currentDir) || 'Home');

  const node: NavNode = { title, path: rel || '.', url, children };
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
    if (entry.name === '.opendoc' || entry.name === 'assets' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    pages.push(...await getAllPages(rootDir, join(currentDir, entry.name)));
  }

  return pages;
}
