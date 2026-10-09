import { test, expect, describe } from 'bun:test'
import MiniSearch from 'minisearch'
import { highlight, snippet, matchedHeading, headingAnchor, termsRegExp } from '../../../client/search-text'

describe('termsRegExp', () => {
  test('escapes regex characters and prefers longer terms', () => {
    const re = termsRegExp(['c++', 'c'])!
    expect('use c++ now'.replace(re, '[$1]')).toBe('use [c++] now')
  })

  test('returns null for empty terms', () => {
    expect(termsRegExp(['', '  '])).toBeNull()
  })
})

describe('highlight', () => {
  test('splits text into matched and plain segments, case-insensitively', () => {
    expect(highlight('Launch a Token today', ['token'])).toEqual([
      { text: 'Launch a ', match: false },
      { text: 'Token', match: true },
      { text: ' today', match: false },
    ])
  })

  test('keeps markup-like text as plain text segments', () => {
    const segs = highlight('<img onerror=x> token', ['token'])
    expect(segs[0]).toEqual({ text: '<img onerror=x> ', match: false })
  })
})

describe('snippet', () => {
  const text = 'Alpha beta gamma. '.repeat(20) + 'The liquidity pool backs every loan. ' + 'Delta epsilon. '.repeat(20)

  test('centers on the first match with ellipses', () => {
    const s = snippet(text, ['liquidity'], 30)
    expect(s).toContain('liquidity')
    expect(s.startsWith('… ')).toBe(true)
    expect(s.endsWith(' …')).toBe(true)
  })

  test('does not cut words in half', () => {
    const s = snippet(text, ['liquidity'], 30).replace(/^… | …$/g, '')
    for (const word of s.split(' ')) expect(text).toContain(word)
  })

  test('falls back to the start when nothing matches', () => {
    expect(snippet('Hello world', ['zzz'])).toBe('Hello world')
  })
})

describe('matchedHeading / headingAnchor', () => {
  test('finds the first heading containing a term', () => {
    expect(matchedHeading(['Overview', 'How funding works', 'Fees'], ['funding'])).toBe('How funding works')
    expect(matchedHeading(['Overview'], ['nope'])).toBeNull()
  })

  test('anchor matches the server TOC slug', () => {
    expect(headingAnchor('How positions work')).toBe('how-positions-work')
    expect(headingAnchor("What's new?")).toBe('whats-new')
  })
})

describe('MiniSearch configuration', () => {
  test('prefix search ranks title matches above body matches', () => {
    const ms = new MiniSearch({
      fields: ['title', 'headings', 'text'],
      extractField: (doc: any, field) => (Array.isArray(doc[field]) ? doc[field].join(' ') : doc[field]),
      searchOptions: { boost: { title: 3, headings: 2 }, prefix: true, combineWith: 'AND' },
    })
    ms.addAll([
      { id: 'a', title: 'Fees', headings: [], text: 'Liquidity providers earn on swaps.' },
      { id: 'b', title: 'Providing liquidity', headings: ['Withdrawing'], text: 'Add funds to the pool.' },
    ])
    const results = ms.search('liqui')
    expect(results.map(r => r.id)).toEqual(['b', 'a'])
  })
})
