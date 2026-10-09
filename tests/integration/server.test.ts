import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { access, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { startServer, type RunningServer } from '../../src/server';
import { createTempDocs, cleanupTempDocs } from '../helpers';

let tmpDir: string;
let app: RunningServer;
let base: string;
let mcpBase: string;

beforeAll(async () => {
  tmpDir = await createTempDocs();
  app = await startServer(tmpDir, {
    port: 0, mcpPort: 0, open: false, quiet: true,
    bundles: { files: { 'viewer.js': '// viewer', 'editor.js': '// editor', 'chunk-abc.js': '// chunk' } },
  });
  base = `http://127.0.0.1:${app.server.port}`;
  mcpBase = `http://127.0.0.1:${app.mcp.port}`;
});

afterAll(async () => {
  await app.stop();
  await cleanupTempDocs(tmpDir);
});

const put = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const post = (path: string, body: unknown) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const navUrls = async (): Promise<string[]> => {
  const nav = await (await fetch(base + '/_opendoc/nav.json')).json();
  const urls: string[] = [];
  const walk = (n: { url: string; children: unknown[] }) => { urls.push(n.url); n.children.forEach(c => walk(c as typeof n)); };
  walk(nav);
  return urls;
};

describe('public viewer endpoints', () => {
  test('serves the SPA shell and bundles', async () => {
    const html = await (await fetch(base + '/getting-started')).text();
    expect(html).toContain('/_opendoc/viewer.js');
    expect(await (await fetch(base + '/_opendoc/viewer.js')).text()).toBe('// viewer');
    expect(await (await fetch(base + '/_opendoc/chunk-abc.js')).text()).toBe('// chunk');
  });

  test('serves the editor shell at /_, /_/<page> and the /__ settings page', async () => {
    for (const path of ['/_', '/_/getting-started', '/__']) {
      expect(await (await fetch(base + path)).text()).toContain('/_opendoc/editor.js');
    }
  });

  test('serves the root page and child pages as JSON', async () => {
    const root = await (await fetch(base + '/_opendoc/page.json')).json();
    expect(root.html.length).toBeGreaterThan(0);
    const gs = await (await fetch(base + '/_opendoc/page/getting-started.json')).json();
    expect(gs.title).toBe('Getting Started');
  });

  test('serves a full-text search index', async () => {
    const idx = await (await fetch(base + '/_opendoc/search-index.json')).json();
    expect(idx.version).toBe(1);
    const gs = idx.docs.find((d: { id: string }) => d.id === 'getting-started');
    expect(gs.url).toBe('/getting-started');
    expect(gs.text.length).toBeGreaterThan(0);
    expect(idx.docs.some((d: { id: string }) => d.id === '')).toBe(true);
  });
});

describe('editing API access control', () => {
  test('allows same-origin localhost requests', async () => {
    const res = await fetch(base + '/_opendoc/file/index.md');
    expect(res.status).toBe(200);
  });

  test('rejects DNS-rebinding Host headers', async () => {
    const res = await fetch(base + '/_opendoc/file/index.md', { headers: { Host: 'evil.example' } });
    expect(res.status).toBe(403);
  });

  test('rejects cross-origin requests', async () => {
    const res = await put('/_opendoc/file/x/index.md', { content: 'x' }, { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  test('rejects proxied requests', async () => {
    const res = await fetch(base + '/_opendoc/git-status', { headers: { 'X-Forwarded-For': '203.0.113.1' } });
    expect(res.status).toBe(403);
  });

  test('rejects writes into .git and outside the root', async () => {
    expect((await put('/_opendoc/file/.git/hooks/pre-commit', { content: 'x' })).status).toBe(403);
    expect((await put('/_opendoc/file/..%2F..%2Fpwn.txt', { content: 'x' })).status).toBe(403);
  });

  test('rejects upload path traversal', async () => {
    const form = new FormData();
    form.set('file', new File(['x'], 'a.txt'));
    form.set('pagePath', '../../');
    expect((await fetch(base + '/_opendoc/upload', { method: 'POST', body: form })).status).toBe(403);
  });

  test('returns 400 for malformed JSON', async () => {
    const res = await fetch(base + '/_opendoc/file/x/index.md', { method: 'PUT', body: 'not json' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('JSON');
  });
});

describe('page operations', () => {
  test('new pages show up in nav.json immediately', async () => {
    expect((await put('/_opendoc/file/fresh/index.md', { content: '# Fresh\n' })).status).toBe(200);
    expect(await navUrls()).toContain('/fresh');
  });

  test('delete is recoverable via restore, including order position', async () => {
    const orderBefore = JSON.parse(await readFile(join(tmpDir, 'order.json'), 'utf-8'));
    const del = await fetch(base + '/_opendoc/file/api-reference', { method: 'DELETE' });
    const { trashId } = await del.json();
    expect(typeof trashId).toBe('string');
    expect(await navUrls()).not.toContain('/api-reference');

    const restored = await post('/_opendoc/restore', { trashId });
    expect((await restored.json()).path).toBe('api-reference');
    expect(await navUrls()).toContain('/api-reference');
    expect(JSON.parse(await readFile(join(tmpDir, 'order.json'), 'utf-8'))).toEqual(orderBefore);
    // Trash is git-ignored
    await access(join(tmpDir, '.opendoc', '.gitignore'));
  });

  test('restore refuses to overwrite a page that took the old path', async () => {
    const { trashId } = await (await fetch(base + '/_opendoc/file/fresh', { method: 'DELETE' })).json();
    await put('/_opendoc/file/fresh/index.md', { content: '# Replacement\n' });
    expect((await post('/_opendoc/restore', { trashId })).status).toBe(409);
  });

  test('rename and move report conflicts and invalid targets', async () => {
    expect((await put('/_opendoc/rename', { from: 'getting-started', to: 'guides' })).status).toBe(409);
    expect((await put('/_opendoc/move', { from: 'guides', to: 'guides/advanced/guides' })).status).toBe(400);
    expect((await put('/_opendoc/rename', { from: 'missing', to: 'other' })).status).toBe(404);
  });

  test('uploads are served with nosniff', async () => {
    const form = new FormData();
    form.set('file', new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'pic.svg'));
    form.set('pagePath', 'getting-started');
    const { url } = await (await fetch(base + '/_opendoc/upload', { method: 'POST', body: form })).json();
    const res = await fetch(base + url);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
  });

  test('link previews never fetch private addresses', async () => {
    const res = await fetch(base + '/_opendoc/fetch-meta?url=' + encodeURIComponent(base + '/_opendoc/config.json'));
    const meta = await res.json();
    expect(meta.title).toBe('127.0.0.1');
    expect(meta.description).toBe('');
  });
});

describe('MCP server', () => {
  const rpc = (body: unknown, headers: Record<string, string> = {}) => fetch(mcpBase + '/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  });

  test('lists tools over Streamable HTTP', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const { result } = await res.json();
    expect(result.tools.map((t: { name: string }) => t.name)).toContain('read_page');
  });

  test('read_page rejects traversal and serves context tiers', async () => {
    const bad = await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_page', arguments: { path: '../../etc' } } })).json();
    expect(bad.result.isError).toBe(true);
    const ok = await (await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_page', arguments: { path: 'getting-started', tier: 'context' } } })).json();
    expect(ok.result.content[0].text).toContain('Getting Started');
  });

  test('write_page is visible to the docs server index', async () => {
    await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'write_page', arguments: { path: 'from-agent', content: '# From Agent\n' } } });
    expect(await navUrls()).toContain('/from-agent');
    await writeFile(join(tmpDir, 'from-agent', 'index.md'), '# From Agent\n');
  });

  test('rejects rebinding hosts and foreign origins', async () => {
    expect((await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/list' }, { Host: 'evil.example' })).status).toBe(403);
    expect((await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/list' }, { Origin: 'https://evil.example' })).status).toBe(403);
  });
});
