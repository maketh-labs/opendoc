import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { wikilinkPlugin } from './wikilinks';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(wikilinkPlugin)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeHighlight, { detect: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function render(markdown: string): Promise<string> {
  const result = await processor.process(markdown);
  return String(result);
}
