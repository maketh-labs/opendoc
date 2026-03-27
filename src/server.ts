import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { createServer } from 'http';
import type { ServerResponse } from 'http';
import { watch } from 'chokidar';
import { walkDir, getAllPages } from './walker';
import { renderFull } from './renderer';
import { buildBacklinks } from './backlinks';
import { loadTemplate, loadStyles, renderTemplate } from './theme';
import { startMcpServer } from './mcp';
import { tocToHtml } from './plugins/toc';
import type { NavNode, BacklinksIndex } from './types';

function navToHtml(node: NavNode, currentPath: string = ''): string {
  if (!node) return '';
  const active = node.path === currentPath ? ' class="active"' : '';
  const iconSpan = node.icon ? `<span class="od-nav-icon">${node.icon}</span> ` : '';
  let html = `<li><a href="${node.url}"${active}>${iconSpan}${escapeHtml(node.title)}</a>`;
  if (node.children && node.children.length > 0) {
    html += '<ul>' + node.children.map(c => navToHtml(c, currentPath)).join('') + '</ul>';
  }
  html += '</li>';
  return html;
}

function backlinksToHtml(links: string[]): string {
  if (!links || links.length === 0) return '';
  const items = links.map(l => {
    const url = l === '.' ? '/' : `/${l}`;
    const name = l === '.' ? 'Home' : l.split('/').pop()!.replace(/-/g, ' ');
    return `<li><a href="${url}">${escapeHtml(name)}</a></li>`;
  }).join('');
  return `<aside class="od-backlinks"><h4>Referenced by</h4><ul>${items}</ul></aside>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// In-memory page cache
const cache = new Map<string, string>();

async function buildPage(
  rootDir: string,
  page: string,
  template: string,
  navHtml: string,
  backlinks: BacklinksIndex,
): Promise<string> {
  const indexPath = join(rootDir, page, 'index.md');
  const markdown = await readFile(indexPath, 'utf-8');
  const { html: content, toc, frontmatter } = await renderFull(markdown);
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = (frontmatter.title as string) || (titleMatch ? titleMatch[1]!.trim() : 'OpenDoc');
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

export async function startServer(rootDir: string, port: number = 3000) {
  let template = await loadTemplate();
  let styles = await loadStyles();
  let navTree = await walkDir(rootDir);
  let backlinks = await buildBacklinks(rootDir);
  let navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';

  // Build client JS bundle
  const clientDir = join(dirname(dirname(import.meta.path)), 'client');

  // SSE clients for hot reload
  const reloadClients = new Set<ServerResponse>();

  async function rebuildAll(): Promise<void> {
    navTree = await walkDir(rootDir);
    backlinks = await buildBacklinks(rootDir);
    navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';
    cache.clear();
  }

  // Watch for changes
  const watcher = watch(join(rootDir, '**/*.md'), {
    ignored: [/node_modules/, /\.opendoc/, /context\.md$/, /context-mini\.md$/],
  });

  watcher.on('change', async () => {
    await rebuildAll();
    for (const client of reloadClients) {
      client.write('data: reload\n\n');
    }
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    const pathname = url.pathname;

    // Serve theme CSS
    if (pathname === '/_opendoc/theme.css') {
      res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-cache' });
      res.end(styles);
      return;
    }

    // Serve client JS — bundle app.ts + themes.ts on the fly
    if (pathname === '/_opendoc/app.js') {
      try {
        const result = await Bun.build({
          entrypoints: [join(clientDir, 'app.ts')],
          target: 'browser',
          minify: false,
        });
        const js = await result.outputs[0]!.text();
        // Append hot reload script
        const hotReload = `\n// Hot reload\nconst es = new EventSource('/__reload');\nes.onmessage = () => location.reload();\n`;
        res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' });
        res.end(js + hotReload);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Build error: ${err}`);
      }
      return;
    }

    // Editor route
    if (pathname === '/editor' || pathname === '/editor/') {
      const editorPath = join(dirname(dirname(import.meta.path)), 'themes', 'default', 'editor.html');
      try {
        const editorHtml = await readFile(editorPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(editorHtml);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>Editor not found</h1>');
      }
      return;
    }

    // Serve client/editor.ts for the editor
    if (pathname === '/client/editor.ts') {
      const clientPath = join(clientDir, 'editor.ts');
      try {
        const clientCode = await readFile(clientPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(clientCode);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // Serve assets from page directories
    if (pathname.includes('/assets/')) {
      const filePath = join(rootDir, pathname.replace(/^\//, ''));
      try {
        const data = await Bun.file(filePath).arrayBuffer();
        const ext = pathname.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
          pdf: 'application/pdf',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream' });
        res.end(Buffer.from(data));
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // Serve dist files (for editor to load page markdown)
    if (pathname.startsWith('/dist/')) {
      const distPath = join(rootDir, '.opendoc', pathname.slice(1));
      try {
        const content = await readFile(distPath, 'utf-8');
        const ext = pathname.split('.').pop();
        const contentType = ext === 'json' ? 'application/json' : 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // SSE endpoint for hot reload
    if (pathname === '/__reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      reloadClients.add(res);
      req.on('close', () => reloadClients.delete(res));
      return;
    }

    // Resolve page path
    const pagePath = pathname === '/' ? '.' : pathname.replace(/^\//, '').replace(/\/$/, '');

    // Check if this is a valid page
    const pages = await getAllPages(rootDir);
    if (!pages.includes(pagePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Page not found</h1>');
      return;
    }

    try {
      if (!cache.has(pagePath)) {
        const html = await buildPage(rootDir, pagePath, template, navHtml, backlinks);
        cache.set(pagePath, html);
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(cache.get(pagePath));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><pre>${escapeHtml(String(err))}</pre>`);
    }
  });

  server.listen(port, () => {
    console.log(`OpenDoc dev server running on http://localhost:${port}`);
  });

  // Start MCP server in parallel
  await startMcpServer(rootDir);

  return server;
}
