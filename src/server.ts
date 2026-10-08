import { extname } from 'path';
import { watch as fsWatch } from 'fs';
import { createServer } from 'http';
import type { ServerResponse } from 'http';
import { walkDir, getAllPages } from './walker';
import { buildBacklinks } from './backlinks';
import { loadStyles } from './theme';
import { startMcpServer } from './mcp';
import { ensureConfig, getEditorPath } from './config';
import { buildTitleMap } from './utils.js';
import { loadClientBundles, themeFiles } from './assets';
import { HttpError, isTrustedLocalRequest } from './security';
import { DEFAULT_HOST, listenWithFallback, displayUrl } from './listen';
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

/** Read-only /_opendoc endpoints the public viewer (and OAuth) need. Everything else is the local editing API. */
function isPublicEndpoint(method: string, pathname: string): boolean {
  if (pathname.startsWith('/_opendoc/auth/')) return true;
  if (method !== 'GET' && method !== 'HEAD') return false;
  return pathname === '/_opendoc/page' || pathname === '/_opendoc/page.json' ||
    pathname.startsWith('/_opendoc/page/') ||
    pathname === '/_opendoc/nav.json' || pathname === '/_opendoc/config.json' ||
    pathname === '/_opendoc/theme.css' || pathname.startsWith('/_opendoc/assets/') ||
    pathname === '/_opendoc/viewer.js' || pathname === '/_opendoc/editor.js' || pathname === '/_opendoc/editor.css';
}

export interface ServeOptions {
  port?: number;
  host?: string;
  mcpPort?: number;
  open?: boolean;
}

export async function startServer(rootDir: string, opts: ServeOptions = {}) {
  const host = opts.host ?? DEFAULT_HOST;
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
  const styles = await loadStyles();
  let navTree = await walkDir(rootDir);
  let backlinks = await buildBacklinks(rootDir);
  let titleMap = await buildTitleMap(rootDir, await getAllPages(rootDir));

  const reloadClients = new Set<ServerResponse>();

  async function rebuildAll(): Promise<void> {
    navTree = await walkDir(rootDir);
    backlinks = await buildBacklinks(rootDir);
    titleMap = await buildTitleMap(rootDir, await getAllPages(rootDir));
  }

  // Watch for markdown file changes using native fs.watch (chokidar v5 is broken with Bun)
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      try {
        await rebuildAll();
      } catch (err) {
        console.warn('Rebuild failed:', err);
      }
      for (const client of reloadClients) client.write('data: reload\n\n');
    }, 80);
  }

  try {
    fsWatch(rootDir, { recursive: true }, (_, filename) => {
      if (!filename) return;
      const normalized = filename.replace(/\\/g, '/');
      if (normalized.includes('node_modules') || normalized.startsWith('dist/') || normalized.startsWith('.git/')) return;
      const isMarkdown = extname(normalized) === '.md';
      const isOrder = normalized.endsWith('order.json');
      if (!isMarkdown && !isOrder) return;
      if (isMarkdown && (normalized.endsWith('context.md') || normalized.endsWith('context-mini.md'))) return;
      scheduleRebuild();
    });
  } catch (err) {
    console.warn('File watcher unavailable:', err);
  }

  // Keep SSE connections alive through proxies and idle timeouts
  const heartbeat = setInterval(() => {
    for (const client of reloadClients) client.write(': ping\n\n');
  }, 30_000);
  heartbeat.unref();

  const bundles = await loadClientBundles({ editor: editorPath !== null });

  const routeContext: RouteContext = {
    rootDir,
    config,
    editorPath,
    port: opts.port ?? 3000,
    bundles,
    getStyles: () => styles,
    getNavTree: () => navTree,
    getBacklinks: () => backlinks,
    getTitleMap: () => titleMap,
    reloadClients,
  };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      // The editing API reads and writes the docs folder and runs git: only this machine may use it
      if (url.pathname.startsWith('/_opendoc/') && !isPublicEndpoint(req.method ?? 'GET', url.pathname) && !isTrustedLocalRequest(req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: the editing API is only available from localhost');
        return;
      }

      for (const handler of routeHandlers) {
        if (await handler(req, res, url, routeContext)) return;
      }

      // Fallback: serve viewer SPA shell for all doc routes
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(themeFiles.viewerHtml);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('Request failed:', err);
      if (!res.headersSent) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof HttpError ? err.message : 'Internal server error' }));
      } else {
        res.end();
      }
    }
  });

  const actualPort = await listenWithFallback(server, opts.port ?? 3000, host);
  routeContext.port = actualPort;
  const url = displayUrl(host, actualPort);
  console.log(`\n  OpenDoc running at ${url}\n`);
  if (host !== DEFAULT_HOST && host !== 'localhost') {
    console.log(`  Listening on ${host}. The editing API stays restricted to requests from localhost.\n`);
  }
  if (opts.open !== false) {
    const opener = process.platform === 'darwin' ? ['open'] : process.platform === 'win32' ? ['cmd', '/c', 'start', ''] : ['xdg-open'];
    try { Bun.spawn([...opener, url], { stdout: 'ignore', stderr: 'ignore' }); } catch {}
  }

  await startMcpServer(rootDir, { port: opts.mcpPort ?? config.mcp?.port ?? 3001, host });

  return server;
}
