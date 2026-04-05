import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { access, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { build } from '../../src/builder';
import { createTempDocs, cleanupTempDocs } from '../helpers';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDocs();
});

afterEach(async () => {
  await cleanupTempDocs(tmpDir);
});

describe('build', () => {
  test('creates dist directory', async () => {
    await build(tmpDir);
    const distDir = join(tmpDir, 'dist');
    // access resolves with undefined or null on success — just check it doesn't reject
    const accessResult = await access(distDir);
    expect(accessResult === undefined || accessResult === null).toBe(true);
  });

  test('generates index.html for each page', async () => {
    await build(tmpDir);
    const distDir = join(tmpDir, 'dist');

    // Check getting-started page
    const gsHtml = await readFile(join(distDir, 'getting-started', 'index.html'), 'utf-8');
    expect(gsHtml).toContain('Getting Started');
    expect(gsHtml).toContain('<html');

    // Check api-reference page
    const apiHtml = await readFile(join(distDir, 'api-reference', 'index.html'), 'utf-8');
    expect(apiHtml).toContain('API Reference');
  });

  test('copies raw markdown to dist', async () => {
    await build(tmpDir);
    const md = await readFile(join(tmpDir, 'dist', 'getting-started', 'index.md'), 'utf-8');
    expect(md).toContain('# Getting Started');
  });

  test('generates context.md for each page', async () => {
    await build(tmpDir);
    const contextMd = await readFile(join(tmpDir, 'getting-started', 'context.md'), 'utf-8');
    expect(contextMd).toContain('Getting Started');
    // Should be compressed — paragraphs reduced
    expect(contextMd.length).toBeLessThan(
      (await readFile(join(tmpDir, 'getting-started', 'index.md'), 'utf-8')).length
    );
  });

  test('generates context-mini.md for each page', async () => {
    await build(tmpDir);
    const miniMd = await readFile(join(tmpDir, 'getting-started', 'context-mini.md'), 'utf-8');
    expect(miniMd).toContain('Getting Started');
    // Mini should be shorter than context
    const contextMd = await readFile(join(tmpDir, 'getting-started', 'context.md'), 'utf-8');
    expect(miniMd.length).toBeLessThanOrEqual(contextMd.length);
  });

  test('generates nav.json in _opendoc/', async () => {
    await build(tmpDir);
    const navJson = await readFile(join(tmpDir, 'dist', '_opendoc', 'nav.json'), 'utf-8');
    const nav = JSON.parse(navJson);
    expect(nav.title).toBe('My Test Docs');
    expect(nav.children.length).toBeGreaterThan(0);
  });

  test('generates backlinks.json in _opendoc/', async () => {
    await build(tmpDir);
    const backlinksJson = await readFile(join(tmpDir, 'dist', '_opendoc', 'backlinks.json'), 'utf-8');
    const backlinks = JSON.parse(backlinksJson);
    expect(typeof backlinks).toBe('object');
  });

  test('generates theme.css in _opendoc/', async () => {
    await build(tmpDir);
    const css = await readFile(join(tmpDir, 'dist', '_opendoc', 'theme.css'), 'utf-8');
    expect(css.length).toBeGreaterThan(0);
  });

  test('generates config.json in _opendoc/', async () => {
    await build(tmpDir);
    const configJson = await readFile(join(tmpDir, 'dist', '_opendoc', 'config.json'), 'utf-8');
    const config = JSON.parse(configJson);
    expect(config.editorPath).toBeDefined();
  });

  test('copies assets directories to dist', async () => {
    await build(tmpDir);
    // getting-started/assets/screenshot.png should be in dist
    const result = await access(join(tmpDir, 'dist', 'getting-started', 'assets', 'screenshot.png'));
    expect(result === undefined || result === null).toBe(true);
  });

  test('renders wikilinks correctly in built output', async () => {
    await build(tmpDir);
    const gsHtml = await readFile(join(tmpDir, 'dist', 'getting-started', 'index.html'), 'utf-8');
    expect(gsHtml).toContain('href="/api-reference"');
  });

  test('renders callouts in built output', async () => {
    await build(tmpDir);
    const gsHtml = await readFile(join(tmpDir, 'dist', 'getting-started', 'index.html'), 'utf-8');
    expect(gsHtml).toContain('od-callout');
  });
});
