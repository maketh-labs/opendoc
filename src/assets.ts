/**
 * Static assets the server and builder ship to browsers.
 *
 * Theme files and preview images are imported directly so `bun build --compile` embeds them.
 * Client bundles come from `src/generated/` (written by `scripts/bundle-client.ts` before
 * publishing/compiling); in a source checkout with `client/` present they are built on demand
 * instead, so local edits to the client are always picked up.
 */
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import viewerHtml from '../themes/default/viewer.html' with { type: 'text' }
import editorHtml from '../themes/default/editor.html' with { type: 'text' }
import templateHtml from '../themes/default/template.html' with { type: 'text' }
import styleCss from '../themes/default/style.css' with { type: 'text' }
import appSwitchWebp from '../client/assets/app-switch.webp' with { type: 'file' }
import homescreenAndroidWebp from '../client/assets/homescreen-android.webp' with { type: 'file' }
import homescreenIosWebp from '../client/assets/homescreen-ios.webp' with { type: 'file' }

export const themeFiles = {
  viewerHtml: viewerHtml as unknown as string,
  editorHtml: editorHtml as unknown as string,
  templateHtml: templateHtml as unknown as string,
  styleCss: styleCss as unknown as string,
}

/** Images used by the editor UI, served at /_opendoc/assets/<name>. Values are (possibly embedded) file paths. */
export const editorImages: Record<string, string> = {
  'app-switch.webp': appSwitchWebp as unknown as string,
  'homescreen-android.webp': homescreenAndroidWebp as unknown as string,
  'homescreen-ios.webp': homescreenIosWebp as unknown as string,
}

/** Browser bundle files served at /_opendoc/<name>: viewer.js, editor.js, editor.css and code-split chunks */
export interface ClientBundles {
  files: Record<string, string>
}

const PACKAGE_ROOT = dirname(import.meta.dir)
const CLIENT_DIR = join(PACKAGE_ROOT, 'client')

/** True when running from a source checkout (client sources on disk), as opposed to a published package or binary. */
export function hasClientSources(): boolean {
  return process.env.OPENDOC_PREBUILT !== '1' && existsSync(join(CLIENT_DIR, 'viewer.tsx'))
}

/** Compile Tailwind for the editor. Returns false (and logs) on failure. */
export function buildTailwind(): boolean {
  const proc = Bun.spawnSync(
    [process.execPath, 'x', 'tailwindcss', '-i', join(CLIENT_DIR, 'globals.css'), '-o', join(CLIENT_DIR, 'globals.gen.css'), '--minify'],
    { cwd: PACKAGE_ROOT, stdout: 'ignore', stderr: 'pipe' },
  )
  if (proc.exitCode !== 0) {
    console.error('Tailwind build failed:\n' + proc.stderr.toString())
    return false
  }
  return true
}

async function bundle(entry: string, { minify, splitting }: { minify: boolean; splitting: boolean }): Promise<Record<string, string> | null> {
  const result = await Bun.build({
    entrypoints: [join(CLIENT_DIR, entry)],
    target: 'browser',
    minify,
    splitting,
    // Production React for minified (published) builds; dev builds keep React's warnings
    define: minify ? { 'process.env.NODE_ENV': '"production"' } : undefined,
    // Flat names: everything is served from /_opendoc/, and chunks are imported relative to the entry
    naming: { entry: '[name].[ext]', chunk: 'chunk-[hash].[ext]', asset: '[name]-[hash].[ext]' },
  })
  if (!result.success) {
    console.error(`${entry} bundle build failed:\n` + result.logs.join('\n'))
    return null
  }
  const files: Record<string, string> = {}
  for (const out of result.outputs) files[out.path.replace(/^.*[\\/]/, '')] = await out.text()
  return files
}

/** Build client bundles from `client/` sources. */
export async function buildClientBundles({ editor = true, minify = false } = {}): Promise<ClientBundles> {
  const viewer = await bundle('viewer.tsx', { minify, splitting: false })
  if (!viewer) throw new Error('Viewer bundle build failed')
  if (!editor) return { files: viewer }
  buildTailwind()
  const ed = await bundle('editor.tsx', { minify, splitting: true })
  if (!ed) console.error('Editor unavailable: bundle build failed')
  return { files: { ...viewer, ...ed } }
}

/** Load prebuilt bundles from src/generated (embedded in compiled binaries). */
async function loadPrebuiltBundles(): Promise<ClientBundles> {
  try {
    const mod = await import('./generated/client-bundles')
    return mod.default as ClientBundles
  } catch {
    throw new Error(
      'OpenDoc client bundles are missing. Run `bun run scripts/bundle-client.ts` (or reinstall the package).',
    )
  }
}

export async function loadClientBundles({ editor = true } = {}): Promise<ClientBundles> {
  if (hasClientSources()) return buildClientBundles({ editor })
  return loadPrebuiltBundles()
}
