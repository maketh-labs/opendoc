import { readFile } from 'fs/promises';
import { join } from 'path';
import { getAllPages } from './walker';
import { WIKILINK_RE, slugify } from './utils.js';
import type { BacklinksIndex } from './types';

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export async function buildBacklinks(rootDir: string): Promise<BacklinksIndex> {
  const pages = await getAllPages(rootDir);
  const index: BacklinksIndex = {};

  for (const page of pages) {
    const filePath = join(rootDir, page, 'index.md');
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const targets = new Set<string>();

    // Extract wikilinks
    let match: RegExpExecArray | null;
    while ((match = WIKILINK_RE.exec(content)) !== null) {
      targets.add(slugify(match[1]!.trim()));
    }
    WIKILINK_RE.lastIndex = 0;

    // Extract markdown links (internal only)
    while ((match = MD_LINK_RE.exec(content)) !== null) {
      const href = match[2]!;
      if (!href.startsWith('http') && !href.startsWith('#')) {
        targets.add(href.replace(/^\//, '').replace(/\/$/, ''));
      }
    }
    MD_LINK_RE.lastIndex = 0;

    for (const target of targets) {
      if (!index[target]) index[target] = [];
      index[target].push(page);
    }
  }

  return index;
}
