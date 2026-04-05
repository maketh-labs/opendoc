/**
 * E2E Test Setup for OpenDoc
 *
 * This file provides helpers for Playwright-based end-to-end tests.
 * These tests start a real OpenDoc server and interact with it via a browser.
 *
 * To run E2E tests:
 *   1. Install playwright: bunx playwright install chromium
 *   2. Run: bun test tests/e2e/
 *
 * Note: E2E tests are slower and require more setup than unit/integration tests.
 * They are meant to be run less frequently, typically before releases.
 */
import { spawn, type Subprocess } from 'bun';
import { mkdtemp, cp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const FIXTURES_DIR = join(import.meta.dir, '..', 'fixtures');
const SAMPLE_DOCS = join(FIXTURES_DIR, 'sample-docs');

export interface ServerInstance {
  process: Subprocess;
  port: number;
  url: string;
  tmpDir: string;
}

/**
 * Start an OpenDoc dev server on a random port.
 * Returns the server instance info for test use.
 */
export async function startTestServer(): Promise<ServerInstance> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'opendoc-e2e-'));
  await cp(SAMPLE_DOCS, tmpDir, { recursive: true });

  // Use a random high port to avoid conflicts
  const port = 10000 + Math.floor(Math.random() * 50000);

  const proc = spawn({
    cmd: ['bun', 'run', join(import.meta.dir, '..', '..', 'src', 'cli.ts'), 'serve', tmpDir, '--port', String(port)],
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Wait for server to be ready (poll for connection)
  const maxWait = 15000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`http://localhost:${port}/_opendoc/nav.json`);
      if (res.ok) break;
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return {
    process: proc,
    port,
    url: `http://localhost:${port}`,
    tmpDir,
  };
}

/**
 * Stop the test server and clean up temp files.
 */
export async function stopTestServer(server: ServerInstance): Promise<void> {
  server.process.kill();
  await rm(server.tmpDir, { recursive: true, force: true });
}
