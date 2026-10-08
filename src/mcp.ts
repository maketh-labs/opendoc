import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import type { IncomingMessage } from 'http';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, relative } from 'path';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { walkDir, getAllPages } from './walker';
import { buildBacklinks } from './backlinks';
import { compress, compressMini } from './compressor';
import { resolveInRoot, readBody, HttpError } from './security';
import { DEFAULT_HOST, listenWithFallback, displayUrl } from './listen';
import type { ContextTier, SearchResult } from './types';

/**
 * Validate a page path from an MCP client and resolve it inside rootDir.
 * Returns `{ dir, rel }` or `{ error }`. Writes additionally reject `_`-prefixed segments (reserved).
 */
export async function validatePagePath(
  rootDir: string,
  pagePath: string,
  { write = false } = {},
): Promise<{ dir: string; rel: string } | { error: string }> {
  const segments = pagePath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (segments.includes('..')) return { error: 'Path must not contain ".."' };
  for (const seg of segments) {
    if (seg.startsWith('.') || (write && seg.startsWith('_'))) return { error: `Reserved path segment: "${seg}"` };
  }
  const dir = await resolveInRoot(rootDir, segments.join('/') || '.');
  if (!dir) return { error: 'Path escapes root directory' };
  return { dir, rel: relative(rootDir, dir).split(/[\\/]/).join('/') };
}

export function generateCommitMsg(pagePath: string, before: string | undefined, after: string): string {
  const section = pagePath.replace(/\/index\.md$/, '').split('/').filter(p => p && p !== 'index.md').join('/') || 'home';
  let description = 'update';
  if (before == null) {
    description = 'create page';
  } else {
    const beforeLines = before.split('\n').length;
    const afterLines = after.split('\n').length;
    if (afterLines > beforeLines + 5) description = 'expand content';
    else if (beforeLines > afterLines + 5) description = 'trim content';
    else if (before !== after) description = 'revise content';
  }
  return `docs(${section}): ${description}`;
}

