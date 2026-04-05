import { test, expect, describe } from 'bun:test';
import { tocToHtml, type TocEntry } from '../../../src/plugins/toc';
import { renderFull } from '../../../src/renderer';

describe('tocToHtml', () => {
  test('returns empty string for fewer than 2 entries', () => {
    expect(tocToHtml([])).toBe('');
    expect(tocToHtml([{ id: 'one', text: 'One', level: 2 }])).toBe('');
  });

  test('renders TOC with 2+ entries', () => {
    const entries: TocEntry[] = [
      { id: 'section-one', text: 'Section One', level: 2 },
      { id: 'section-two', text: 'Section Two', level: 2 },
    ];
    const html = tocToHtml(entries);
    expect(html).toContain('od-toc');
    expect(html).toContain('On this page');
    expect(html).toContain('href="#section-one"');
    expect(html).toContain('href="#section-two"');
    expect(html).toContain('Section One');
    expect(html).toContain('Section Two');
  });

  test('indents h3 entries', () => {
    const entries: TocEntry[] = [
      { id: 'parent', text: 'Parent', level: 2 },
      { id: 'child', text: 'Child', level: 3 },
    ];
    const html = tocToHtml(entries);
    expect(html).toContain('od-toc-h3');
  });

  test('escapes HTML in TOC text', () => {
    const entries: TocEntry[] = [
      { id: 'a', text: 'A & B', level: 2 },
      { id: 'b', text: '<Code>', level: 2 },
    ];
    const html = tocToHtml(entries);
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;Code&gt;');
  });
});

describe('TOC extraction via renderFull', () => {
  test('extracts h2 and h3 headings only', async () => {
    const md = '# H1\n\n## H2\n\n### H3\n\n#### H4\n';
    const { toc } = await renderFull(md);
    expect(toc).toHaveLength(2);
    expect(toc[0]!.level).toBe(2);
    expect(toc[1]!.level).toBe(3);
  });

  test('generates slugified IDs', async () => {
    const md = '## Hello World\n\n## Another Section\n';
    const { toc } = await renderFull(md);
    expect(toc[0]!.id).toBe('hello-world');
    expect(toc[1]!.id).toBe('another-section');
  });

  test('assigns IDs to heading elements in HTML', async () => {
    const md = '## Test Heading\n\nContent\n\n## Other Heading\n';
    const { html } = await renderFull(md);
    expect(html).toContain('id="test-heading"');
    expect(html).toContain('id="other-heading"');
  });
});
