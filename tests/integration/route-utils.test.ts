import { test, expect, describe } from 'bun:test';
import { isWithinRoot, MIME_TYPES } from '../../src/routes/types';

describe('isWithinRoot', () => {
  test('allows paths within root', () => {
    expect(isWithinRoot('/docs', '/docs/page/index.md')).toBe(true);
  });

  test('allows root path itself', () => {
    expect(isWithinRoot('/docs', '/docs')).toBe(true);
  });

  test('rejects paths outside root', () => {
    expect(isWithinRoot('/docs', '/etc/passwd')).toBe(false);
  });

  test('rejects path traversal attempts', () => {
    // Note: isWithinRoot uses resolve() which normalizes /docs/../etc/passwd to /etc/passwd
    // But the input here is already an absolute path — resolve('/docs', '/docs/../etc/passwd')
    // still yields /etc/passwd. However, the function takes an already-resolved fullPath.
    // In practice, callers use path.resolve() before calling isWithinRoot.
    const { resolve } = require('path');
    expect(isWithinRoot('/docs', resolve('/docs', '..', 'etc', 'passwd'))).toBe(false);
  });

  test('rejects prefix attacks', () => {
    // /docs-evil starts with /docs but is not within it
    expect(isWithinRoot('/docs', '/docs-evil/file')).toBe(false);
  });
});

describe('MIME_TYPES', () => {
  test('maps common extensions', () => {
    expect(MIME_TYPES.png).toBe('image/png');
    expect(MIME_TYPES.svg).toBe('image/svg+xml');
    expect(MIME_TYPES.ico).toBe('image/x-icon');
    expect(MIME_TYPES.jpg).toBe('image/jpeg');
    expect(MIME_TYPES.jpeg).toBe('image/jpeg');
    expect(MIME_TYPES.gif).toBe('image/gif');
    expect(MIME_TYPES.webp).toBe('image/webp');
    expect(MIME_TYPES.pdf).toBe('application/pdf');
    expect(MIME_TYPES.webmanifest).toBe('application/manifest+json');
  });
});