/** Render a page at the requested tier. Context tiers are derived on the fly — nothing is written to the docs tree. */
export function renderTier(markdown: string, tier: ContextTier): string {
  if (tier === 'context') return compress(markdown);
  if (tier === 'context-mini') return compressMini(markdown);
  return markdown;
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const errorResult = (message: string) => ({ ...text(JSON.stringify({ error: message })), isError: true });

/** Build an MCP server with all OpenDoc tools. One instance per client session. */
export function createMcpServer(rootDir: string): McpServer {
  const server = new McpServer({ name: 'opendoc', version: '0.1.0' });
  const git = simpleGit(rootDir, { config: ['--no-optional-locks'] });

  async function isGitRepo(): Promise<boolean> {
    try { return await git.checkIsRepo(); } catch { return false; }
  }

  async function commitPage(rel: string, message: string): Promise<boolean> {
    if (!(await isGitRepo())) return false;
    await git.add([join(rel || '.', 'index.md')]);
    await git.commit(`${message}\n\nCo-Authored-By: opendoc-mcp <mcp@opendoc.sh>`);
    return true;
  }

  server.tool(
    'read_page',
    'Read a documentation page at the specified tier',
    {
      path: z.string().describe('Page path relative to root (e.g. "getting-started"); "" for the home page'),
      tier: z.enum(['full', 'context', 'context-mini']).default('full').describe('Content tier'),
    },
    async ({ path: pagePath, tier }) => {
      const v = await validatePagePath(rootDir, pagePath);
      if ('error' in v) return errorResult(v.error);
      try {
        const markdown = await readFile(join(v.dir, 'index.md'), 'utf-8');
        return text(renderTier(markdown, tier));
      } catch {
        return errorResult(`Page not found: ${pagePath}`);
      }
    }
  );

  server.tool(
    'search',
    'Search documentation pages',
    {
      query: z.string().describe('Search query'),
      limit: z.number().int().min(1).max(100).default(10).describe('Max results'),
    },
    async ({ query, limit }) => {
      const pages = await getAllPages(rootDir);
      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      for (const page of ['.', ...pages]) {
        try {
          const content = await readFile(join(rootDir, page, 'index.md'), 'utf-8');
          if (content.toLowerCase().includes(queryLower)) {
            const lines = content.split('\n');
            const matchLine = lines.find(l => l.toLowerCase().includes(queryLower)) ?? lines[0] ?? '';
            results.push({ path: page === '.' ? '' : page, snippet: matchLine.trim() });
            if (results.length >= limit) break;
          }
        } catch { /* skip */ }
      }
      return text(JSON.stringify(results, null, 2));
    }
  );

  server.tool('list_structure', 'Get the full navigation tree as JSON', {}, async () => {
    return text(JSON.stringify(await walkDir(rootDir), null, 2));
  });

  server.tool(
    'get_backlinks',
    'Get pages that link to the specified page',
    { path: z.string().describe('Page path') },
    async ({ path: pagePath }) => {
      const index = await buildBacklinks(rootDir);
      const normalized = pagePath.replace(/^\//, '').replace(/\/$/, '');
      return text(JSON.stringify(index[normalized] || [], null, 2));
    }
  );

  server.tool(
    'get_changelog',
    'Get git log for a specific page',
    {
      path: z.string().describe('Page path'),
      limit: z.number().int().min(1).max(100).default(10).describe('Max entries'),
    },
    async ({ path: pagePath, limit }) => {
      const v = await validatePagePath(rootDir, pagePath);
      if ('error' in v) return errorResult(v.error);
      try {
        const log = await git.log({ file: join(v.rel || '.', 'index.md'), maxCount: limit });
        return text(JSON.stringify(log.all, null, 2));
      } catch {
        return text('[]');
      }
    }
  );

  server.tool(
    'generate_commit_message',
    'Generate a conventional commit message for a docs edit',
    {
      path: z.string().describe('File path being edited (e.g. "getting-started/index.md")'),
      before: z.string().optional().describe('Content before edit'),
      after: z.string().optional().describe('Content after edit'),
    },
    async ({ path: filePath, before, after }) => {
      // Without both versions the size of the change is unknown — call it an update
      const message = before != null && after != null
        ? generateCommitMsg(filePath, before, after)
        : generateCommitMsg(filePath, '', '');
      return text(JSON.stringify({ message }));
    }
  );

  server.tool(
    'write_page',
    'Create or update a documentation page at the given path',
    {
      path: z.string().describe('Page path relative to root (e.g. "getting-started")'),
      content: z.string().describe('Markdown content for the page'),
    },
    async ({ path: pagePath, content }) => {
      const v = await validatePagePath(rootDir, pagePath, { write: true });
      if ('error' in v) return errorResult(v.error);
      const filePath = join(v.dir, 'index.md');

      let before: string | undefined;
      try { before = await readFile(filePath, 'utf-8'); } catch { /* new file */ }

      await mkdir(v.dir, { recursive: true });
      await writeFile(filePath, content);

      const message = generateCommitMsg(v.rel, before, content);
      const committed = await commitPage(v.rel, message);
      return text(JSON.stringify({ path: v.rel, committed, message: committed ? message : '' }));
    }
  );

  server.tool(
    'create_page',
    'Scaffold a new documentation page (fails if page already exists)',
    {
      path: z.string().describe('Page path relative to root (e.g. "guides/advanced")'),
      title: z.string().optional().describe('Page title (defaults to folder name)'),
    },
    async ({ path: pagePath, title }) => {
      const v = await validatePagePath(rootDir, pagePath, { write: true });
      if ('error' in v) return errorResult(v.error);
      const filePath = join(v.dir, 'index.md');

      try {
        await access(filePath);
        return errorResult(`Page already exists: ${pagePath}`);
      } catch { /* good — file doesn't exist */ }

      const pageName = title || v.rel.split('/').filter(Boolean).pop() || 'Untitled';
      await mkdir(v.dir, { recursive: true });
      await writeFile(filePath, `# ${pageName}\n`);

      const committed = await commitPage(v.rel, `docs(${v.rel || 'home'}): create page`);
      return text(JSON.stringify({ path: v.rel, created: true, committed }));
    }
  );

  return server;
}

/**
 * MCP endpoints write to the docs and run git, so only local clients may connect:
 * Host must be a loopback name (blocks DNS rebinding) and browsers' Origin must be local too.
 */
function isAllowedMcpRequest(req: IncomingMessage, host: string): boolean {
  const isLoopbackName = (h: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(h) || h.endsWith('.localhost');
  const bindIsLoopback = host === DEFAULT_HOST || host === 'localhost' || host === '::1';
  try {
    const hostHeader = req.headers.host;
    if (!hostHeader) return false;
    if (bindIsLoopback && !isLoopbackName(new URL(`http://${hostHeader}`).hostname)) return false;
    const origin = req.headers.origin;
    if (origin && !isLoopbackName(new URL(origin).hostname)) return false;
  } catch {
    return false;
  }
  return true;
}

export interface McpServeOptions {
  port?: number;
  host?: string;
}

export async function startMcpServer(rootDir: string, opts: McpServeOptions = {}) {
  const host = opts.host ?? DEFAULT_HOST;
  const sseSessions = new Map<string, SSEServerTransport>();
  const httpServer = createServer();

  httpServer.on('request', async (req, res) => {
    try {
      if (!isAllowedMcpRequest(req, host)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      const url = new URL(req.url ?? '/', 'http://localhost');

      // Streamable HTTP (current MCP transport), stateless: a fresh server + transport per request
      if (url.pathname === '/mcp' || url.pathname === '/') {
        if (req.method !== 'POST') {
          res.writeHead(405, { Allow: 'POST', 'Content-Type': 'text/plain' });
          res.end('Method not allowed');
          return;
        }
        let body: unknown;
        try { body = JSON.parse(await readBody(req)); } catch { throw new HttpError(400, 'Invalid JSON'); }
        const server = createMcpServer(rootDir);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => { transport.close(); server.close(); });
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      // Legacy HTTP+SSE transport: one server per SSE session
      if (url.pathname === '/sse' && req.method === 'GET') {
        const transport = new SSEServerTransport('/messages', res);
        const server = createMcpServer(rootDir);
        sseSessions.set(transport.sessionId, transport);
        res.on('close', () => { sseSessions.delete(transport.sessionId); server.close(); });
        await server.connect(transport);
        return;
      }

      if (url.pathname === '/messages' && req.method === 'POST') {
        const transport = sseSessions.get(url.searchParams.get('sessionId') ?? '');
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Session not found');
          return;
        }
        let body: unknown;
        try { body = JSON.parse(await readBody(req)); } catch { throw new HttpError(400, 'Invalid JSON'); }
        await transport.handlePostMessage(req, res, body);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch (err) {
      if (!(err instanceof HttpError)) console.error('MCP request failed:', err);
      if (!res.headersSent) {
        res.writeHead(err instanceof HttpError ? err.status : 500, { 'Content-Type': 'text/plain' });
        res.end(err instanceof HttpError ? err.message : 'Error processing message');
      }
    }
  });

  const actualPort = await listenWithFallback(httpServer, opts.port ?? 3001, host);
  console.log(`  MCP server running at ${displayUrl(host, actualPort, '/mcp')}  (legacy SSE: /sse)\n`);
  return httpServer;
}
