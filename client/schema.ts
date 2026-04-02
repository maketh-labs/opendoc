// Shared BlockNote schema — used by both the editor and the markdown parser
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { createParser } from 'prosemirror-highlight/shiki'
import { CalloutBlock } from './callout-block'
import { BookmarkBlock } from './bookmark-block'
import { YoutubeBlock } from './youtube-block'

// ─── Shiki dual-theme ────────────────────────────────────────────────────────
// prosemirror-highlight's createParser accepts a Shiki options object.
// We pre-create the parser with dual themes and cache it globally so
// BlockNote picks it up instead of creating its own single-theme parser.
const _g = globalThis as any
_g[Symbol.for('blocknote.shikiHighlighterPromise')] =
  codeBlockOptions.createHighlighter().then((h: any) => {
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
