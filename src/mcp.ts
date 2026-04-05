import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from 'http';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { z } from 'zod';
import { walkDir, getAllPages } from './walker';
import { buildBacklinks } from './backlinks';
import { compress, compressMini } from './compressor';
import simpleGit from 'simple-git';
import type { ContextTier, SearchResult } from './types';

export async function startMcpServer(rootDir: string, port: number = 3001) {
  const server = new McpServer({
    name: 'opendoc',
    version: '0.1.0',
  });

  const git = simpleGit(rootDir, { config: ['--no-optional-locks'] });

  function validatePath(pagePath: string): string | null {
    if (pagePath.includes('..')) return 'Path must not contain ".."';
    const resolved = resolve(rootDir, pagePath);
    if (!resolved.startsWith(resolve(rootDir))) return 'Path escapes root directory';
    const segments = pagePath.replace(/^\//, '').split('/');
    for (const seg of segments) {
      if (seg.startsWith('_') || seg.startsWith('.')) return `Reserved path segment: "${seg}"`;
    }
    return null;
  }

  async function isGitRepo(): Promise<boolean> {
    try {
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async function rebuildContext(pagePath: string): Promise<void> {
    const indexPath = join(rootDir, pagePath, 'index.md');
    try {
      const markdown = await readFile(indexPath, 'utf-8');
      await writeFile(join(rootDir, pagePath, 'context.md'), compress(markdown));
      await writeFile(join(rootDir, pagePath, 'context-mini.md'), compressMini(markdown));
    } catch { /* skip if file missing */ }
  }

  function generateCommitMsg(pagePath: string, before: string | undefined, after: string): string {
    const parts = pagePath.replace(/^\//, '').split('/');
    const section = parts.filter(p => p).join('/') || 'home';
    let description = 'update';
    if (before != null) {
      const beforeLines = before.split('\n').length;
      const afterLines = after.split('\n').length;
      if (afterLines > beforeLines + 5) description = 'expand content';
      else if (beforeLines > afterLines + 5) description = 'trim content';
      else if (before !== after) description = 'revise content';
    } else {
      description = 'create page';
    }
    return `docs(${section}): ${description}`;
  }

  const fileMap: Record<ContextTier, string> = {
    full: 'index.md',
    context: 'context.md',
    'context-mini': 'context-mini.md',
  };

  server.tool(
    'read_page',
    'Read a documentation page at the specified tier',
    {
      path: z.string().describe('Page path relative to root (e.g. "getting-started")'),
      tier: z.enum(['full', 'context', 'context-mini']).default('full').describe('Content tier'),
    },
    async ({ path: pagePath, tier }) => {
      const filePath = join(rootDir, pagePath, fileMap[tier]);
      try {
        const content = await readFile(filePath, 'utf-8');
        return { content: [{ type: 'text' as const, text: content }] };
      } catch {
        return { content: [{ type: 'text' as const, text: `Page not found: ${pagePath} (tier: ${tier})` }], isError: true };
      }
    }
  );

  server.tool(
    'search',
    'Search documentation pages',
    {
      query: z.string().describe('Search query'),
      limit: z.number().default(10).describe('Max results'),
    },
    async ({ query, limit }) => {
      const pages = await getAllPages(rootDir);
      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      for (const page of pages) {
        const filePath = join(rootDir, page, 'index.md');
        try {
          const content = await readFile(filePath, 'utf-8');
          if (content.toLowerCase().includes(queryLower)) {
            const lines = content.split('\n');
            const matchLine = lines.find(l => l.toLowerCase().includes(queryLower)) ?? lines[0] ?? '';
            results.push({ path: page, snippet: matchLine.trim() });
            if (results.length >= limit) break;
          }
        } catch { /* skip */ }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    'list_structure',
    'Get the full navigation tree as JSON',
    {},
    async () => {
      const tree = await walkDir(rootDir);
      return { content: [{ type: 'text' as const, text: JSON.stringify(tree, null, 2) }] };
    }
  );

  server.tool(
    'get_backlinks',
    'Get pages that link to the specified page',
    {
      path: z.string().describe('Page path'),
    },
    async ({ path: pagePath }) => {
      const index = await buildBacklinks(rootDir);
      const normalized = pagePath.replace(/^\//, '').replace(/\/$/, '');
      const links = index[normalized] || [];
      return { content: [{ type: 'text' as const, text: JSON.stringify(links, null, 2) }] };
    }
  );

  server.tool(
    'get_changelog',
    'Get git log for a specific page',
    {
      path: z.string().describe('Page path'),
      limit: z.number().default(10).describe('Max entries'),
    },
    async ({ path: pagePath, limit }) => {
      try {
        const filePath = join(pagePath, 'index.md');
        const log = await git.log({ file: filePath, maxCount: limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(log.all, null, 2) }] };
      } catch {
        return { content: [{ type: 'text' as const, text: '[]' }] };
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
      // Extract section name from path
      const parts = filePath.replace(/\/index\.md$/, '').replace(/^\//, '').split('/');
      const section = parts.filter(p => p && p !== 'index.md').join('/') || 'home';

      let description = 'update';
      if (before != null && after != null) {
        const beforeLines = before.split('\n').length;
        const afterLines = after.split('\n').length;
        if (afterLines > beforeLines + 5) {
          description = 'expand content';
        } else if (beforeLines > afterLines + 5) {
          description = 'trim content';
        } else if (before !== after) {
          description = 'revise content';
        }
      }

      const message = `docs(${section}): ${description}`;
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message }) }] };
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
      const err = validatePath(pagePath);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err }) }], isError: true };

      const dirPath = join(rootDir, pagePath);
      const filePath = join(dirPath, 'index.md');

      let before: string | undefined;
      try {
        before = await readFile(filePath, 'utf-8');
      } catch { /* new file */ }

      await mkdir(dirPath, { recursive: true });
      await writeFile(filePath, content);

      await rebuildContext(pagePath);

      let committed = false;
      let message = '';
      if (await isGitRepo()) {
        message = generateCommitMsg(pagePath, before, content);
        const commitMsg = `${message}\n\nCo-Authored-By: opendoc-mcp <mcp@opendoc.sh>`;
        await git.add([
          join(pagePath, 'index.md'),
          join(pagePath, 'context.md'),
          join(pagePath, 'context-mini.md'),
        ]);
        await git.commit(commitMsg);
        committed = true;
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: pagePath, committed, message }) }] };
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
      const err = validatePath(pagePath);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err }) }], isError: true };

      const dirPath = join(rootDir, pagePath);
      const filePath = join(dirPath, 'index.md');

      try {
        await access(filePath);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Page already exists: ${pagePath}` }) }], isError: true };
      } catch { /* good — file doesn't exist */ }

      const pageName = title || pagePath.split('/').filter(Boolean).pop() || 'Untitled';
      const content = `# ${pageName}\n`;

      await mkdir(dirPath, { recursive: true });
      await writeFile(filePath, content);

      await rebuildContext(pagePath);

      let committed = false;
      if (await isGitRepo()) {
        const message = `docs(${pagePath.replace(/^\//, '') || 'home'}): create page\n\nCo-Authored-By: opendoc-mcp <mcp@opendoc.sh>`;
        await git.add([
          join(pagePath, 'index.md'),
          join(pagePath, 'context.md'),
          join(pagePath, 'context-mini.md'),
        ]);
        await git.commit(message);
        committed = true;
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: pagePath, created: true, committed }) }] };
    }
  );

  // Set up HTTP server with SSE transport
  const httpServer = createServer();
  const transports = new Map<string, SSEServerTransport>();

  httpServer.on('request', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/sse' && req.method === 'GET') {
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      await server.connect(transport);
    } else if (req.url?.startsWith('/messages') && req.method === 'POST') {
      const url = new URL(req.url, `http://localhost:${port}`);
      const sessionId = url.searchParams.get('sessionId');
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (transport) {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; });
        req.on('end', async () => {
          try {
            await transport.handlePostMessage(req, res, body);
          } catch {
            res.writeHead(500);
            res.end('Error processing message');
          }
        });
      } else {
        res.writeHead(404);
        res.end('Session not found');
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const { findAvailablePort } = await import('./server');
  const actualPort = await findAvailablePort(port);
  httpServer.listen(actualPort, () => {
    console.log(`MCP server running on http://localhost:${actualPort}`);
  });

  return httpServer;
}
