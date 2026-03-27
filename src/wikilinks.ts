import { visit } from 'unist-util-visit';
import type { Root, Text, Link, Parent } from 'mdast';

// Matches [[page name]] or [[page name|display text]]
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function wikilinkPlugin() {
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

        const target = match[1]!.trim();
        const display = (match[2] || match[1]!).trim();
        const href = '/' + target.toLowerCase().replace(/\s+/g, '-');

        children.push({
          type: 'link',
          url: href,
          children: [{ type: 'text', value: display }],
          data: { hProperties: { className: ['wikilink'] } }
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
