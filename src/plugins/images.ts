import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element, ElementContent } from 'hast';

export const imagePlugin: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.tagName !== 'p') return;

      // Check if this paragraph contains an img element
      const imgIndex = node.children.findIndex(
        (c): c is Element => c.type === 'element' && c.tagName === 'img'
      );
      if (imgIndex === -1) return;

      const img = node.children[imgIndex] as Element;

      // Add lazy loading and async decoding
      if (!img.properties) img.properties = {};
      img.properties.loading = 'lazy';
      img.properties.decoding = 'async';

      const figureChildren: ElementContent[] = [img];

      // Case 1: <em> is in the same paragraph (no blank line in markdown)
      const emInSamePara = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'em'
      );
      if (emInSamePara) {
        const figcaption: Element = {
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: emInSamePara.children,
        };
        figureChildren.push(figcaption);
      } else {
        // Case 2: <em> is in the next sibling <p> (blank line in markdown)
        const parentChildren = parent.children;
        let nextIdx = index + 1;
        while (nextIdx < parentChildren.length && parentChildren[nextIdx]!.type === 'text') {
          nextIdx++;
        }
        const nextSibling = parentChildren[nextIdx] as Element | undefined;
        if (
          nextSibling &&
          nextSibling.type === 'element' &&
          nextSibling.tagName === 'p' &&
          nextSibling.children.length === 1 &&
          nextSibling.children[0]!.type === 'element' &&
          (nextSibling.children[0] as Element).tagName === 'em'
        ) {
          const emNode = nextSibling.children[0] as Element;
          const figcaption: Element = {
            type: 'element',
            tagName: 'figcaption',
            properties: {},
            children: emNode.children,
          };
          figureChildren.push(figcaption);
          // Remove the caption paragraph (and any text nodes between)
          parentChildren.splice(index + 1, nextIdx - index);
        }
      }

      // Replace the paragraph with a figure
      const figure: Element = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['od-figure'] },
        children: figureChildren,
      };

      (parent.children as Element[])[index] = figure;
    });
  };
};
