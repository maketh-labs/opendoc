import { readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { createServer } from 'http';
import type { ServerResponse, IncomingMessage } from 'http';
import { watch } from 'chokidar';
import { walkDir, getAllPages } from './walker';
import { renderFull } from './renderer';
import { buildBacklinks } from './backlinks';
import { loadTemplate, loadStyles, renderTemplate } from './theme';
import { startMcpServer } from './mcp';
import { tocToHtml } from './plugins/toc';
import { ensureConfig, getEditorPath } from './config';
import type { NavNode, BacklinksIndex } from './types';
import simpleGit from 'simple-git';

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
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
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

    // Serve config.json
    if (pathname === '/_opendoc/config.json') {
      const { clientSecret: _s, ...publicGithub } = config.github || {};
      const publicConfig = {
        title: config.title,
        editorPath: editorPath ?? '/editor',
        github: config.github ? publicGithub : undefined,
        theme: config.theme,
      };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(publicConfig));
      return;
    }

    // Nav JSON endpoint for editor page picker
    if (pathname === '/_opendoc/nav.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(navTree));
      return;
    }

    // File upload for editor (images, etc.)
    if (pathname === '/_opendoc/upload' && req.method === 'POST') {
      const body = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        (req as IncomingMessage).on('data', (chunk: Buffer) => { chunks.push(chunk); });
        (req as IncomingMessage).on('end', () => resolve(Buffer.concat(chunks)));
      });

      // Parse multipart form data manually
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing boundary');
        return;
      }

      const boundary = boundaryMatch[1]!;
      const parts = body.toString('binary').split(`--${boundary}`);
      let fileData: Buffer | null = null;
      let fileName = 'upload';
      let pagePath = '.';

      for (const part of parts) {
        if (part.includes('name="file"')) {
          const filenameMatch = part.match(/filename="([^"]+)"/);
          if (filenameMatch) fileName = filenameMatch[1]!;
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            const raw = part.slice(headerEnd + 4).replace(/\r\n$/, '');
            fileData = Buffer.from(raw, 'binary');
          }
        } else if (part.includes('name="pagePath"')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            pagePath = part.slice(headerEnd + 4).replace(/\r\n$/, '').trim();
          }
        }
      }

      if (!fileData) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('No file');
        return;
      }

      const { mkdir } = await import('fs/promises');
      const assetsDir = join(rootDir, pagePath === '.' ? '' : pagePath, 'assets');
      await mkdir(assetsDir, { recursive: true });

      const safeName = `${Date.now()}-${fileName.replace(/[^a-z0-9.-]/gi, '_')}`;
      const filePath = join(assetsDir, safeName);
      await Bun.write(filePath, fileData);

      const urlPath = pagePath === '.' ? `/assets/${safeName}` : `/${pagePath}/assets/${safeName}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: urlPath }));
      return;
    }

    // File API for local editing
    if (pathname === '/_opendoc/file') {
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing path');
        return;
      }

      // Security: ensure path stays within rootDir
      const fullPath = resolve(rootDir, filePath);
      if (!fullPath.startsWith(resolve(rootDir) + '/') && fullPath !== resolve(rootDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      if (req.method === 'GET') {
        try {
          const content = await Bun.file(fullPath).text();
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(content);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
        return;
      }

      if (req.method === 'PUT') {
        const body = await new Promise<string>((resolve) => {
          let data = '';
          (req as IncomingMessage).on('data', (chunk: Buffer) => { data += chunk.toString(); });
          (req as IncomingMessage).on('end', () => resolve(data));
        });
        const { content } = JSON.parse(body);
        await Bun.write(fullPath, content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
    }

    // Git status endpoint
    if (pathname === '/_opendoc/git-status' && req.method === 'GET') {
      try {
        const git = simpleGit(rootDir);
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ isRepo: false }));
          return;
        }
        const status = await git.status();
        const remotes = await git.getRemotes(true);
        const log = await git.log({ maxCount: 1 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          isRepo: true,
          branch: status.current,
          remote: remotes.find(r => r.name === 'origin')?.refs?.push || null,
          changes: status.files.length,
          lastCommit: log.latest ? {
            hash: log.latest.hash.slice(0, 7),
            message: log.latest.message,
            date: log.latest.date,
          } : null,
        }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ isRepo: false, error: String(e) }));
      }
      return;
    }

    // Commit & push endpoint
    if (pathname === '/_opendoc/commit' && req.method === 'POST') {
      const body = await new Promise<string>((resolve) => {
        let data = '';
        (req as IncomingMessage).on('data', (chunk: Buffer) => { data += chunk.toString(); });
        (req as IncomingMessage).on('end', () => resolve(data));
      });
      const { message, token } = JSON.parse(body) as { message?: string; token?: string };

      try {
        const git = simpleGit(rootDir);
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Not a git repository. Run git init first.' }));
          return;
        }

        const status = await git.status();
        if (status.files.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'No changes to commit.' }));
          return;
        }

        await git.add('.');
        const commitMessage = message || `docs: update ${new Date().toISOString()}`;
        const commitResult = await git.commit(commitMessage);

        let pushed = false;
        let pushError = '';

        try {
          if (token) {
            const remotes = await git.getRemotes(true);
            const origin = remotes.find(r => r.name === 'origin');
            if (origin?.refs?.push) {
              const cleanUrl = origin.refs.push;
              const authedUrl = cleanUrl.startsWith('https://')
                ? cleanUrl.replace('https://', `https://${token}@`)
                : cleanUrl;
              await git.remote(['set-url', 'origin', authedUrl]);
              try {
                await git.push();
                pushed = true;
              } finally {
                await git.remote(['set-url', 'origin', cleanUrl]);
              }
            }
          } else {
            await git.push();
            pushed = true;
          }
        } catch (e) {
          pushError = e instanceof Error ? e.message : String(e);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          committed: true,
          pushed,
          pushError: pushed ? undefined : pushError,
          hash: commitResult.commit,
          message: commitMessage,
          files: status.files.length,
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
      return;
    }

    // GitHub OAuth: redirect to authorize
    if (pathname === '/_opendoc/auth/github' && req.method === 'GET') {
      const clientId = process.env.GITHUB_CLIENT_ID || config.github?.clientId;
      if (!clientId) {
        res.writeHead(501, { 'Content-Type': 'text/plain' });
        res.end('GITHUB_CLIENT_ID not configured. See README.');
        return;
      }
      const origin = req.headers.host ? `http://${req.headers.host}` : `http://localhost:${port}`;
      const redirectUri = `${origin}/_opendoc/auth/callback`;
      const ghUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
      res.writeHead(302, { Location: ghUrl });
      res.end();
      return;
    }

    // GitHub OAuth: callback — exchange code for token
    if (pathname === '/_opendoc/auth/callback' && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const clientId = process.env.GITHUB_CLIENT_ID || config.github?.clientId;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || config.github?.clientSecret;

      if (!code || !clientId || !clientSecret) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing code or credentials');
        return;
      }

      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
        });
        const { access_token } = await tokenRes.json() as { access_token: string };
        const editorTarget = editorPath ?? '/editor';
        res.writeHead(302, { Location: `${editorTarget}#github_token=${access_token}` });
        res.end();
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`OAuth error: ${e}`);
      }
      return;
    }

    // Editor route
    if (editorPath !== null && (pathname === editorPath || pathname === editorPath + '/')) {
      const editorFilePath = join(dirname(dirname(import.meta.path)), 'themes', 'default', 'editor.html');
      try {
        const editorHtml = await readFile(editorFilePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(editorHtml);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>Editor not found</h1>');
      }
      return;
    }

    // Serve client/editor.tsx for the editor (bundled)
    if (pathname === '/client/editor.tsx' || pathname === '/client/editor.ts') {
      try {
        const result = await Bun.build({
          entrypoints: [join(clientDir, 'editor.tsx')],
          target: 'browser',
          minify: false,
        });
        const js = await result.outputs[0]!.text();
        res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' });
        res.end(js);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Build error: ${err}`);
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
    const url = `http://localhost:${port}`;
    console.log(`\n  OpenDoc running at ${url}\n`);
    // Auto-open browser
    const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    Bun.spawn([open, url], { stderr: 'ignore' });
  });

  // Start MCP server in parallel
  await startMcpServer(rootDir);

  return server;
}
