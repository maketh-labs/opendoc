// The block editor (BlockNote, ProseMirror, Mantine) is the bulk of the editor bundle. Load it as a
// separate chunk so the shell and sidebar render immediately while it downloads.
import { lazy } from 'react'
import type { Block } from '@blocknote/core'

export const LazyBlockEditor = lazy(() => import('./block-editor').then(m => ({ default: m.BlockEditor })))

export async function markdownToBlocks(markdown: string): Promise<Block[]> {
  const { markdownToBlocks: convert } = await import('./markdown')
  return convert(markdown)
}
