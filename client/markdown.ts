// Singleton markdown parser — avoids creating a new BlockNote editor per parse call
// and lets the parent resolve blocks *before* mounting BlockEditor (no flash/race)

import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import type { Block } from '@blocknote/core'
import { CalloutBlock, CALLOUT_TYPES, type CalloutType } from './callout-block'

import { BookmarkBlock } from './bookmark-block'

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, callout: CalloutBlock(), bookmark: BookmarkBlock() },
})

let _editor: typeof BlockNoteEditor.prototype | null = null

function getEditor() {
  if (!_editor) _editor = BlockNoteEditor.create({ schema }) as any
  return _editor!
}

// Parse GitHub-flavored callout syntax: > [!TYPE]\n> content
function extractCallouts(markdown: string): Array<
  { type: 'text'; text: string } |
  { type: 'callout'; calloutType: CalloutType; content: string }
> {
  const parts: Array<
    { type: 'text'; text: string } |
    { type: 'callout'; calloutType: CalloutType; content: string }
  > = []
  const lines = markdown.split('\n')
  let i = 0
  let buffer = ''

  while (i < lines.length) {
    const line = lines[i]!
    const m = line.match(/^>\s*\[!(INFO|NOTE|TIP|WARNING|CAUTION|IMPORTANT)\](.*)?$/i)
    if (m) {
      if (buffer.trim()) { parts.push({ type: 'text', text: buffer }); buffer = '' }
      const calloutType = m[1]!.toLowerCase() as CalloutType
      let content = (m[2] || '').trim()
      i++
      while (i < lines.length && /^>\s*/.test(lines[i]!) && !lines[i]!.match(/^>\s*\[!/)) {
        const qline = lines[i]!.replace(/^>\s?/, '').trim()
        if (qline) content = content ? content + ' ' + qline : qline
        i++
      }
      parts.push({ type: 'callout', calloutType, content })
    } else {
      buffer += line + '\n'
      i++
    }
  }
  if (buffer.trim()) parts.push({ type: 'text', text: buffer })
  return parts
}

export async function markdownToBlocks(markdown: string): Promise<Block[]> {
  const stripped = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const parts = extractCallouts(stripped)
  const blocks: any[] = []

  for (const part of parts) {
    if (part.type === 'callout') {
      const contentBlocks = part.content
        ? await getEditor().tryParseMarkdownToBlocks(part.content)
        : []
      const inlineContent = contentBlocks.length > 0 && (contentBlocks[0] as any).content
        ? (contentBlocks[0] as any).content
        : [{ type: 'text', text: part.content || '', styles: {} }]
      blocks.push({
        type: 'callout',
        props: { calloutType: part.calloutType },
        content: inlineContent,
        children: [],
      })
    } else {
      const parsed = await getEditor().tryParseMarkdownToBlocks(part.text)
      // Convert bare-URL paragraphs to bookmark blocks
      const enriched = parsed.map((block: any) => {
        if (
          block.type === "paragraph" &&
          block.content?.length === 1 &&
          block.content[0]?.type === "text" &&
          /^https?:\/\/[^\s]+$/.test((block.content[0].text || "").trim())
        ) {
          const url = block.content[0].text.trim()
          return {
            type: "bookmark" as const,
            props: { url, title: "", description: "", favicon: "", domain: "", imageUrl: "" },
            content: [],
            children: [],
          }
        }
        return block
      })
      blocks.push(...enriched)
    }
  }

  return blocks as unknown as Block[]
}

export function blocksToMarkdown(blocks: any[]): string {
  const editor = getEditor()
  const parts: string[] = []

  for (const block of blocks) {
    if (block.type === 'bookmark') {
      const url = block.props?.url || ""
      const title = block.props?.title || ""
      parts.push(title ? `[${title}](${url})` : url)
      continue
    }
    if (block.type === 'callout') {
      const tempParagraph = { ...block, type: 'paragraph', props: {} }
      const contentMd = editor.blocksToMarkdownLossy([tempParagraph])
      const trimmed = contentMd.trim()
      const ct = ((block.props?.calloutType as string) || 'info').toUpperCase()
      if (trimmed) {
        const lines = trimmed.split('\n').map((l: string) => `> ${l}`).join('\n')
        parts.push(`> [!${ct}]\n${lines}`)
      } else {
        parts.push(`> [!${ct}]`)
      }
    } else {
      const md = editor.blocksToMarkdownLossy([block])
      const trimmed = md.trim()
      if (trimmed) parts.push(trimmed)
    }
  }

  return parts.join('\n\n')
}
