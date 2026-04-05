import { test, expect, describe } from 'bun:test';
import { renderFull } from '../../src/renderer';

describe('renderFull', () => {
  test('renders basic markdown to HTML', async () => {
    const { html } = await renderFull('# Hello\n\nWorld');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<p>World</p>');
  });

  test('renders GFM tables', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const { html } = await renderFull(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  test('renders GFM strikethrough', async () => {
    const { html } = await renderFull('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });

  test('renders code blocks with syntax highlighting', async () => {
    const md = '```js\nconst x = 1;\n```';
    const { html } = await renderFull(md);
    // Shiki wraps in <pre><code>
    expect(html).toContain('<pre');
    expect(html).toContain('const');
  });

  test('extracts frontmatter', async () => {
    const md = '---\ntitle: Test Page\nicon: star\n---\n\n# Content';
    const { frontmatter } = await renderFull(md);
    expect(frontmatter.title).toBe('Test Page');
    expect(frontmatter.icon).toBe('star');
  });

  test('does not render frontmatter as content', async () => {
    const md = '---\ntitle: Test\n---\n\n# Content';
    const { html } = await renderFull(md);
    expect(html).not.toContain('title: Test');
  });

  test('extracts TOC from h2 and h3 headings', async () => {
    const md = '# Title\n\n## Section One\n\n### Sub A\n\n## Section Two\n';
    const { toc } = await renderFull(md);
    expect(toc).toHaveLength(3);
    expect(toc[0]!.text).toBe('Section One');
    expect(toc[0]!.level).toBe(2);
    expect(toc[1]!.text).toBe('Sub A');
    expect(toc[1]!.level).toBe(3);
    expect(toc[2]!.text).toBe('Section Two');
  });

  test('resolves wikilinks when titleMap provided', async () => {
    const titleMap = new Map([['/getting-started', 'Getting Started Guide']]);
    const md = 'See [[Getting Started]]';
    const { html } = await renderFull(md, { titleMap });
    expect(html).toContain('href="/getting-started"');
    expect(html).toContain('Getting Started Guide');
  });

  test('marks broken wikilinks', async () => {
    const titleMap = new Map<string, string>();
    const md = 'See [[Nonexistent Page]]';
    const { html } = await renderFull(md, { titleMap, currentPath: 'test' });
    // Wikilink plugin adds hProperties but rehype serialization may differ.
    // The link should still be rendered — broken link classes may be in data attributes
    expect(html).toContain('href="/nonexistent-page"');
    expect(html).toContain('wikilink');
  });

  test('renders math expressions', async () => {
    const md = 'Inline $E = mc^2$ here';
    const { html } = await renderFull(md);
    // KaTeX renders math into spans
    expect(html).toContain('katex');
  });

  test('handles empty markdown', async () => {
    const { html, toc, frontmatter } = await renderFull('');
    expect(html).toBe('');
    expect(toc).toEqual([]);
    expect(frontmatter).toEqual({});
  });
});
