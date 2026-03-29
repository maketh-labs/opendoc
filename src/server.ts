import { readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { watch as fsWatch } from 'fs';
import { createServer } from 'http';
import type { ServerResponse } from 'http';
import { walkDir, getAllPages } from './walker';
import { renderFull } from './renderer';
import { buildBacklinks } from './backlinks';
import { loadTemplate, loadStyles, renderTemplate } from './theme';
import { startMcpServer } from './mcp';
import { tocToHtml } from './plugins/toc';
import { ensureConfig, getEditorPath } from './config';
import { escapeHtml, extractTitle, buildTitleMap } from './utils.js';
import { navToHtml, backlinksToHtml } from './render-utils.js';
import type { BacklinksIndex } from './types';
import type { RouteContext, RouteHandler } from './routes/types';
import { handleStatic } from './routes/static';
import { handleFileApi } from './routes/file-api';
import { handleUpload } from './routes/upload';
import { handleGitStatus, handleCommit } from './routes/git';
import { handleOAuthRedirect, handleOAuthCallback } from './routes/oauth';
import { handleFetchMeta } from './routes/fetch-meta';
import { handleNav } from './routes/nav';

// In-memory page cache
const cache = new Map<string, string>();

// Editor bundle cache — built once at startup, invalidated on client file changes
let editorBundleJs: string | null = null;
let editorBundleCss: string | null = null;

async function buildPage(
  rootDir: string,
  page: string,
  template: string,
  navHtml: string,
  backlinks: BacklinksIndex,
  titleMap: Map<string, string>,
): Promise<string> {
  const indexPath = join(rootDir, page, 'index.md');
  const markdown = await readFile(indexPath, 'utf-8');
  const currentPath = page === '.' ? 'index.md' : `${page}/index.md`;
  const { html: content, toc, frontmatter } = await renderFull(markdown, { titleMap, currentPath });
  const title = extractTitle(markdown, 'OpenDoc');
  const icon = (frontmatter.icon as string) || '';

  const normalized = page === '.' ? '' : page;
  const pageBacklinks = backlinks[normalized] || [];

  return renderTemplate(template, {
    title,
    siteTitle: 'OpenDoc',
    content,
    nav: navHtml,
    backlinks: backlinksToHtml(pageBacklinks),
    toc: tocToHtml(toc),
    icon,
    pageTitle: title,
  });
}

// Ordered list of route handlers — first match wins
const routeHandlers: RouteHandler[] = [
  handleNav,
  handleStatic,
  handleFileApi,
  handleUpload,
  handleGitStatus,
  handleCommit,
  handleOAuthRedirect,
  handleOAuthCallback,
  handleFetchMeta,
];

export async function startServer(rootDir: string, port: number = 3000) {
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
  let template = await loadTemplate();
  let styles = await loadStyles();
  let navTree = await walkDir(rootDir);
  let backlinks = await buildBacklinks(rootDir);
  let navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';
  let titleMap = new Map<string, string>();

  // Init titleMap
  const initPages = await getAllPages(rootDir);
  titleMap = await buildTitleMap(rootDir, initPages);

  // Inflight dedup map
  const pageBuilding = new Map<string, Promise<string>>();

  const clientDir = join(dirname(dirname(import.meta.path)), 'client');
  const reloadClients = new Set<ServerResponse>();

  async function rebuildAll(): Promise<void> {
    navTree = await walkDir(rootDir);
    backlinks = await buildBacklinks(rootDir);
    navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';
    const pages = await getAllPages(rootDir);
    titleMap = await buildTitleMap(rootDir, pages);
    cache.clear();
    pageBuilding.clear();
    editorBundleJs = null;
    editorBundleCss = null;
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
      if (extname(filename) !== '.md') return;
      if (filename.includes('node_modules') || filename.includes('.opendoc')) return;
      if (filename.endsWith('context.md') || filename.endsWith('context-mini.md')) return;
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
    getStyles: () => styles,
    getNavTree: () => navTree,
    reloadClients,
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    // Try each route handler in order
    for (const handler of routeHandlers) {
      if (await handler(req, res, url, routeContext)) return;
    }

    // Fallback: serve pages from the doc root
    const pathname = url.pathname;
    const pagePath = pathname === '/' ? '.' : pathname.replace(/^\//, '').replace(/\/$/, '');

    const pages = await getAllPages(rootDir);
    if (!pages.includes(pagePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Page not found</h1>');
      return;
    }

    if (!cache.has(pagePath)) {
      if (!pageBuilding.has(pagePath)) {
        const p = buildPage(rootDir, pagePath, template, navHtml, backlinks, titleMap)
          .then(html => { cache.set(pagePath, html); pageBuilding.delete(pagePath); return html; })
          .catch(err => { pageBuilding.delete(pagePath); throw err; });
        pageBuilding.set(pagePath, p);
      }
      try { await pageBuilding.get(pagePath); } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><pre>${escapeHtml(String(err))}</pre>`);
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(cache.get(pagePath));
  });

  // Build editor bundle before accepting requests
  if (editorPath !== null) {
    Bun.spawnSync(
      ['bunx', 'tailwindcss', '-i', join(clientDir, 'globals.css'), '-o', join(clientDir, 'globals.gen.css'), '--minify'],
      { cwd: routeContext.projectRoot },
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
