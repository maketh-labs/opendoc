// Shared BlockNote schema — used by both the editor and the markdown parser
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { createParser } from 'prosemirror-highlight/shiki'
import { createHighlighter } from 'shiki'
import { CalloutBlock } from './callout-block'
import { BookmarkBlock } from './bookmark-block'
import { YoutubeBlock } from './youtube-block'

// ─── Shiki with full grammars + dual themes ──────────────────────────────────
// BlockNote's codeBlockOptions uses @shikijs/langs-precompiled (simplified grammars).
// We replace the highlighter with full Shiki so the editor highlights identically
// to the viewer (which uses @shikijs/rehype with full grammars).
// Languages load lazily — only fetched when a code block uses that language.
const _g = globalThis as any
_g[Symbol.for('blocknote.shikiHighlighterPromise')] =
  createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [],
  }).then((h: any) => {
    _g[Symbol.for('blocknote.shikiParser')] = createParser(h, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    })
    return h
  })

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    callout: CalloutBlock(),
    bookmark: BookmarkBlock(),
    youtube: YoutubeBlock(),
  },
})
