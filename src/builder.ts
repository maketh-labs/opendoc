import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { walkDir, getAllPages } from './walker';
import { render } from './renderer';
import { buildBacklinks } from './backlinks';
import { compress, compressMini } from './compressor';
import { loadTemplate, loadStyles, renderTemplate } from './theme';
import type { NavNode, BacklinksIndex } from './types';

function navToHtml(node: NavNode, currentPath: string = ''): string {
  if (!node) return '';
  const active = node.path === currentPath ? ' class="active"' : '';
  let html = `<li><a href="${node.url}"${active}>${escapeHtml(node.title)}</a>`;
  if (node.children && node.children.length > 0) {
    html += '<ul>' + node.children.map(c => navToHtml(c, currentPath)).join('') + '</ul>';
  }
  html += '</li>';
  return html;
}

function backlinksToHtml(links: string[]): string {
  if (!links || links.length === 0) return '';
  const items = links.map(l => {
    const url = l === '.' ? '/' : `/${l}`;
    const name = l === '.' ? 'Home' : l.split('/').pop()!.replace(/-/g, ' ');
    return `<li><a href="${url}">${escapeHtml(name)}</a></li>`;
  }).join('');
  return `<div class="backlinks"><h3>Backlinks</h3><ul>${items}</ul></div>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function build(rootDir: string): Promise<void> {
  const distDir = join(rootDir, '.opendoc', 'dist');
  const pages = await getAllPages(rootDir);
  const navTree = await walkDir(rootDir);
  const backlinks = await buildBacklinks(rootDir);
  const template = await loadTemplate();
  const styles = await loadStyles();

  const navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';

  console.log(`Building ${pages.length} pages...`);

  for (const page of pages) {
    const indexPath = join(rootDir, page, 'index.md');
    const markdown = await readFile(indexPath, 'utf-8');

    // Render HTML
    const content = await render(markdown);
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1]!.trim() : 'OpenDoc';

    // Get backlinks for this page
    const normalized = page === '.' ? '' : page;
    const pageBacklinks = backlinks[normalized] || [];
    const backlinksHtml = backlinksToHtml(pageBacklinks);

    const html = renderTemplate(template, {
      title,
      content,
      nav: navHtml,
      backlinks: backlinksHtml,
      styles,
      clientJs: '',
    });

    // Write HTML
    const outDir = page === '.' ? distDir : join(distDir, page);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'index.html'), html);

    // Generate context files in source directory
    const contextMd = compress(markdown);
    const contextMiniMd = compressMini(markdown);
    await writeFile(join(rootDir, page, 'context.md'), contextMd);
    await writeFile(join(rootDir, page, 'context-mini.md'), contextMiniMd);
  }

  console.log(`Built to ${distDir}`);
}
