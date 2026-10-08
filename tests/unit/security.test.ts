import { test, expect, describe } from 'bun:test';
import { mkdtemp, mkdir, symlink, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { IncomingMessage } from 'http';
import { isPrivateIp, isTrustedLocalRequest, resolveInRoot, fetchPublicText } from '../../src/security';

function fakeReq(headers: Record<string, string>, remoteAddress = '127.0.0.1'): IncomingMessage {
  return { headers, socket: { remoteAddress } } as unknown as IncomingMessage;
}

describe('resolveInRoot', () => {
  test('resolves paths inside the root and rejects escapes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'opendoc-sec-'));
    try {
      await mkdir(join(root, 'guide'));
      expect(await resolveInRoot(root, 'guide/index.md')).toBe(join(root, 'guide', 'index.md'));
      expect(await resolveInRoot(root, '/guide')).toBe(join(root, 'guide'));
      expect(await resolveInRoot(root, '../etc/passwd')).toBeNull();
      expect(await resolveInRoot(root, 'guide/../../x')).toBeNull();
      expect(await resolveInRoot(root, 'a\0b')).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects dot segments like .git unless allowed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'opendoc-sec-'));
    try {
      expect(await resolveInRoot(root, '.git/hooks/pre-commit')).toBeNull();
      expect(await resolveInRoot(root, 'page/.env')).toBeNull();
      expect(await resolveInRoot(root, '.git/config', { allowDotSegments: true })).toBe(join(root, '.git', 'config'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects symlinks pointing outside the root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'opendoc-sec-'));
    try {
      await symlink(tmpdir(), join(root, 'out'));
      expect(await resolveInRoot(root, 'out/file.md')).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('isPrivateIp', () => {
  test('flags loopback, private, link-local and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  test('allows public addresses', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});

describe('fetchPublicText', () => {
  test('refuses private and non-http targets', async () => {
    await expect(fetchPublicText('http://127.0.0.1:1/')).rejects.toThrow('non-public');
    await expect(fetchPublicText('http://169.254.169.254/latest/meta-data')).rejects.toThrow('non-public');
    await expect(fetchPublicText('file:///etc/passwd')).rejects.toThrow('http');
  });
});

describe('isTrustedLocalRequest', () => {
  test('accepts same-origin requests from localhost', () => {
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000' }))).toBe(true);
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000', origin: 'http://localhost:3000' }))).toBe(true);
    expect(isTrustedLocalRequest(fakeReq({ host: '127.0.0.1:3000' }, '::ffff:127.0.0.1'))).toBe(true);
  });

  test('rejects LAN clients', () => {
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000' }, '192.168.1.20'))).toBe(false);
  });

  test('rejects DNS-rebinding hosts', () => {
    expect(isTrustedLocalRequest(fakeReq({ host: 'evil.example:3000' }))).toBe(false);
  });

  test('rejects cross-origin browser requests', () => {
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000', origin: 'https://evil.example' }))).toBe(false);
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000', origin: 'http://localhost:4000' }))).toBe(false);
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000', 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });

  test('rejects reverse-proxied traffic', () => {
    expect(isTrustedLocalRequest(fakeReq({ host: 'localhost:3000', 'x-forwarded-for': '203.0.113.9' }))).toBe(false);
  });
});
