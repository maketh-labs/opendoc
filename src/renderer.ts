import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeShiki from '@shikijs/rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
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

/**
 * Allowlist for author content. Raw HTML in markdown is parsed (rehype-raw) and then sanitized,
 * so scripts, event handlers, and javascript: URLs never reach the page — docs content is shared
 * with the editor's origin, which holds a GitHub token. Runs before Shiki/KaTeX/TOC so their
 * generated markup is not affected.
 */
// defaultSchema pins className to specific values on some tags (a, li, h2, …); classes are harmless, so lift that
const defaultAttributes = Object.fromEntries(
  Object.entries(defaultSchema.attributes ?? {}).map(([tag, attrs]) => [
    tag,
    attrs.filter(attr => (Array.isArray(attr) ? attr[0] : attr) !== 'className'),
  ]),
);

const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  // Keep heading ids as written so TOC and #anchor links work
  clobberPrefix: '',
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'figure', 'figcaption', 'mark', 'u', 'abbr', 'iframe', 'video', 'audio', 'source',
  ],
  attributes: {
    ...defaultAttributes,
    '*': [...(defaultAttributes['*'] ?? []), 'className', 'style'],
    iframe: ['src', 'width', 'height', 'title', 'allow', 'allowFullScreen', 'frameBorder', 'loading', 'referrerPolicy'],
    video: ['src', 'width', 'height', 'poster', 'controls', 'autoPlay', 'loop', 'muted', 'playsInline', 'preload'],
    audio: ['src', 'controls', 'autoPlay', 'loop', 'muted', 'preload'],
    source: ['src', 'type'],
    img: [...(defaultAttributes.img ?? []), 'width', 'height', 'loading'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
    poster: ['http', 'https'],
  },
};

function createProcessor(wikilinkOpts: WikilinkOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(calloutPlugin)
    .use(wikilinkPlugin, wikilinkOpts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    })
    .use(rehypeKatex)
    .use(tocPlugin)
    .use(imagePlugin)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

const defaultProcessor = createProcessor();

// Cache a reusable stringify processor — it has no per-call options
const stringifyProcessor = unified().use(rehypeStringify, { allowDangerousHtml: true });

export async function renderFull(markdown: string, options: RenderOptions = {}): Promise<RenderResult> {
  const frontmatter = parseFM(markdown) as Frontmatter;

  const wikilinkOpts: WikilinkOptions = {
    titleMap: options.titleMap,
    currentPath: options.currentPath,
  };

  // Use the cached default processor when no wikilink options are provided,
  // otherwise create a custom one with the titleMap/currentPath
  const hasWikilinkOpts = options.titleMap?.size || options.currentPath;
  const processor = hasWikilinkOpts ? createProcessor(wikilinkOpts) : defaultProcessor;

  const tree = await processor.run(processor.parse(markdown)) as Root;
  const toc = extractToc(tree);

  const html = stringifyProcessor.stringify(tree);

  return { html: String(html), toc, frontmatter };
}
