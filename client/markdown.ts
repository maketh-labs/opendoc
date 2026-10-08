// Singleton markdown parser — avoids creating a new BlockNote editor per parse call
// and lets the parent resolve blocks *before* mounting BlockEditor (no flash/race)

import { BlockNoteEditor } from '@blocknote/core'
import type { Block } from '@blocknote/core'
import { schema } from './schema'
import {
  extractCallouts, formatCallout, preProcessWikiLinks, postProcessWikiLinks,
} from './markdown-text'

let _editor: typeof BlockNoteEditor.prototype | null = null

function getEditor() {
  if (!_editor) _editor = BlockNoteEditor.create({ schema, tables: { headers: true } }) as any
  return _editor!
}

// Bare-URL paragraphs become bookmark or embed blocks; they are saved back as bare URLs.
function enrichBlock(block: any): any {
  if (
    block.type === 'paragraph' &&
    block.content?.length === 1 &&
    block.content[0]?.type === 'text' &&
    /^https?:\/\/[^\s]+$/.test((block.content[0].text || '').trim())
  ) {
    const url = block.content[0].text.trim()
    if (isEmbedUrl(url)) {
      return { type: 'youtube' as const, props: { url, caption: '' }, content: undefined, children: [] }
    }
    return {
      type: 'bookmark' as const,
      props: { url, title: '', description: '', favicon: '', domain: '', imageUrl: '' },
      content: undefined,
      children: [],
    }
  }
  return block
}

export async function markdownToBlocks(markdown: string): Promise<Block[]> {
  const stripped = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const parts = extractCallouts(preProcessWikiLinks(stripped))
  const blocks: any[] = []

  for (const part of parts) {
    if (part.type === 'callout') {
      const parsed: any[] = part.content
        ? (await getEditor().tryParseMarkdownToBlocks(part.content)).map(enrichBlock)
        : []
      // The first paragraph becomes the callout's inline content; everything else nests as children
      const first = parsed[0]
      const hasInlineHead = first?.type === 'paragraph' && Array.isArray(first.content)
      blocks.push({
        type: 'callout',
        props: { calloutType: part.calloutType },
        content: hasInlineHead ? first.content : [],
        children: hasInlineHead ? [...(first.children ?? []), ...parsed.slice(1)] : parsed,
      })
    } else {
      const parsed = await getEditor().tryParseMarkdownToBlocks(part.text)
      blocks.push(...parsed.map(enrichBlock))
    }
  }

  // BlockNote requires initialContent to be a non-empty array
  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: [] } as any)
  }

  return blocks as unknown as Block[]
}

function isEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.includes('youtube.com') || u.hostname === 'youtu.be'
      || u.hostname.includes('vimeo.com') || u.hostname.includes('loom.com')
  } catch { return false }
}

function blocksToMarkdownRaw(blocks: any[]): string {
  const editor = getEditor()
  const parts: string[] = []

  for (const block of blocks) {
    if (block.type === 'youtube' || block.type === 'bookmark') {
      // Always a bare URL so it is re-detected as the same block type on load
      const url = block.props?.url || ''
      if (url) parts.push(url)
      continue
    }
    if (block.type === 'callout') {
      const head = editor.blocksToMarkdownLossy([{ ...block, type: 'paragraph', props: {}, children: [] }]).trim()
      const children = block.children?.length ? blocksToMarkdownRaw(block.children) : ''
      parts.push(formatCallout(block.props?.calloutType as string, [head, children].filter(Boolean).join('\n\n')))
    } else {
      const md = editor.blocksToMarkdownLossy([block])
      const trimmed = md.trim()
      if (trimmed) parts.push(trimmed)
    }
  }

  return parts.join('\n\n')
}

export function blocksToMarkdown(blocks: any[]): string {
  return postProcessWikiLinks(blocksToMarkdownRaw(blocks))
}
