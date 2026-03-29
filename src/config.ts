import { join } from 'path';
import type { OpenDocConfig } from './types';

export async function ensureConfig(rootDir: string): Promise<OpenDocConfig> {
  const configPath = join(rootDir, '.opendoc', 'config.json');
  const file = Bun.file(configPath);
  if (await file.exists()) {
    return await file.json();
  }

  // Create default config
  const defaultConfig: OpenDocConfig = {
    title: 'My Docs',
    editorPath: '/editor',
  };
  const { mkdir } = await import('fs/promises');
  await mkdir(join(rootDir, '.opendoc'), { recursive: true });
  await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2) + '\n');
  console.log('Created .opendoc/config.json with defaults');
  return defaultConfig;
}

export function getEditorPath(config: OpenDocConfig): string | null {
  if (config.editorPath === null) return null;
  return config.editorPath ?? '/editor';
}
