import { extname } from 'path';
import { watch as fsWatch } from 'fs';
import type { Server } from 'bun';
import { loadStyles } from './theme';
import { startMcpServer } from './mcp';
import { ensureConfig, getEditorPath } from './config';
import { loadClientBundles, themeFiles, type ClientBundles } from './assets';
import { DocsIndex } from './docs-index';
import { ReloadHub } from './reload';
import { purgeExpiredTrash } from './trash';
import { HttpError, isTrustedLocalRequest, MAX_BODY_BYTES } from './security';
import { DEFAULT_HOST, serveWithFallback, displayUrl } from './listen';
import type { RouteContext, RouteHandler } from './routes/types';
import { handleStatic } from './routes/static';
import { handleFileApi, handleOrderApi, handleMoveApi, handleRenameApi, handleDuplicateApi, handleRestoreApi } from './routes/file-api';
import { handleUpload } from './routes/upload';
import { handleGitStatus, handleCommit } from './routes/git';
import { handleOAuthRedirect, handleOAuthCallback } from './routes/oauth';
import { handleFetchMeta } from './routes/fetch-meta';
import { handleNav } from './routes/nav';
import { handlePage } from './routes/page';
import { handlePageAsset } from './routes/page-asset';

// Ordered list of route handlers — first non-null response wins
const routeHandlers: RouteHandler[] = [
  handleNav,
  handlePage,
  handleStatic,
  handleFileApi,
  handleOrderApi,
  handleMoveApi,
  handleRenameApi,
  handleDuplicateApi,
  handleRestoreApi,
  handleUpload,
  handlePageAsset,
  handleGitStatus,
  handleCommit,
  handleOAuthRedirect,
  handleOAuthCallback,
  handleFetchMeta,
];

const PUBLIC_GET_PATHS = new Set([
  '/_opendoc/page', '/_opendoc/page.json', '/_opendoc/nav.json', '/_opendoc/config.json',
  '/_opendoc/search-index.json', '/_opendoc/theme.css',
]);

/** Read-only /_opendoc endpoints the public viewer (and OAuth) need. Everything else is the local editing API. */
export function isPublicEndpoint(method: string, pathname: string): boolean {
  if (pathname.startsWith('/_opendoc/auth/')) return true;
  if (method !== 'GET' && method !== 'HEAD') return false;
  return PUBLIC_GET_PATHS.has(pathname) ||
    pathname.startsWith('/_opendoc/page/') ||
    pathname.startsWith('/_opendoc/assets/') ||
    /^\/_opendoc\/[\w.-]+\.(js|css)$/.test(pathname);
}

export interface ServeOptions {
  port?: number;
  host?: string;
  mcpPort?: number;
  open?: boolean;
  /** Prebuilt bundles (tests pass a stub to skip the client build) */
  bundles?: ClientBundles;
  quiet?: boolean;
}

export interface RunningServer {
  server: Server<undefined>;
  mcp: Server<undefined>;
  url: string;
  stop(): Promise<void>;
}

export async function startServer(rootDir: string, opts: ServeOptions = {}): Promise<RunningServer> {
  const host = opts.host ?? DEFAULT_HOST;
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
  const index = new DocsIndex(rootDir);
  await index.refresh();
  await purgeExpiredTrash(rootDir);

  const reload = new ReloadHub();

  // Watch for markdown/order changes (including edits from other tools) and refresh incrementally
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      try {
        await index.refresh();
      } catch (err) {
        console.warn('Index refresh failed:', err);
      }
      reload.reload();
    }, 80);
  }

  let watcher: ReturnType<typeof fsWatch> | null = null;
  try {
    watcher = fsWatch(rootDir, { recursive: true }, (_, filename) => {
      if (!filename) return;
      const normalized = filename.replace(/\\/g, '/');
      if (normalized.includes('node_modules') || /^(dist|\.git|\.opendoc)\//.test(normalized)) return;
      const isMarkdown = extname(normalized) === '.md';
      const isOrder = normalized.endsWith('order.json');
      // Folder add/remove/rename events carry the folder name (no extension)
      const isDir = extname(normalized) === '';
      if (!isMarkdown && !isOrder && !isDir) return;
      if (normalized.endsWith('context.md') || normalized.endsWith('context-mini.md')) return;
      scheduleRebuild();
    });
  } catch (err) {
    console.warn('File watcher unavailable:', err);
  }

  const ctx: RouteContext = {
    rootDir,
    config,
    editorPath,
    port: opts.port ?? 3000,
    bundles: opts.bundles ?? await loadClientBundles({ editor: editorPath !== null }),
    styles: await loadStyles(),
    index,
    reload,
  };

  async function handle(req: Request, server: Server<undefined>): Promise<Response> {
    const url = new URL(req.url);

    // The editing API reads and writes the docs folder and runs git: only this machine may use it
    if (url.pathname.startsWith('/_opendoc/') && !isPublicEndpoint(req.method, url.pathname) &&
        !isTrustedLocalRequest(req, server.requestIP(req)?.address)) {
      return new Response('Forbidden: the editing API is only available from localhost', { status: 403 });
    }

    for (const handler of routeHandlers) {
      const res = await handler(req, url, ctx);
      if (!res) continue;
      // Editing requests change the tree: refresh before replying so the next nav.json is current
      if (req.method !== 'GET' && req.method !== 'HEAD' && url.pathname.startsWith('/_opendoc/') && res.ok) {
        await index.refresh();
      }
      return res;
    }

    // Fallback: viewer SPA shell for all doc routes
    return new Response(themeFiles.viewerHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const server = serveWithFallback({
    maxRequestBodySize: MAX_BODY_BYTES,
    idleTimeout: 60,
    async fetch(req, server) {
      try {
        return await handle(req, server as Server<undefined>);
      } catch (err) {
        if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
        console.error('Request failed:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  }, opts.port ?? 3000, host);

  ctx.port = server.port!;
  const url = displayUrl(host, server.port!);
  if (!opts.quiet) console.log(`\n  OpenDoc running at ${url}\n`);
  if (!opts.quiet && host !== DEFAULT_HOST && host !== 'localhost') {
    console.log(`  Listening on ${host}. The editing API stays restricted to requests from localhost.\n`);
  }
  if (opts.open !== false) {
    const opener = process.platform === 'darwin' ? ['open'] : process.platform === 'win32' ? ['cmd', '/c', 'start', ''] : ['xdg-open'];
    try { Bun.spawn([...opener, url], { stdout: 'ignore', stderr: 'ignore' }); } catch {}
  }

  const mcp = await startMcpServer(rootDir, { port: opts.mcpPort ?? config.mcp?.port ?? 3001, host, index, quiet: opts.quiet });

  return {
    server,
    mcp,
    url,
    async stop() {
      watcher?.close();
      reload.close();
      await Promise.all([server.stop(true), mcp.stop(true)]);
    },
  };
}
