import { visit } from 'unist-util-visit';
import type { Root, Text, Link, Parent } from 'mdast';

// Matches [[page name]] or [[page name|display text]] or [[page#anchor]] or [[page#anchor|text]]
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface WikilinkOptions {
  titleMap?: Map<string, string>  // url → page title
  currentPath?: string            // current page path for broken link warnings
}

export function wikilinkPlugin(options: WikilinkOptions = {}) {
  const { titleMap, currentPath } = options;

  return (tree: Root): void => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined || !WIKILINK_RE.test(node.value)) return;
      WIKILINK_RE.lastIndex = 0;

      const children: (Text | Link)[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = WIKILINK_RE.exec(node.value)) !== null) {
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
        }

        const raw = match[1]!.trim();
        const customText = match[2]?.trim();

        // Parse anchor: [[page#section]] → target="page", anchor="section"
        const hashIdx = raw.indexOf('#');
        const target = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
        const anchor = hashIdx >= 0 ? raw.slice(hashIdx) : ''; // includes the #

        const slug = target.toLowerCase().replace(/\s+/g, '-');
        const href = '/' + slug + anchor;

        // Resolve display text
        let display: string;
        if (customText) {
          display = customText;
        } else if (titleMap && titleMap.has('/' + slug)) {
          display = titleMap.get('/' + slug)!;
        } else {
          display = target;
        }

        // Check for broken links
        const isBroken = titleMap && !titleMap.has('/' + slug);

        const hProperties: Record<string, unknown> = {
          className: isBroken ? ['wikilink', 'od-broken-link'] : ['wikilink'],
        };
        if (isBroken) {
          hProperties.title = 'Page not found';
          if (currentPath) {
            console.warn(`[opendoc] broken link: [[${raw}]] in ${currentPath}`);
          }
        }

        children.push({
          type: 'link',
          url: href,
          children: [{ type: 'text', value: display }],
          data: { hProperties }
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < node.value.length) {
        children.push({ type: 'text', value: node.value.slice(lastIndex) });
      }

      if (children.length > 0) {
        parent.children.splice(index, 1, ...children);
      }
    });
  };
}
