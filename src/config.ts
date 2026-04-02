import { join } from 'path';
import type { OpenDocConfig } from './types';

export async function ensureConfig(rootDir: string): Promise<OpenDocConfig> {
  const configPath = join(rootDir, 'opendoc.json');
  const file = Bun.file(configPath);
  if (await file.exists()) {
    return await file.json();
  }

  // Migrate from legacy .opendoc/config.json
  const legacyPath = join(rootDir, '.opendoc', 'config.json');
  const legacyFile = Bun.file(legacyPath);
  if (await legacyFile.exists()) {
    const config = await legacyFile.json();
    await Bun.write(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('Migrated .opendoc/config.json → opendoc.json');
    return config;
  }

  // Create default config
  const defaultConfig: OpenDocConfig = {
    title: 'My Docs',
    editorPath: '/_',
  };
  await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2) + '\n');
  console.log('Created opendoc.json with defaults');
  return defaultConfig;
}

export function getEditorPath(config: OpenDocConfig): string | null {
  if (config.editorPath === null) return null;
  const path = config.editorPath ?? '/_';
  // Migrate legacy /_editor → /_ 
  return path === '/_editor' ? '/_' : path;
}

/** Build a public-safe config object (strips clientSecret) */
export function buildPublicConfig(config: OpenDocConfig, editorPath: string | null) {
  const { clientSecret: _, ...publicGithub } = config.github ?? {};
  return {
    title: config.title,
    editorPath: editorPath ?? '/_',
    github: config.github ? publicGithub : undefined,
    theme: config.theme,
    faviconConfig: config.faviconConfig,
  };
}
