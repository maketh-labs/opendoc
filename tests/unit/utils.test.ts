import { test, expect, describe } from 'bun:test';
import { escapeHtml, parseFrontmatter, slugify, extractTitle, WIKILINK_RE, buildTitleMap } from '../../src/utils';
import { createTempDocs, cleanupTempDocs } from '../helpers';

describe('escapeHtml', () => {
  test('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  test('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('passes through clean strings unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  test('escapes multiple special chars', () => {
    expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
  });
});

describe('parseFrontmatter', () => {
  test('parses simple key-value pairs', () => {
    const md = '---\ntitle: Hello\nicon: rocket\n---\n\n# Content';
    expect(parseFrontmatter(md)).toEqual({ title: 'Hello', icon: 'rocket' });
  });

  test('strips quotes from values', () => {
    const md = '---\ntitle: "Hello World"\nicon: \'rocket\'\n---';
    expect(parseFrontmatter(md)).toEqual({ title: 'Hello World', icon: 'rocket' });
  });

  test('returns empty object when no frontmatter', () => {
    expect(parseFrontmatter('# Just a heading')).toEqual({});
  });

  test('returns empty object for empty string', () => {
    expect(parseFrontmatter('')).toEqual({});
  });

  test('handles colons in values', () => {
    const md = '---\ntitle: Hello: World\n---';
    expect(parseFrontmatter(md)).toEqual({ title: 'Hello: World' });
  });

  test('ignores lines without colons', () => {
    const md = '---\ntitle: Hello\nbroken line\n---';
    expect(parseFrontmatter(md)).toEqual({ title: 'Hello' });
  });

  test('handles unicode escape values', () => {
    const md = '---\nicon: \\u{1F680}\n---';
    const result = parseFrontmatter(md);
    expect(result.icon).toBe('\\u{1F680}');
  });
});

describe('slugify', () => {
  test('lowercases text', () => {
    expect(slugify('Hello')).toBe('hello');
  });

  test('replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('replaces multiple spaces with single hyphen', () => {
    // slugify uses \s+ which collapses multiple spaces
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  test('handles already-slugified text', () => {
    expect(slugify('hello-world')).toBe('hello-world');
  });
});

describe('WIKILINK_RE', () => {
  test('matches simple wikilinks', () => {
    const matches = [...'See [[Getting Started]] here'.matchAll(WIKILINK_RE)];
    expect(matches).toHaveLength(1);
    expect(matches[0]![1]).toBe('Getting Started');
    expect(matches[0]![2]).toBeUndefined();
  });

  test('matches wikilinks with display text', () => {
    const matches = [...'See [[page|Display Text]] here'.matchAll(WIKILINK_RE)];
    expect(matches).toHaveLength(1);
    expect(matches[0]![1]).toBe('page');
    expect(matches[0]![2]).toBe('Display Text');
  });

  test('matches multiple wikilinks', () => {
    const matches = [...'[[one]] and [[two]] and [[three]]'.matchAll(WIKILINK_RE)];
    expect(matches).toHaveLength(3);
  });

  test('does not match empty brackets', () => {
    const matches = [...'[[]]'.matchAll(WIKILINK_RE)];
    expect(matches).toHaveLength(0);
  });
});

describe('extractTitle', () => {
  test('uses frontmatter title when available', () => {
    const md = '---\ntitle: FM Title\n---\n\n# H1 Title';
    expect(extractTitle(md, 'fallback')).toBe('FM Title');
  });

  test('falls back to first h1', () => {
    const md = '# H1 Title\n\nSome content';
    expect(extractTitle(md, 'fallback')).toBe('H1 Title');
  });

  test('falls back to provided fallback', () => {
    const md = 'No heading here, just content.';
    expect(extractTitle(md, 'My Fallback')).toBe('My Fallback');
  });

  test('prefers frontmatter over h1', () => {
    const md = '---\ntitle: From FM\n---\n\n# From H1';
    expect(extractTitle(md, 'fallback')).toBe('From FM');
  });
});

describe('buildTitleMap', () => {
  test('builds title map from pages', async () => {
    const tmpDir = await createTempDocs();
    try {
      const map = await buildTitleMap(tmpDir, ['getting-started', 'api-reference']);
      expect(map.get('/getting-started')).toBe('Getting Started');
      expect(map.get('/api-reference')).toBe('API Reference');
    } finally {
      await cleanupTempDocs(tmpDir);
    }
  });

  test('maps root page to /', async () => {
    const tmpDir = await createTempDocs();
    try {
      const map = await buildTitleMap(tmpDir, ['.']);
      expect(map.get('/')).toBe('My Test Docs');
    } finally {
      await cleanupTempDocs(tmpDir);
    }
  });

  test('skips missing pages gracefully', async () => {
    const tmpDir = await createTempDocs();
    try {
      const map = await buildTitleMap(tmpDir, ['nonexistent']);
      expect(map.size).toBe(0);
    } finally {
      await cleanupTempDocs(tmpDir);
    }
  });
});
