import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { wikilinkPlugin } from './wikilinks';
import { calloutPlugin } from './plugins/callouts';
import { tocPlugin, extractToc, type TocEntry } from './plugins/toc';
import { imagePlugin } from './plugins/images';
import type { Root } from 'hast';

export interface Frontmatter {
  icon?: string;
  title?: string;
  [key: string]: unknown;
}

export interface RenderResult {
  html: string;
  toc: TocEntry[];
  frontmatter: Frontmatter;
}

function parseFrontmatter(markdown: string): Frontmatter {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1]!;
  const result: Frontmatter = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(calloutPlugin)
  .use(wikilinkPlugin)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeHighlight, { detect: true })
  .use(tocPlugin)
  .use(imagePlugin)
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function render(markdown: string): Promise<string> {
  const result = await processor.process(markdown);
  return String(result);
}

export async function renderFull(markdown: string): Promise<RenderResult> {
  const frontmatter = parseFrontmatter(markdown);

  const parsed = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(calloutPlugin)
    .use(wikilinkPlugin)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight, { detect: true })
    .use(tocPlugin)
    .use(imagePlugin);

  const tree = await parsed.run(parsed.parse(markdown)) as Root;
  const toc = extractToc(tree);

  const html = unified()
    .use(rehypeStringify, { allowDangerousHtml: true })
    .stringify(tree);

  return { html: String(html), toc, frontmatter };
}
