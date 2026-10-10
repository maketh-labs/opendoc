import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Server } from 'bun';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, relative } from 'path';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { compress, compressMini } from './compressor';
import { resolveInRoot, isLoopbackHostname } from './security';
import { DEFAULT_HOST, serveWithFallback, displayUrl } from './listen';
import { DocsIndex } from './docs-index';
import type { ContextTier } from './types';

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
export function createMcpServer(rootDir: string, index: DocsIndex = new DocsIndex(rootDir)): McpServer {
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
      await index.refresh();
      return text(JSON.stringify(index.search(query, limit), null, 2));
    }
  );

  server.tool('list_structure', 'Get the full navigation tree as JSON', {}, async () => {
    await index.refresh();
    return text(JSON.stringify(index.getNavTree(), null, 2));
  });

  server.tool(
    'get_backlinks',
    'Get pages that link to the specified page',
    { path: z.string().describe('Page path') },
    async ({ path: pagePath }) => {
      await index.refresh();
      const normalized = pagePath.replace(/^\//, '').replace(/\/$/, '');
      return text(JSON.stringify(index.getBacklinks()[normalized] || [], null, 2));
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

      await index.refresh();
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
      await index.refresh();

      const committed = await commitPage(v.rel, `docs(${v.rel || 'home'}): create page`);
      return text(JSON.stringify({ path: v.rel, created: true, committed }));
    }
  );

  return server;
}

/**
 * MCP endpoints write to the docs and run git, so only local clients may connect:
 * Host must be a loopback name (blocks DNS rebinding) and a browser's Origin must be local too.
 */
function isAllowedMcpRequest(req: Request, host: string): boolean {
  const bindIsLoopback = host === DEFAULT_HOST || host === 'localhost' || host === '::1';
  try {
    const hostHeader = req.headers.get('host');
    if (!hostHeader) return false;
    if (bindIsLoopback && !isLoopbackHostname(new URL(`http://${hostHeader}`).hostname)) return false;
    const origin = req.headers.get('origin');
    if (origin && !isLoopbackHostname(new URL(origin).hostname)) return false;
  } catch {
    return false;
  }
  return true;
}

export interface McpServeOptions {
  port?: number;
  host?: string;
  /** Shared docs index (the docs server passes its own so both stay in sync) */
  index?: DocsIndex;
  quiet?: boolean;
}

/** Serve MCP over Streamable HTTP at /mcp (stateless: a fresh server + transport per request). */
export async function startMcpServer(rootDir: string, opts: McpServeOptions = {}): Promise<Server<undefined>> {
  const host = opts.host ?? DEFAULT_HOST;
  const index = opts.index ?? new DocsIndex(rootDir);
  if (!opts.index) await index.refresh();

  const server = serveWithFallback({
    async fetch(req) {
      if (!isAllowedMcpRequest(req, host)) return new Response('Forbidden', { status: 403 });
      const url = new URL(req.url);
      if (url.pathname !== '/mcp' && url.pathname !== '/') return new Response('Not found', { status: 404 });
      if (url.pathname === '/' && req.method === 'GET') {
        return new Response('OpenDoc MCP server — connect your client to /mcp', { headers: { 'Content-Type': 'text/plain' } });
      }
      try {
        const mcp = createMcpServer(rootDir, index);
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        await mcp.connect(transport);
        return await transport.handleRequest(req);
      } catch (err) {
        console.error('MCP request failed:', err);
        return new Response('Error processing message', { status: 500 });
      }
    },
  }, opts.port ?? 3001, host);

  if (!opts.quiet) console.log(`  MCP server running at ${displayUrl(host, server.port!, '/mcp')}\n`);
  return server;
}
