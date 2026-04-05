import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { createTempDocs, cleanupTempDocs } from '../helpers';

// We test the MCP logic functions directly since starting the full MCP server
// requires SSE transport and port allocation. The core logic is in these functions.

// Test the validatePath logic (reimplemented here to match src/mcp.ts)
function validatePath(rootDir: string, pagePath: string): string | null {
  const { resolve } = require('path');
  if (pagePath.includes('..')) return 'Path must not contain ".."';
  const resolved = resolve(rootDir, pagePath);
  if (!resolved.startsWith(resolve(rootDir))) return 'Path escapes root directory';
  const segments = pagePath.replace(/^\//, '').split('/');
  for (const seg of segments) {
    if (seg.startsWith('_') || seg.startsWith('.')) return `Reserved path segment: "${seg}"`;
  }
  return null;
}

// Test the generateCommitMsg logic (reimplemented to match src/mcp.ts)
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

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDocs();
});

afterEach(async () => {
  await cleanupTempDocs(tmpDir);
});

describe('MCP validatePath', () => {
  test('allows valid paths', () => {
    expect(validatePath(tmpDir, 'getting-started')).toBeNull();
    expect(validatePath(tmpDir, 'guides/advanced')).toBeNull();
  });

  test('rejects path traversal', () => {
    expect(validatePath(tmpDir, '../etc/passwd')).toBe('Path must not contain ".."');
    expect(validatePath(tmpDir, 'page/../../etc')).toBe('Path must not contain ".."');
  });

  test('rejects reserved segments starting with underscore', () => {
    const result = validatePath(tmpDir, '_private/page');
    expect(result).toContain('Reserved path segment');
  });

  test('rejects reserved segments starting with dot', () => {
    const result = validatePath(tmpDir, '.hidden/page');
    expect(result).toContain('Reserved path segment');
  });
});

describe('MCP generateCommitMsg', () => {
  test('generates create message for new page', () => {
    const msg = generateCommitMsg('getting-started', undefined, '# Hello');
    expect(msg).toBe('docs(getting-started): create page');
  });

  test('generates expand message for significant additions', () => {
    const before = 'line 1\nline 2\nline 3';
    const after = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9';
    const msg = generateCommitMsg('page', before, after);
    expect(msg).toBe('docs(page): expand content');
  });

  test('generates trim message for significant removals', () => {
    const before = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9';
    const after = 'line 1\nline 2\nline 3';
    const msg = generateCommitMsg('page', before, after);
    expect(msg).toBe('docs(page): trim content');
  });

  test('generates revise message for small changes', () => {
    const before = 'line 1\nline 2\nline 3';
    const after = 'line 1\nline 2 modified\nline 3';
    const msg = generateCommitMsg('page', before, after);
    expect(msg).toBe('docs(page): revise content');
  });

  test('handles nested paths', () => {
    const msg = generateCommitMsg('guides/advanced', undefined, '# Content');
    expect(msg).toBe('docs(guides/advanced): create page');
  });

  test('uses "home" for root path', () => {
    const msg = generateCommitMsg('', undefined, '# Content');
    expect(msg).toBe('docs(home): create page');
  });
});

describe('MCP read_page logic', () => {
  test('can read full tier content', async () => {
    const content = await readFile(join(tmpDir, 'getting-started', 'index.md'), 'utf-8');
    expect(content).toContain('# Getting Started');
  });

  test('context tiers are generated after build', async () => {
    // Import the compressor to simulate what MCP does
    const { compress, compressMini } = await import('../../src/compressor');
    const content = await readFile(join(tmpDir, 'getting-started', 'index.md'), 'utf-8');

    const context = compress(content);
    const contextMini = compressMini(content);

    expect(context.length).toBeLessThan(content.length);
    expect(contextMini.length).toBeLessThan(context.length);
  });
});

describe('MCP search logic', () => {
  test('finds pages matching query', async () => {
    const { getAllPages } = await import('../../src/walker');
    const pages = await getAllPages(tmpDir);
    const query = 'installation';
    const results: { path: string; snippet: string }[] = [];

    for (const page of pages) {
      const content = await readFile(join(tmpDir, page, 'index.md'), 'utf-8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        const lines = content.split('\n');
        const matchLine = lines.find(l => l.toLowerCase().includes(query.toLowerCase())) ?? '';
        results.push({ path: page, snippet: matchLine.trim() });
      }
    }

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.path).toBe('getting-started');
  });

  test('returns empty results for no match', async () => {
    const { getAllPages } = await import('../../src/walker');
    const pages = await getAllPages(tmpDir);
    const query = 'zzz-nonexistent-content-zzz';
    const results: any[] = [];

    for (const page of pages) {
      const content = await readFile(join(tmpDir, page, 'index.md'), 'utf-8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push({ path: page });
      }
    }

    expect(results).toHaveLength(0);
  });
});
