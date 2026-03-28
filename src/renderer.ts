import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { wikilinkPlugin, type WikilinkOptions } from './wikilinks';
import { calloutPlugin } from './plugins/callouts';
import { tocPlugin, extractToc, type TocEntry } from './plugins/toc';
import { imagePlugin } from './plugins/images';
import { parseFrontmatter as parseFM } from './utils.js';
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

export interface RenderOptions {
  titleMap?: Map<string, string>;
  currentPath?: string;
}

function createProcessor(wikilinkOpts: WikilinkOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(calloutPlugin)
    .use(wikilinkPlugin, wikilinkOpts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight, { detect: true })
    .use(rehypeKatex)
    .use(tocPlugin)
    .use(imagePlugin)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

const defaultProcessor = createProcessor();

export async function render(markdown: string): Promise<string> {
  const result = await defaultProcessor.process(markdown);
  return String(result);
}

export async function renderFull(markdown: string, options: RenderOptions = {}): Promise<RenderResult> {
  const frontmatter = parseFM(markdown) as Frontmatter;

  const wikilinkOpts: WikilinkOptions = {
    titleMap: options.titleMap,
    currentPath: options.currentPath,
  };

  const parsed = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(calloutPlugin)
    .use(wikilinkPlugin, wikilinkOpts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight, { detect: true })
    .use(rehypeKatex)
    .use(tocPlugin)
    .use(imagePlugin);

  const tree = await parsed.run(parsed.parse(markdown)) as Root;
  const toc = extractToc(tree);

  const html = unified()
    .use(rehypeStringify, { allowDangerousHtml: true })
    .stringify(tree);

  return { html: String(html), toc, frontmatter };
}
