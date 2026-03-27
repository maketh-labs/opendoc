import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { walkDir, getAllPages } from './walker';
import { buildBacklinks } from './backlinks';
import simpleGit from 'simple-git';
import type { ContextTier, SearchResult } from './types';

export async function startMcpServer(rootDir: string, port: number = 3001) {
  const server = new McpServer({
    name: 'opendoc',
    version: '0.1.0',
  });

  const git = simpleGit(rootDir);

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

  httpServer.listen(port, () => {
    console.log(`MCP server running on http://localhost:${port}`);
  });

  return httpServer;
}
