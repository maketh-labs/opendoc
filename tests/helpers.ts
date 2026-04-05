/**
 * Shared test helpers for OpenDoc test suite
 */
import { mkdtemp, cp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const FIXTURES_DIR = join(import.meta.dir, 'fixtures');
export const SAMPLE_DOCS = join(FIXTURES_DIR, 'sample-docs');

/**
 * Create a temporary copy of the sample-docs fixture.
 * Tests that modify the filesystem should use this to avoid polluting fixtures.
 */
export async function createTempDocs(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'opendoc-test-'));
  await cp(SAMPLE_DOCS, dir, { recursive: true });
  return dir;
}

/**
 * Clean up a temporary directory created by createTempDocs
 */
export async function cleanupTempDocs(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
