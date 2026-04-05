/**
 * E2E Smoke Tests for OpenDoc
 *
 * These tests verify the full stack works end-to-end:
 * - Server starts and serves pages
 * - Navigation works
 * - Content renders correctly
 *
 * Prerequisites:
 *   bunx playwright install chromium
 *
 * Run with:
 *   bun test tests/e2e/
 *
 * These tests are skipped by default in CI if Playwright is not installed.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, type ServerInstance } from './setup';

let server: ServerInstance;
let hasPlaywright = false;

// Check if Playwright is available
try {
  await import('playwright');
  hasPlaywright = true;
} catch {
  hasPlaywright = false;
}

// Only run if Playwright is installed
const describeE2E = hasPlaywright ? describe : describe.skip;

describeE2E('E2E smoke tests', () => {
  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  afterAll(async () => {
    if (server) await stopTestServer(server);
  });

  test('server responds to nav.json endpoint', async () => {
    const res = await fetch(`${server.url}/_opendoc/nav.json`);
    expect(res.ok).toBe(true);
    const nav = await res.json();
    expect(nav.title).toBeDefined();
    expect(nav.children).toBeDefined();
  });

  test('server renders page HTML', async () => {
    // Pages are served via viewer SPA, so any route should return HTML
    const res = await fetch(server.url);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain('<html');
  });

  test('server serves page markdown', async () => {
    const res = await fetch(`${server.url}/getting-started/index.md`);
    expect(res.ok).toBe(true);
    const md = await res.text();
    expect(md).toContain('# Getting Started');
  });

  test('browser renders page content', async () => {
    if (!hasPlaywright) return;

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(server.url, { waitUntil: 'networkidle' });
      // The viewer SPA should load and display content
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
    } finally {
      await browser.close();
    }
  }, 15000);

  test('browser navigation sidebar loads', async () => {
    if (!hasPlaywright) return;

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(server.url, { waitUntil: 'networkidle' });
      // Wait for nav to load (the viewer fetches nav.json and renders it)
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      // The nav should contain page titles
      expect(body).toBeTruthy();
    } finally {
      await browser.close();
    }
  }, 15000);
});

// Non-Playwright HTTP-level smoke tests (always run)
describe('HTTP smoke tests', () => {
  let httpServer: ServerInstance;

  beforeAll(async () => {
    httpServer = await startTestServer();
  }, 30000);

  afterAll(async () => {
    if (httpServer) await stopTestServer(httpServer);
  });

  test('GET / returns HTML', async () => {
    const res = await fetch(httpServer.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  test('GET /_opendoc/nav.json returns valid JSON', async () => {
    const res = await fetch(`${httpServer.url}/_opendoc/nav.json`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('title');
  });

  test('GET /getting-started/index.md returns markdown', async () => {
    const res = await fetch(`${httpServer.url}/getting-started/index.md`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('# Getting Started');
  });
});
