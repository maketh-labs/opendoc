import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';

const CALLOUT_TYPES: Record<string, { icon: string; color: string }> = {
  NOTE: { icon: '\u2139\uFE0F', color: 'blue' },
  TIP: { icon: '\uD83D\uDCA1', color: 'green' },
  WARNING: { icon: '\u26A0\uFE0F', color: 'yellow' },
  DANGER: { icon: '\uD83D\uDEAB', color: 'red' },
  INFO: { icon: '\uD83D\uDCCC', color: 'purple' },
};

const CALLOUT_REGEX = /^\[!(\w+)\]\s*/;

export const calloutPlugin: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) => {
      if (!parent || index === undefined) return;

      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') return;

      const firstInline = firstChild.children[0];
      if (!firstInline || firstInline.type !== 'text') return;

      const match = firstInline.value.match(CALLOUT_REGEX);
      if (!match) return;

      const type = match[1]!.toUpperCase();
      const config = CALLOUT_TYPES[type];
      if (!config) return;

      // Remove the [!TYPE] prefix from the text
      firstInline.value = firstInline.value.replace(CALLOUT_REGEX, '');
      // If first paragraph is now empty text, remove it
      if (firstInline.value === '' && firstChild.children.length === 1) {
        node.children.shift();
      }

      // Convert blockquote to HTML via hProperties
      const bodyChildren = node.children;

      // Replace the blockquote with raw HTML nodes
      (parent.children as any)[index!] = {
        type: 'html',
        value: '', // placeholder, we'll build it
      };

      // Build the inner content by collecting text from remaining children
      // We need to use a different approach - mark the node for rehype processing
      // Instead, transform to HTML directly using remark's html node type
      const innerMd = bodyChildren;

      // Actually, let's use the data.hName/hProperties approach for remark-rehype
      const calloutNode: any = {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'html', value: `<div class="od-callout-icon">${config.icon}</div>` }],
            data: { hName: 'div' },
          },
          {
            type: 'blockquote',
            children: bodyChildren,
            data: {
              hName: 'div',
              hProperties: { className: ['od-callout-body'] },
            },
          },
        ],
        data: {
          hName: 'div',
          hProperties: { className: ['od-callout', `od-callout-${type.toLowerCase()}`] },
        },
      };

      (parent.children as any)[index!] = calloutNode;
    });
  };
};
