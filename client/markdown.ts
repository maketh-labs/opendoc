// Singleton markdown parser — avoids creating a new BlockNote editor per parse call
// and lets the parent resolve blocks *before* mounting BlockEditor (no flash/race)

import { BlockNoteEditor } from '@blocknote/core'
import type { Block } from '@blocknote/core'

let _editor: BlockNoteEditor | null = null

function getEditor(): BlockNoteEditor {
  if (!_editor) _editor = BlockNoteEditor.create()
  return _editor
}

export async function markdownToBlocks(markdown: string): Promise<Block[]> {
  const blocks = await getEditor().tryParseMarkdownToBlocks(markdown)
  return blocks as unknown as Block[]
}

export function blocksToMarkdown(blocks: Block[]): string {
  return getEditor().blocksToMarkdownLossy(blocks)
}
