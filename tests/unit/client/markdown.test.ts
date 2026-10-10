import { test, expect, describe } from 'bun:test'
import {
  splitFencedCode, mapOutsideCode, preProcessWikiLinks, postProcessWikiLinks,
  extractCallouts, formatCallout, extractPageMeta, buildMarkdown, generateCommitMessage,
} from '../../../client/markdown-text'

const roundTrip = (md: string) => postProcessWikiLinks(preProcessWikiLinks(md))

describe('wikilinks', () => {
  test('plain, labelled and anchored links round-trip', () => {
    for (const md of ['[[Getting Started]]', '[[Page|Label]]', '[[Page#Some Section]]', '[[Page#Sec|Label]]']) {
      expect(roundTrip(md)).toBe(md)
    }
  })

  test('labels with brackets and pages with parentheses survive', () => {
    expect(roundTrip('[[Foo (bar)|see [this] one]]')).toBe('[[Foo (bar)|see [this] one]]')
    const pre = preProcessWikiLinks('[[Foo (bar)]]')
    expect(pre).toBe('[Foo (bar)](/wl/Foo%20%28bar%29)')
  })

  test('anchors containing # and %23 decode fully', () => {
    expect(roundTrip('[[Page#C# basics]]')).toBe('[[Page#C# basics]]')
  })

  test('code blocks and inline code are untouched', () => {
    const md = 'See [[A]] and `[[B]]`\n\n```md\n[[C]]\n[x](/wl/D)\n```\n'
    const pre = preProcessWikiLinks(md)
    expect(pre).toContain('[A](/wl/A)')
    expect(pre).toContain('`[[B]]`')
    expect(pre).toContain('[[C]]')
    expect(postProcessWikiLinks(pre)).toBe(md)
  })
})

describe('fenced code', () => {
  test('splits prose and code and preserves text', () => {
    const md = 'a\n```js\nx\n```\nb\n~~~~\n```\n~~~~\nc'
    const segs = splitFencedCode(md)
    expect(segs.map(s => s.code)).toEqual([false, true, false, true, false])
    expect(segs.map(s => s.text).join('\n')).toBe(md)
  })

  test('unterminated fence is code until the end', () => {
    expect(mapOutsideCode('x\n```\ny', s => s.toUpperCase())).toBe('X\n```\ny')
  })
})

describe('callouts', () => {
  test('multi-line content with lists keeps its structure', () => {
    const parts = extractCallouts('Intro\n\n> [!WARNING]\n> First line\n> second line\n>\n> - a\n> - b\n\nAfter\n')
    expect(parts[0]).toEqual({ type: 'text', text: 'Intro\n\n' })
    expect(parts[1]).toEqual({ type: 'callout', calloutType: 'warning', content: 'First line\nsecond line\n\n- a\n- b' })
    expect(parts[2]!.type).toBe('text')
  })

  test('callout syntax inside a code fence is not a callout', () => {
    const parts = extractCallouts('```\n> [!NOTE]\n> hi\n```\n')
    expect(parts).toHaveLength(1)
    expect(parts[0]!.type).toBe('text')
  })

  test('formatCallout quotes every line, blank lines as ">"', () => {
    expect(formatCallout('tip', 'One\n\n- a\n- b')).toBe('> [!TIP]\n> One\n>\n> - a\n> - b')
    expect(formatCallout('note', '')).toBe('> [!NOTE]')
  })

  test('extract → format round-trips', () => {
    const md = '> [!IMPORTANT]\n> Line one\n>\n> 1. x\n> 2. y'
    const [c] = extractCallouts(md)
    if (c?.type !== 'callout') throw new Error('expected callout')
    expect(formatCallout(c.calloutType, c.content)).toBe(md)
  })
})

describe('front matter', () => {
  test('all keys are preserved and icon is updated in place', () => {
    const md = '---\ntitle: Custom\nicon: 📘\ntags: [a, b]\n---\n\n# Hello\n\nBody'
    const meta = extractPageMeta(md)
    expect(meta).toMatchObject({ title: 'Hello', icon: '📘', body: 'Body' })
    expect(buildMarkdown(meta.title, meta.icon, meta.body, meta.frontmatter)).toBe(md)
    expect(buildMarkdown(meta.title, '🚀', meta.body, meta.frontmatter))
      .toBe('---\ntitle: Custom\nicon: 🚀\ntags: [a, b]\n---\n\n# Hello\n\nBody')
    expect(buildMarkdown(meta.title, '', meta.body, meta.frontmatter))
      .toBe('---\ntitle: Custom\ntags: [a, b]\n---\n\n# Hello\n\nBody')
  })

  test('no front matter block when nothing to write', () => {
    expect(buildMarkdown('T', '', 'b')).toBe('# T\n\nb')
    expect(buildMarkdown('T', 'x', 'b')).toBe('---\nicon: x\n---\n\n# T\n\nb')
  })
})

test('commit message heuristic', () => {
  expect(generateCommitMessage('guides/index.md', undefined, 'x')).toBe('docs(guides): create page')
  expect(generateCommitMessage('index.md', 'a', 'b')).toBe('docs(home): revise content')
  expect(generateCommitMessage('a/index.md', 'x', 'x\n'.repeat(10))).toBe('docs(a): expand content')
})
