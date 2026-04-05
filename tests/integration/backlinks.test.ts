import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { buildBacklinks } from '../../src/backlinks';
import { createTempDocs, cleanupTempDocs } from '../helpers';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDocs();
});

afterEach(async () => {
  await cleanupTempDocs(tmpDir);
});

describe('buildBacklinks', () => {
  test('detects wikilink backlinks', async () => {
    const index = await buildBacklinks(tmpDir);
    // getting-started/index.md has [[API Reference]] and [[Guides/Advanced|Advanced Guide]]
    expect(index['api-reference']).toContain('getting-started');
  });

  test('detects markdown link backlinks', async () => {
    const index = await buildBacklinks(tmpDir);
    // Root index.md has [API Reference](/api-reference)
    expect(index['api-reference']).toBeDefined();
  });

  test('ignores external links', async () => {
    const index = await buildBacklinks(tmpDir);
    // No key should be an external URL
    for (const key of Object.keys(index)) {
      expect(key).not.toMatch(/^https?:/);
    }
  });

  test('ignores anchor-only links', async () => {
    const index = await buildBacklinks(tmpDir);
    for (const key of Object.keys(index)) {
      expect(key).not.toStartWith('#');
    }
  });

  test('builds reciprocal links', async () => {
    const index = await buildBacklinks(tmpDir);
    // getting-started links to api-reference, and api-reference links back to getting-started
    expect(index['getting-started']).toBeDefined();
    const gsBacklinkers = index['getting-started'] || [];
    expect(gsBacklinkers.length).toBeGreaterThan(0);
  });

  test('returns empty object for empty docs', async () => {
    const { mkdtemp } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const emptyDir = await mkdtemp(join(tmpdir(), 'opendoc-empty-'));
    try {
      const index = await buildBacklinks(emptyDir);
      expect(Object.keys(index)).toHaveLength(0);
    } finally {
      await cleanupTempDocs(emptyDir);
    }
  });
});
