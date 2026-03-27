import { readdir, readFile } from 'fs/promises';
import { join, relative, basename } from 'path';
import type { NavNode } from './types';

function titleFromFolder(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function extractTitle(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1]!.trim() : null;
  } catch {
    return null;
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
  if (!hasIndex) return children.length === 1 ? children[0]! : null;

  const indexPath = join(currentDir, 'index.md');
  const title = (await extractTitle(indexPath)) || titleFromFolder(basename(currentDir) || 'Home');

  return { title, path: rel || '.', url, children };
}

export async function getAllPages(rootDir: string, currentDir: string = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const pages: string[] = [];

  if (entries.some(e => e.isFile() && e.name === 'index.md')) {
    const rel = relative(rootDir, currentDir);
    pages.push(rel || '.');
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.opendoc' || entry.name === 'assets' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    pages.push(...await getAllPages(rootDir, join(currentDir, entry.name)));
  }

  return pages;
}
