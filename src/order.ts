import { join } from 'path'
import { readFile, writeFile, unlink } from 'fs/promises'

/** Read a folder's order.json (child folder names in display order). Missing/invalid → []. */
export async function readOrderFile(dir: string): Promise<string[]> {
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'order.json'), 'utf-8'))
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) return parsed
  } catch {}
  return []
}

/** Write order.json; an empty order removes the file. */
export async function writeOrderFile(dir: string, order: string[]): Promise<void> {
  if (order.length === 0) {
    try { await unlink(join(dir, 'order.json')) } catch {}
    return
  }
  await writeFile(join(dir, 'order.json'), JSON.stringify(order, null, 2) + '\n')
}

/** Remove a slug from a folder's order.json. */
export async function removeFromOrder(dir: string, slug: string): Promise<void> {
  const order = await readOrderFile(dir)
  const next = order.filter(s => s !== slug)
  if (next.length !== order.length) await writeOrderFile(dir, next)
}

/** Insert a slug into a folder's order.json (after `after`, or at the end). No-op if present. */
export async function addToOrder(dir: string, slug: string, after?: string): Promise<void> {
  const order = await readOrderFile(dir)
  if (order.includes(slug)) return
  const idx = after ? order.indexOf(after) : -1
  if (idx === -1) order.push(slug)
  else order.splice(idx + 1, 0, slug)
  await writeOrderFile(dir, order)
}
