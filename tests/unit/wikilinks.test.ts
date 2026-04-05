import { test, expect, describe } from 'bun:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { wikilinkPlugin } from '../../src/wikilinks';

async function processWikilinks(md: string, titleMap?: Map<string, string>) {
  const processor = unified()
    .use(remarkParse)
    .use(wikilinkPlugin, { titleMap, currentPath: 'test' })
    .use(remarkRehype)
    .use(rehypeStringify);
  const result = await processor.process(md);
  return String(result);
}

describe('wikilinkPlugin', () => {
  test('converts simple wikilinks to links', async () => {
    const html = await processWikilinks('See [[Getting Started]]');
    expect(html).toContain('href="/getting-started"');
    expect(html).toContain('Getting Started');
    expect(html).toContain('wikilink');
  });

  test('supports custom display text', async () => {
    const html = await processWikilinks('See [[page|Custom Text]]');
    expect(html).toContain('href="/page"');
    expect(html).toContain('Custom Text');
  });

  test('resolves display text from titleMap', async () => {
    const titleMap = new Map([['/getting-started', 'The Getting Started Guide']]);
    const html = await processWikilinks('See [[Getting Started]]', titleMap);
    expect(html).toContain('The Getting Started Guide');
  });

  test('marks broken links when titleMap provided', async () => {
    const titleMap = new Map<string, string>();
    const html = await processWikilinks('See [[Nonexistent]]', titleMap);
    expect(html).toContain('od-broken-link');
    expect(html).toContain('Page not found');
  });

  test('does not mark broken links without titleMap', async () => {
    const html = await processWikilinks('See [[Anything]]');
    expect(html).not.toContain('od-broken-link');
  });

  test('handles anchors in wikilinks', async () => {
    const html = await processWikilinks('See [[Page#section]]');
    expect(html).toContain('href="/page#section"');
  });

  test('handles multiple wikilinks in one paragraph', async () => {
    const html = await processWikilinks('See [[One]] and [[Two]]');
    expect(html).toContain('href="/one"');
    expect(html).toContain('href="/two"');
  });

  test('preserves surrounding text', async () => {
    const html = await processWikilinks('Before [[Link]] after');
    expect(html).toContain('Before');
    expect(html).toContain('after');
  });

  test('ignores text without wikilinks', async () => {
    const html = await processWikilinks('Just plain text');
    expect(html).toContain('Just plain text');
    expect(html).not.toContain('href');
  });
});
