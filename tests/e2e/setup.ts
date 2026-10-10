/**
 * E2E helpers: a real OpenDoc server (client bundles built from source) plus a Playwright browser.
 *
 *   bunx playwright install chromium   # once
 *   bun test tests/e2e
 *
 * Set PLAYWRIGHT_CHANNEL=chrome to use an installed Chrome instead of Playwright's Chromium.
 */
import { mkdtemp, cp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Browser } from 'playwright';
import { startServer, type RunningServer } from '../../src/server';

const SAMPLE_DOCS = join(import.meta.dir, '..', 'fixtures', 'sample-docs');

export interface TestServer {
  app: RunningServer;
  url: string;
  docsDir: string;
}

export async function startTestServer(): Promise<TestServer> {
  const docsDir = await mkdtemp(join(tmpdir(), 'opendoc-e2e-'));
  await cp(SAMPLE_DOCS, docsDir, { recursive: true });
  const app = await startServer(docsDir, { port: 0, mcpPort: 0, open: false, quiet: true });
  return { app, url: `http://localhost:${app.server.port}`, docsDir };
}

export async function stopTestServer(server: TestServer): Promise<void> {
  await server.app.stop();
  await rm(server.docsDir, { recursive: true, force: true });
}

export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
}

/** Serve a directory as a plain static site (no OpenDoc server), like GitHub Pages would. */
export function serveStatic(root: string): { url: string; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname);
      for (const candidate of [path, join(path, 'index.html')]) {
        if (candidate.endsWith('/')) continue;
        const file = Bun.file(join(root, candidate));
        if (await file.exists()) return new Response(file);
      }
      const notFound = Bun.file(join(root, '404.html'));
      return new Response(await notFound.exists() ? notFound : 'Not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
}
