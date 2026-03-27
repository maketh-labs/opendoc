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

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace('{{title}}', escapeHtml(vars.title))
    .replace('{{siteTitle}}', escapeHtml(vars.siteTitle))
    .replace('{{content}}', vars.content)
    .replace('{{nav}}', vars.nav)
    .replace('{{backlinks}}', vars.backlinks);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
