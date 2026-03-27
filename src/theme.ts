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
  // Handle conditional {{#if icon}} blocks
  let result = template;

  result = result.replace(/\{\{#if icon\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, content) => {
    return vars.icon ? content : '';
  });

  // Handle conditional {{#if toc}} blocks
  result = result.replace(/\{\{#if toc\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, content) => {
    return vars.toc ? content : '';
  });

  return result
    .replace(/\{\{title\}\}/g, escapeHtml(vars.title))
    .replace(/\{\{siteTitle\}\}/g, escapeHtml(vars.siteTitle))
    .replace(/\{\{content\}\}/g, vars.content)
    .replace(/\{\{nav\}\}/g, vars.nav)
    .replace(/\{\{backlinks\}\}/g, vars.backlinks)
    .replace(/\{\{toc\}\}/g, vars.toc)
    .replace(/\{\{icon\}\}/g, vars.icon)
    .replace(/\{\{pageTitle\}\}/g, escapeHtml(vars.pageTitle));
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
