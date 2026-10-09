import { join, relative, sep, basename, dirname } from 'path'
import { mkdir, rename, readdir, readFile, writeFile, rm, stat } from 'fs/promises'
import { randomBytes } from 'crypto'
import { resolveInRoot, HttpError } from './security'
import { readOrderFile, writeOrderFile } from './order'

/** Deleted pages go here (ignored by git and the walker) so a delete can be undone. */
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function trashRoot(rootDir: string): string {
  return join(rootDir, '.opendoc', 'trash')
}

interface TrashMeta {
  /** Original path relative to root, '/'-separated */
  path: string
  /** Position in the parent's order.json, or -1 */
  orderIndex: number
  deletedAt: number
}

async function ensureTrashDir(rootDir: string): Promise<string> {
  const dir = trashRoot(rootDir)
  await mkdir(dir, { recursive: true })
  const ignore = join(rootDir, '.opendoc', '.gitignore')
  try { await stat(ignore) } catch { await writeFile(ignore, 'trash/\n') }
  return dir
}

/** Move a page folder to the trash. Returns the trash id used to restore it. */
export async function moveToTrash(rootDir: string, fullPath: string): Promise<string> {
  const dir = await ensureTrashDir(rootDir)
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const entry = join(dir, id)
  await mkdir(entry)

  const parent = dirname(fullPath)
  const slug = basename(fullPath)
  const order = await readOrderFile(parent)
  const meta: TrashMeta = {
    path: relative(rootDir, fullPath).split(sep).join('/'),
    orderIndex: order.indexOf(slug),
    deletedAt: Date.now(),
  }
  await writeFile(join(entry, 'meta.json'), JSON.stringify(meta))
  await rename(fullPath, join(entry, 'content'))

  if (meta.orderIndex !== -1) {
    order.splice(meta.orderIndex, 1)
    await writeOrderFile(parent, order)
  }
  return id
}

/** Restore a trashed page to its original location. Returns its path relative to root. */
export async function restoreFromTrash(rootDir: string, id: string): Promise<string> {
  if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'Invalid trash id')
  const entry = join(trashRoot(rootDir), id)
  let meta: TrashMeta
  try {
    meta = JSON.parse(await readFile(join(entry, 'meta.json'), 'utf-8'))
  } catch {
    throw new HttpError(404, 'Nothing to restore (it may have expired)')
  }

  const target = await resolveInRoot(rootDir, meta.path)
  if (!target) throw new HttpError(400, 'Invalid restore path')
  if (await stat(target).then(() => true, () => false)) {
    throw new HttpError(409, `A page already exists at ${meta.path}`)
  }

  await mkdir(dirname(target), { recursive: true })
  await rename(join(entry, 'content'), target)
  await rm(entry, { recursive: true, force: true })

  const parent = dirname(target)
  const order = await readOrderFile(parent)
  const slug = basename(target)
  if (!order.includes(slug) && (meta.orderIndex !== -1 || order.length > 0)) {
    order.splice(meta.orderIndex === -1 ? order.length : Math.min(meta.orderIndex, order.length), 0, slug)
    await writeOrderFile(parent, order)
  }
  return meta.path
}

/** Permanently remove trash entries older than the retention period. */
export async function purgeExpiredTrash(rootDir: string): Promise<void> {
  let ids: string[]
  try { ids = await readdir(trashRoot(rootDir)) } catch { return }
  const cutoff = Date.now() - TRASH_RETENTION_MS
  await Promise.all(ids.map(async id => {
    const deletedAt = Number(id.split('-')[0])
    if (Number.isFinite(deletedAt) && deletedAt < cutoff) {
      await rm(join(trashRoot(rootDir), id), { recursive: true, force: true })
    }
  }))
}
