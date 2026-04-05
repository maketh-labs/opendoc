import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { writeFile, mkdir, rm, unlink } from 'fs/promises';
import { join } from 'path';
import { walkDir, getAllPages, resolvePageAssets } from '../../src/walker';
import { createTempDocs, cleanupTempDocs } from '../helpers';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDocs();
});

afterEach(async () => {
  await cleanupTempDocs(tmpDir);
});

describe('walkDir', () => {
  test('returns nav tree for sample docs', async () => {
    const tree = await walkDir(tmpDir);
    expect(tree).not.toBeNull();
    expect(tree!.title).toBe('My Test Docs');
    expect(tree!.path).toBe('.');
    expect(tree!.url).toBe('/');
  });

  test('discovers child pages', async () => {
    const tree = await walkDir(tmpDir);
    expect(tree!.children.length).toBeGreaterThanOrEqual(2);
    const titles = tree!.children.map(c => c.title);
    expect(titles).toContain('Getting Started');
    expect(titles).toContain('API Reference');
  });

  test('discovers nested pages', async () => {
    const tree = await walkDir(tmpDir);
    // guides/advanced should be nested
    const guides = tree!.children.find(c => c.path.includes('guides'));
    expect(guides).toBeDefined();
  });

  test('skips dot-prefixed directories', async () => {
    await mkdir(join(tmpDir, '.hidden'));
    await writeFile(join(tmpDir, '.hidden', 'index.md'), '# Hidden');
    const tree = await walkDir(tmpDir);
    const paths = flattenPaths(tree!);
    expect(paths).not.toContain('.hidden');
  });

  test('skips node_modules', async () => {
    await mkdir(join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(tmpDir, 'node_modules', 'pkg', 'index.md'), '# Package');
    const tree = await walkDir(tmpDir);
    const paths = flattenPaths(tree!);
    expect(paths.some(p => p.includes('node_modules'))).toBe(false);
  });

  test('skips underscore-prefixed directories', async () => {
    await mkdir(join(tmpDir, '_private'));
    await writeFile(join(tmpDir, '_private', 'index.md'), '# Private');
    const tree = await walkDir(tmpDir);
    const paths = flattenPaths(tree!);
    expect(paths).not.toContain('_private');
  });

  test('skips assets directory', async () => {
    const tree = await walkDir(tmpDir);
    const paths = flattenPaths(tree!);
    expect(paths.some(p => p.includes('assets'))).toBe(false);
  });

  test('respects order.json', async () => {
    const tree = await walkDir(tmpDir);
    const childTitles = tree!.children.map(c => c.title);
    const gsIdx = childTitles.indexOf('Getting Started');
    const apiIdx = childTitles.indexOf('API Reference');
    // order.json specifies getting-started before api-reference
    expect(gsIdx).toBeLessThan(apiIdx);
  });

  test('extracts icons from frontmatter', async () => {
    const tree = await walkDir(tmpDir);
    // Root page has icon
    expect(tree!.icon).toBeDefined();
  });

  test('returns null for empty directory without index.md', async () => {
    const emptyDir = join(tmpDir, 'empty-dir');
    await mkdir(emptyDir);
    const tree = await walkDir(tmpDir, emptyDir);
    expect(tree).toBeNull();
  });
});

describe('getAllPages', () => {
  test('returns all page paths', async () => {
    const pages = await getAllPages(tmpDir);
    expect(pages).toContain('getting-started');
    expect(pages).toContain('api-reference');
    // Should include nested pages
    expect(pages.some(p => p.includes('advanced'))).toBe(true);
  });

  test('excludes root page', async () => {
    const pages = await getAllPages(tmpDir);
    // Root is excluded (empty relative path)
    expect(pages).not.toContain('');
    expect(pages).not.toContain('.');
  });

  test('skips filtered directories', async () => {
    const pages = await getAllPages(tmpDir);
    expect(pages.every(p => !p.includes('node_modules'))).toBe(true);
    expect(pages.every(p => !p.startsWith('.'))).toBe(true);
    expect(pages.every(p => !p.startsWith('_'))).toBe(true);
  });
});

describe('resolvePageAssets', () => {
  test('finds favicon in page directory', async () => {
    // Create a favicon in getting-started
    await writeFile(join(tmpDir, 'getting-started', 'favicon.ico'), 'fake-ico');
    const assets = await resolvePageAssets(tmpDir, 'getting-started');
    expect(assets.faviconPath).toContain('favicon.ico');
    expect(assets.faviconInherited).toBe(false);
  });

  test('inherits favicon from parent', async () => {
    // Create a favicon at root
    await writeFile(join(tmpDir, 'favicon.svg'), '<svg/>');
    const assets = await resolvePageAssets(tmpDir, 'getting-started');
    expect(assets.faviconPath).toBe('/favicon.svg');
    expect(assets.faviconInherited).toBe(true);
  });

  test('returns null when no favicon exists', async () => {
    const assets = await resolvePageAssets(tmpDir, 'getting-started');
    expect(assets.faviconPath).toBeNull();
  });

  test('finds og-image', async () => {
    await writeFile(join(tmpDir, 'og-image.png'), 'fake-png');
    const assets = await resolvePageAssets(tmpDir, '.');
    expect(assets.ogImagePath).toBe('/og-image.png');
    expect(assets.ogImageInherited).toBe(false);
  });
});

// Helper: flatten all paths from a NavNode tree
function flattenPaths(node: { path: string; children: any[] }): string[] {
  const paths = [node.path];
  for (const child of node.children || []) {
    paths.push(...flattenPaths(child));
  }
  return paths;
}
