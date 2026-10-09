import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, sep } from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { toString } from 'mdast-util-to-string';
import type { Root, Heading } from 'mdast';
import { walkDir, type PageMeta } from './walker';
import { extractLinkTargets } from './backlinks';
import { extractTitle, parseFrontmatter } from './utils.js';
import type { BacklinksIndex, NavNode } from './types';

/** Directories never treated as pages (matches walker rules) */
function isSkippedDir(name: string): boolean {
  return name === 'dist' || name === 'assets' || name === 'node_modules' || name.startsWith('.') || name.startsWith('_');
}

interface CachedPage {
  /** Page path relative to root: '.' for the root page */
  path: string;
  mtimeMs: number;
  size: number;
  markdown: string;
  title: string;
  meta: PageMeta;
}

export interface SearchDoc {
  /** Page path, '' for the root page */
  id: string;
  url: string;
  title: string;
  headings: string[];
  text: string;
}

export interface SearchIndex {
  version: 1;
  docs: SearchDoc[];
}

const searchParser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']);

/** Plain text + h2/h3 headings of a markdown page, for search */
export function toSearchDoc(path: string, markdown: string, title: string): SearchDoc {
  const tree = searchParser.parse(markdown) as Root;
  tree.children = tree.children.filter(n => n.type !== 'yaml');
  const headings = tree.children
    .filter((n): n is Heading => n.type === 'heading' && (n.depth === 2 || n.depth === 3))
    .map(h => toString(h));
  const text = tree.children.map(n => toString(n)).filter(Boolean).join('\n');
  const id = path === '.' ? '' : path;
  return { id, url: id ? `/${id}` : '/', title, headings, text };
}

function decodeUnicodeEscapes(raw: string): string {
  if (!raw || !raw.includes('\\u')) return raw;
  try { return JSON.parse(`"${raw}"`); } catch { return raw; }
}

function metaFromMarkdown(markdown: string): PageMeta {
  const fm = parseFrontmatter(markdown);
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return {
    title: fm.title || (h1 ? h1[1]!.trim() : null),
    icon: fm.icon ? decodeUnicodeEscapes(fm.icon) : null,
  };
}

/**
 * In-memory index of every page under rootDir. `refresh()` re-reads only pages whose
 * index.md changed (by mtime/size), so file-watcher events and API mutations are cheap,
 * and nav, backlinks, titles and search all come from memory.
 */
export class DocsIndex {
  private pages = new Map<string, CachedPage>();
  private navTree: NavNode | null = null;
  private backlinks: BacklinksIndex = {};
  private titleMap = new Map<string, string>();
  private searchIndex: SearchIndex | null = null;
  private refreshing: Promise<void> = Promise.resolve();

  constructor(readonly rootDir: string) {}

  /** Re-scan the tree. Calls are serialized; concurrent callers share the queue. */
  refresh(): Promise<void> {
    this.refreshing = this.refreshing.then(() => this.doRefresh(), () => this.doRefresh());
    return this.refreshing;
  }

  private async scanDir(dir: string, found: Map<string, { mtimeMs: number; size: number }>): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some(e => e.isFile() && e.name === 'index.md')) {
      try {
        const s = await stat(join(dir, 'index.md'));
        const rel = relative(this.rootDir, dir).split(sep).join('/') || '.';
        found.set(rel, { mtimeMs: s.mtimeMs, size: s.size });
      } catch {}
    }
    await Promise.all(entries
      .filter(e => e.isDirectory() && !isSkippedDir(e.name))
      .map(e => this.scanDir(join(dir, e.name), found)));
  }

  private async doRefresh(): Promise<void> {
    const found = new Map<string, { mtimeMs: number; size: number }>();
    await this.scanDir(this.rootDir, found);

    for (const path of this.pages.keys()) {
      if (!found.has(path)) this.pages.delete(path);
    }
    await Promise.all([...found].map(async ([path, s]) => {
      const cached = this.pages.get(path);
      if (cached && cached.mtimeMs === s.mtimeMs && cached.size === s.size) return;
      try {
        const markdown = await readFile(join(this.rootDir, path, 'index.md'), 'utf-8');
        this.pages.set(path, {
          path, mtimeMs: s.mtimeMs, size: s.size, markdown,
          title: extractTitle(markdown, path === '.' ? 'Home' : path),
          meta: metaFromMarkdown(markdown),
        });
      } catch {
        this.pages.delete(path);
      }
    }));

    // Derived data — all from memory except the directory walk for order.json
    this.navTree = await walkDir(this.rootDir, this.rootDir, {
      getMeta: async (indexPath) => {
        const rel = relative(this.rootDir, indexPath).split(sep).slice(0, -1).join('/') || '.';
        return this.pages.get(rel)?.meta ?? { title: null, icon: null };
      },
    });

    const backlinks: BacklinksIndex = {};
    const titleMap = new Map<string, string>();
    for (const page of this.pages.values()) {
      if (page.path === '.') continue;
      titleMap.set(`/${page.path}`, page.title);
      for (const target of extractLinkTargets(page.markdown)) {
        (backlinks[target] ??= []).push(page.path);
      }
    }
    for (const list of Object.values(backlinks)) list.sort();
    this.backlinks = backlinks;
    this.titleMap = titleMap;
    this.searchIndex = null; // rebuilt lazily
  }

  getNavTree(): NavNode | null { return this.navTree; }
  getBacklinks(): BacklinksIndex { return this.backlinks; }
  getTitleMap(): Map<string, string> { return this.titleMap; }

  /** Page paths excluding the root, sorted (same shape as walker.getAllPages) */
  getPagePaths(): string[] {
    return [...this.pages.keys()].filter(p => p !== '.').sort();
  }

  getMarkdown(path: string): string | undefined {
    return this.pages.get(path || '.')?.markdown;
  }

  getSearchIndex(): SearchIndex {
    if (!this.searchIndex) {
      const docs = [...this.pages.values()]
        .sort((a, b) => a.path.localeCompare(b.path))
        .map(p => toSearchDoc(p.path, p.markdown, p.title));
      this.searchIndex = { version: 1, docs };
    }
    return this.searchIndex;
  }

  /** Simple substring search used by the MCP `search` tool */
  search(query: string, limit: number): { path: string; snippet: string }[] {
    const q = query.toLowerCase();
    const results: { path: string; snippet: string }[] = [];
    for (const path of ['.', ...this.getPagePaths()]) {
      const markdown = this.pages.get(path)?.markdown;
      if (!markdown || !markdown.toLowerCase().includes(q)) continue;
      const lines = markdown.split('\n');
      const line = lines.find(l => l.toLowerCase().includes(q)) ?? lines[0] ?? '';
      results.push({ path: path === '.' ? '' : path, snippet: line.trim() });
      if (results.length >= limit) break;
    }
    return results;
  }
}
