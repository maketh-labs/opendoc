/**
 * End-to-end tests: real server, real browser. See setup.ts for prerequisites.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { readFile, rm, stat } from 'fs/promises';
import { join } from 'path';
import type { Browser, Page } from 'playwright';
import { startTestServer, stopTestServer, launchBrowser, serveStatic, type TestServer } from './setup';
import { build } from '../../src/builder';

let server: TestServer;
let browser: Browser;

beforeAll(async () => {
  server = await startTestServer();
  browser = await launchBrowser();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  if (server) await stopTestServer(server);
});

async function open(path: string, base = server.url): Promise<Page> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  (page as Page & { errors: string[] }).errors = errors;
  // Not 'networkidle': the dev viewer holds a live-reload connection open
  await page.goto(base + path, { waitUntil: 'load' });
  await page.locator('article h1, .bn-editor').first().waitFor({ timeout: 20_000 });
  return page;
}

const pageErrors = (page: Page) => (page as Page & { errors: string[] }).errors;

describe('viewer', () => {
  test('home page shows the root index.md and the sidebar links home first', async () => {
    const page = await open('/');
    await expect(page.locator('article h1').first().innerText()).resolves.toBe('My Test Docs');
    const links = await page.locator('nav.od-nav a').allInnerTexts();
    expect(links[0]).toContain('My Test Docs');
    expect(links.join(' ')).toContain('Getting Started');
    expect(pageErrors(page)).toEqual([]);
    await page.close();
  }, 30_000);

  test('sidebar navigation is client-side and highlights the active page', async () => {
    const page = await open('/');
    await page.locator('nav.od-nav a', { hasText: 'Getting Started' }).click();
    await page.waitForURL('**/getting-started');
    await expect(page.locator('article h1').first().innerText()).resolves.toBe('Getting Started');
    await expect(page.locator('nav.od-nav a.active').innerText()).resolves.toContain('Getting Started');
    await page.locator('nav.od-nav a', { hasText: 'My Test Docs' }).click();
    await page.waitForURL(u => new URL(u).pathname === '/');
    await page.close();
  }, 30_000);

  test('full-text search finds body text and navigates on Enter', async () => {
    const page = await open('/');
    await page.keyboard.press('/');
    await page.keyboard.type('carefully');
    const first = page.locator('.od-search-result').first();
    await first.waitFor();
    await expect(first.innerText()).resolves.toContain('Getting Started');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/getting-started');
    await page.close();
  }, 30_000);
});

describe('local editor', () => {
  test('edits autosave to disk without losing the rest of the page', async () => {
    const page = await open('/_/getting-started');
    const editor = page.locator('.bn-editor[contenteditable="true"]').first();
    await editor.waitFor({ timeout: 20_000 });
    await editor.locator('p', { hasText: 'This guide helps you' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Added by e2e.');

    const file = join(server.docsDir, 'getting-started', 'index.md');
    let content = '';
    for (let i = 0; i < 40 && !content.includes('Added by e2e.'); i++) {
      await Bun.sleep(250);
      content = await readFile(file, 'utf-8');
    }
    expect(content).toContain('Added by e2e.');
    expect(content).toContain('title: Getting Started');
    expect(content).toContain('npm install opendoc');
    expect(pageErrors(page)).toEqual([]);
    await page.close();
  }, 60_000);

  test('the home page (root index.md) is reachable from the sidebar and editable', async () => {
    const page = await open('/_/getting-started');
    await page.locator('[data-page-path="."] a').click();
    await page.waitForURL(/\/_$/);
    const editor = page.locator('.bn-editor[contenteditable="true"]').first();
    await editor.locator('p', { hasText: 'Welcome to the test documentation site' }).click({ timeout: 20_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(' Home edit.');

    const file = join(server.docsDir, 'index.md');
    let content = '';
    for (let i = 0; i < 40 && !content.includes('Home edit.'); i++) {
      await Bun.sleep(250);
      content = await readFile(file, 'utf-8');
    }
    expect(content).toContain('Home edit.');
    expect(content).toContain('title: My Test Docs');

    // The bare editor URL opens the home page, not site settings
    await page.reload();
    await page.locator('.bn-editor', { hasText: 'Home edit.' }).first().waitFor({ timeout: 20_000 });

    // Site settings live at /__, reached from the header
    await page.getByRole('button', { name: 'Site settings' }).click();
    await page.waitForURL(/\/__$/);
    await page.reload();
    await page.getByRole('button', { name: 'Site settings', pressed: true }).waitFor({ timeout: 20_000 });
    expect(pageErrors(page)).toEqual([]);
    await page.close();
  }, 60_000);
});

describe('page operations in the editor', () => {
  const exists = (rel: string) => stat(join(server.docsDir, rel)).then(() => true, () => false);
  const sidebarItem = (page: Page, path: string) => page.locator(`[data-page-path="${path}"]`).first();

  async function until(check: () => Promise<boolean>, what: string): Promise<void> {
    for (let i = 0; i < 40; i++) {
      if (await check()) return;
      await Bun.sleep(100);
    }
    throw new Error(`Timed out waiting for: ${what}`);
  }

  test('delete can be undone from the toast, restoring the page and its order', async () => {
    const orderBefore = JSON.parse(await readFile(join(server.docsDir, 'order.json'), 'utf-8'));
    const page = await open('/_/getting-started');
    await sidebarItem(page, 'api-reference').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await until(async () => !(await exists('api-reference')), 'page deleted');

    await page.getByRole('button', { name: 'Undo' }).click();
    await until(() => exists('api-reference/index.md'), 'page restored');
    expect(JSON.parse(await readFile(join(server.docsDir, 'order.json'), 'utf-8'))).toEqual(orderBefore);
    await sidebarItem(page, 'api-reference').waitFor();
    expect(pageErrors(page)).toEqual([]);
    await page.close();
  }, 60_000);

  test('rename can be undone from the toast', async () => {
    const page = await open('/_/getting-started');
    await sidebarItem(page, 'api-reference').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const input = page.getByLabel('Rename page');
    await input.fill('api-docs');
    await input.press('Enter');
    await until(() => exists('api-docs/index.md'), 'page renamed');
    expect(await exists('api-reference')).toBe(false);

    await page.getByRole('button', { name: 'Undo' }).click();
    await until(() => exists('api-reference/index.md'), 'rename undone');
    expect(await exists('api-docs')).toBe(false);
    expect(pageErrors(page)).toEqual([]);
    await page.close();
  }, 60_000);
});

describe('static build', () => {
  test('works on a plain static host, including search', async () => {
    await build(server.docsDir);
    const site = serveStatic(join(server.docsDir, 'dist'));
    try {
      const page = await open('/getting-started/', site.url);
      await expect(page.locator('article h1').first().innerText()).resolves.toBe('Getting Started');
      await page.locator('nav.od-nav a', { hasText: 'My Test Docs' }).click();
      await page.waitForURL(u => new URL(u).pathname === '/');
      await page.locator('article h1', { hasText: 'My Test Docs' }).waitFor();
      await page.keyboard.press('/');
      await page.keyboard.type('Installation');
      await page.locator('.od-search-result').first().waitFor();
      expect(pageErrors(page)).toEqual([]);
      await page.close();
    } finally {
      site.stop();
      await rm(join(server.docsDir, 'dist'), { recursive: true, force: true });
    }
  }, 120_000);
});
