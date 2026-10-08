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

export interface ClientBundles {
  viewerJs: string
  editorJs: string | null
  editorCss: string | null
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

async function bundle(entry: string, minify: boolean): Promise<{ js: string | null; css: string | null }> {
  const result = await Bun.build({ entrypoints: [join(CLIENT_DIR, entry)], target: 'browser', minify })
  if (!result.success) {
    console.error(`${entry} bundle build failed:\n` + result.logs.join('\n'))
    return { js: null, css: null }
  }
  let js: string | null = null
  let css: string | null = null
  for (const out of result.outputs) {
    if (out.kind === 'entry-point') js = await out.text()
    else if (out.path.endsWith('.css')) css = await out.text()
  }
  return { js, css }
}

/** Build client bundles from `client/` sources. */
export async function buildClientBundles({ editor = true, minify = false } = {}): Promise<ClientBundles> {
  const viewer = await bundle('viewer.tsx', minify)
  if (!viewer.js) throw new Error('Viewer bundle build failed')
  if (!editor) return { viewerJs: viewer.js, editorJs: null, editorCss: null }
  buildTailwind()
  const ed = await bundle('editor.tsx', minify)
  return { viewerJs: viewer.js, editorJs: ed.js, editorCss: ed.css }
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
