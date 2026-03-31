import { readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { watch as fsWatch } from 'fs';
import { createServer } from 'http';
import type { ServerResponse } from 'http';
import { walkDir, getAllPages } from './walker';
import { buildBacklinks } from './backlinks';
import { loadStyles } from './theme';
import { startMcpServer } from './mcp';
import { ensureConfig, getEditorPath } from './config';
import { buildTitleMap } from './utils.js';
import type { RouteContext, RouteHandler } from './routes/types';
import { handleStatic } from './routes/static';
import { handleFileApi, handleOrderApi, handleMoveApi, handleRenameApi, handleDuplicateApi } from './routes/file-api';
import { handleUpload } from './routes/upload';
import { handleGitStatus, handleCommit } from './routes/git';
import { handleOAuthRedirect, handleOAuthCallback } from './routes/oauth';
import { handleFetchMeta } from './routes/fetch-meta';
import { handleNav } from './routes/nav';
import { handlePage } from './routes/page';
import { handlePageAsset } from './routes/page-asset';

// Editor bundle cache — built once at startup, invalidated on client file changes
let editorBundleJs: string | null = null;
let editorBundleCss: string | null = null;

// Viewer bundle cache — built once at startup
let viewerBundleJs: string | null = null;
let viewerHtml: string | null = null;

// Ordered list of route handlers — first match wins
const routeHandlers: RouteHandler[] = [
  handleNav,
  handlePage,
  handleStatic,
  handleFileApi,
  handleOrderApi,
  handleMoveApi,
  handleRenameApi,
  handleDuplicateApi,
  handleUpload,
  handlePageAsset,
  handleGitStatus,
  handleCommit,
  handleOAuthRedirect,
  handleOAuthCallback,
  handleFetchMeta,
];

export async function startServer(rootDir: string, port: number = 3000) {
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
  let styles = await loadStyles();
  let navTree = await walkDir(rootDir);
  let backlinks = await buildBacklinks(rootDir);
  let titleMap = new Map<string, string>();

  // Init titleMap
  const initPages = await getAllPages(rootDir);
  titleMap = await buildTitleMap(rootDir, initPages);

  const clientDir = join(dirname(dirname(import.meta.path)), 'client');
  const reloadClients = new Set<ServerResponse>();

  async function rebuildAll(): Promise<void> {
    navTree = await walkDir(rootDir);
    backlinks = await buildBacklinks(rootDir);
    const pages = await getAllPages(rootDir);
    titleMap = await buildTitleMap(rootDir, pages);
  }

  // Watch for markdown file changes using native fs.watch (chokidar v5 is broken with Bun)
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      await rebuildAll();
      for (const client of reloadClients) client.write('data: reload\n\n');
    }, 80);
  }

  try {
    fsWatch(rootDir, { recursive: true }, (_, filename) => {
      if (!filename) return;
      if (filename.includes('node_modules') || filename.includes('.opendoc')) return;
      // Rebuild on .md changes and order.json changes
      const isMarkdown = extname(filename) === '.md';
      const isOrder = filename.endsWith('order.json');
      if (!isMarkdown && !isOrder) return;
      if (isMarkdown && (filename.endsWith('context.md') || filename.endsWith('context-mini.md'))) return;
      scheduleRebuild();
    });
  } catch (err) {
    console.warn('File watcher unavailable:', err);
  }

  // Build route context — shared state for all handlers
  const routeContext: RouteContext = {
    rootDir,
    projectRoot: dirname(dirname(import.meta.path)),
    config,
    editorPath,
    clientDir,
    port,
    getEditorBundleJs: () => editorBundleJs,
    setEditorBundleJs: (js: string) => { editorBundleJs = js },
    getEditorBundleCss: () => editorBundleCss,
    setEditorBundleCss: (css: string) => { editorBundleCss = css },
    getViewerBundleJs: () => viewerBundleJs,
    setViewerBundleJs: (js: string) => { viewerBundleJs = js },
    getViewerHtml: () => viewerHtml,
    setViewerHtml: (html: string) => { viewerHtml = html },
    getStyles: () => styles,
    getNavTree: () => navTree,
    getBacklinks: () => backlinks,
    getTitleMap: () => titleMap,
    reloadClients,
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    // Try each route handler in order
    for (const handler of routeHandlers) {
      if (await handler(req, res, url, routeContext)) return;
    }

    // Fallback: serve viewer SPA shell for all doc routes
    if (viewerHtml) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(viewerHtml);
    } else {
      res.writeHead(503, { 'Content-Type': 'text/html' });
      res.end('<h1>Viewer not ready</h1>');
    }
  });

  // Load viewer HTML shell
  viewerHtml = await readFile(join(dirname(dirname(import.meta.path)), 'themes', 'default', 'viewer.html'), 'utf-8');

  // Build viewer bundle before accepting requests
  const viewerResult = await Bun.build({
    entrypoints: [join(clientDir, 'viewer.tsx')],
    target: 'browser',
    minify: false,
  })
  if (!viewerResult.success) {
    console.error('Viewer bundle build failed:\n' + viewerResult.logs.join('\n'))
  } else {
    for (const out of viewerResult.outputs) {
      if (out.kind === 'entry-point') viewerBundleJs = await out.text()
    }
  }

  // Build editor bundle before accepting requests
  if (editorPath !== null) {
    Bun.spawnSync(
      ['bunx', 'tailwindcss', '-i', join(clientDir, 'globals.css'), '-o', join(clientDir, 'globals.gen.css'), '--minify'],
      { cwd: dirname(clientDir) },
    )
    const result = await Bun.build({
      entrypoints: [join(clientDir, 'editor.tsx')],
      target: 'browser',
      minify: false,
    })
    if (!result.success) {
      console.error('Editor bundle build failed:\n' + result.logs.join('\n'))
    } else {
      for (const out of result.outputs) {
        if (out.kind === 'entry-point') editorBundleJs = await out.text()
        else if (out.path.endsWith('.css')) editorBundleCss = await out.text()
      }
    }
  }

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  OpenDoc running at ${url}\n`);
    const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    Bun.spawn([open, url], { stderr: 'ignore' });
  });

  await startMcpServer(rootDir);

  return server;
}
