import { readFile } from 'fs/promises';
import { join } from 'path';
import { getAllPages } from './walker';
import { WIKILINK_RE, slugify } from './utils.js';
import type { BacklinksIndex } from './types';

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

/** Internal link targets (wikilinks and relative markdown links) in a page, normalized to page paths */
export function extractLinkTargets(content: string): Set<string> {
  const targets = new Set<string>();

  for (const match of content.matchAll(WIKILINK_RE)) {
    targets.add(slugify(match[1]!.trim()));
  }

  for (const match of content.matchAll(MD_LINK_RE)) {
    const href = match[2]!;
    if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
      targets.add(href.replace(/^\//, '').replace(/\/$/, ''));
    }
  }

  return targets;
}

export async function buildBacklinks(rootDir: string): Promise<BacklinksIndex> {
  const pages = await getAllPages(rootDir);
  const index: BacklinksIndex = {};

  for (const page of pages) {
    let content: string;
    try {
      content = await readFile(join(rootDir, page, 'index.md'), 'utf-8');
    } catch {
      continue;
    }
    for (const target of extractLinkTargets(content)) {
      if (!index[target]) index[target] = [];
      index[target].push(page);
    }
  }

  return index;
}
