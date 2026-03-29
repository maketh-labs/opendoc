import { readFile } from 'fs/promises';
import { join } from 'path';

export function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1]!.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value = line.slice(colonIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)
    result[key] = value
  }
  return result
}

/** Extract title from markdown: frontmatter title > first h1 > fallback */
export function extractTitle(markdown: string, fallback: string): string {
  const fm = parseFrontmatter(markdown);
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return (fm.title as string) || (titleMatch ? titleMatch[1]!.trim() : fallback);
}

/** Build a map of url → page title for all pages */
export async function buildTitleMap(rootDir: string, pages: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const page of pages) {
    try {
      const md = await readFile(join(rootDir, page, 'index.md'), 'utf-8');
      const title = extractTitle(md, page);
      map.set(page === '.' ? '/' : `/${page}`, title);
    } catch {}
  }
  return map;
}
