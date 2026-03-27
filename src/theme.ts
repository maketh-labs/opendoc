import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TemplateVars } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themesDir = join(__dirname, '..', 'themes');

export async function loadTemplate(themeName: string = 'default'): Promise<string> {
  const templatePath = join(themesDir, themeName, 'template.html');
  return readFile(templatePath, 'utf-8');
}

export async function loadStyles(themeName: string = 'default'): Promise<string> {
  const stylePath = join(themesDir, themeName, 'style.css');
  return readFile(stylePath, 'utf-8');
}

export function renderTemplate(template: string, { title, content, nav, backlinks, styles, clientJs }: TemplateVars): string {
  return template
    .replace('{{title}}', escapeHtml(title))
    .replace('{{content}}', content)
    .replace('{{nav}}', nav)
    .replace('{{backlinks}}', backlinks)
    .replace('{{styles}}', styles)
    .replace('{{clientJs}}', clientJs || '');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
