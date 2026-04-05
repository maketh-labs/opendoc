import { test, expect, describe } from 'bun:test';
import { getEditorPath, buildPublicConfig } from '../../src/config';
import type { OpenDocConfig } from '../../src/types';

describe('getEditorPath', () => {
  test('returns default /_', () => {
    expect(getEditorPath({})).toBe('/_');
  });

  test('returns configured path', () => {
    expect(getEditorPath({ editorPath: '/edit' })).toBe('/edit');
  });

  test('returns null when explicitly disabled', () => {
    expect(getEditorPath({ editorPath: null })).toBeNull();
  });

  test('migrates legacy /_editor to /_', () => {
    expect(getEditorPath({ editorPath: '/_editor' })).toBe('/_');
  });
});

describe('buildPublicConfig', () => {
  test('strips clientSecret from github config', () => {
    const config: OpenDocConfig = {
      title: 'Test',
      github: {
        repo: 'owner/repo',
        clientId: 'abc123',
        clientSecret: 'secret-should-not-leak',
      },
    };
    const pub = buildPublicConfig(config, '/_');
    expect(pub.title).toBe('Test');
    expect(pub.github).toBeDefined();
    expect(pub.github!.repo).toBe('owner/repo');
    expect(pub.github!.clientId).toBe('abc123');
    expect((pub.github as any).clientSecret).toBeUndefined();
  });

  test('handles config without github', () => {
    const config: OpenDocConfig = { title: 'Test' };
    const pub = buildPublicConfig(config, '/_');
    expect(pub.title).toBe('Test');
    expect(pub.github).toBeUndefined();
  });

  test('includes theme and faviconConfig', () => {
    const config: OpenDocConfig = {
      title: 'Test',
      theme: 'dark',
    };
    const pub = buildPublicConfig(config, '/_');
    expect(pub.theme).toBe('dark');
  });

  test('uses provided editorPath', () => {
    const pub = buildPublicConfig({ title: 'Test' }, '/custom-editor');
    expect(pub.editorPath).toBe('/custom-editor');
  });

  test('defaults editorPath to /_ when null', () => {
    const pub = buildPublicConfig({ title: 'Test' }, null);
    expect(pub.editorPath).toBe('/_');
  });
});
