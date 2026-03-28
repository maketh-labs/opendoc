import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element } from 'hast';
import { escapeHtml } from '../utils.js';

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function getTextContent(node: Element): string {
  let text = '';
  visit(node, 'text', (textNode: any) => {
    text += textNode.value;
  });
  return text;
}

export function extractToc(tree: Root): TocEntry[] {
  const entries: TocEntry[] = [];

  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'h2' && node.tagName !== 'h3') return;

    const text = getTextContent(node);
    const id = (node.properties?.id as string) || slugify(text);

    // Ensure the heading has an id
    if (!node.properties) node.properties = {};
    node.properties.id = id;

    entries.push({
      id,
      text,
      level: node.tagName === 'h2' ? 2 : 3,
    });
  });

  return entries;
}

export function tocToHtml(entries: TocEntry[]): string {
  if (entries.length < 2) return '';

  const items = entries.map(e => {
    const indent = e.level === 3 ? ' class="od-toc-h3"' : '';
    return `<li${indent}><a href="#${e.id}">${escapeHtml(e.text)}</a></li>`;
  }).join('\n    ');

  return `<div class="od-toc" id="od-toc">
  <div class="od-toc-title">On this page</div>
  <ul class="od-toc-list">
    ${items}
  </ul>
</div>`;
}

/**
 * Rehype plugin that adds ids to h2/h3 headings.
 * TOC data is extracted separately via extractToc.
 */
export const tocPlugin: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return;
      if (node.properties?.id) return;

      const text = getTextContent(node);
      if (!node.properties) node.properties = {};
      node.properties.id = slugify(text);
    });
  };
};
