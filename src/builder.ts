import { readFile, writeFile, mkdir, copyFile, access, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { walkDir, getAllPages } from './walker';
import { renderFull } from './renderer';
import { buildBacklinks } from './backlinks';
import { compress, compressMini } from './compressor';
import { loadTemplate, loadStyles, renderTemplate } from './theme';
import { tocToHtml } from './plugins/toc';
import { ensureConfig, getEditorPath } from './config';
import { escapeHtml, parseFrontmatter } from './utils.js';
import { navToHtml, backlinksToHtml } from './render-utils.js';
import type { NavNode, BacklinksIndex } from './types';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(src: string, dest: string): Promise<boolean> {
  if (await fileExists(src)) {
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    return true;
  }
  return false;
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

export async function build(rootDir: string): Promise<void> {
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
  const distDir = join(rootDir, '.opendoc', 'dist');
  const pages = await getAllPages(rootDir);
  const navTree = await walkDir(rootDir);
  const backlinks = await buildBacklinks(rootDir);
  const template = await loadTemplate();
  const styles = await loadStyles();

  const navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';

  console.log(`Building ${pages.length} pages...`);

  // Build titleMap for wikilink resolution: url → page title
  const titleMap = new Map<string, string>();
  for (const page of pages) {
    const indexPath = join(rootDir, page, 'index.md');
    const markdown = await readFile(indexPath, 'utf-8');
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const fm = parseFrontmatter(markdown);
    const title = (fm.title as string) || (titleMatch ? titleMatch[1]!.trim() : page);
    const url = page === '.' ? '/' : `/${page}`;
    titleMap.set(url, title);
  }

  const summary: string[] = [];
  let mdCopied = 0;
  let contextCopied = 0;
  let contextMiniCopied = 0;
  let assetsCopied = 0;

  for (const page of pages) {
    const indexPath = join(rootDir, page, 'index.md');
    const markdown = await readFile(indexPath, 'utf-8');

    // Render HTML with TOC and frontmatter
    const currentPath = page === '.' ? 'index.md' : `${page}/index.md`;
    const { html: content, toc, frontmatter } = await renderFull(markdown, { titleMap, currentPath });
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = (frontmatter.title as string) || (titleMatch ? titleMatch[1]!.trim() : 'OpenDoc');
    const icon = (frontmatter.icon as string) || '';

    // Get backlinks for this page
    const normalized = page === '.' ? '' : page;
    const pageBacklinks = backlinks[normalized] || [];

    const html = renderTemplate(template, {
      title,
      siteTitle: 'OpenDoc',
      content,
      nav: navHtml,
      backlinks: backlinksToHtml(pageBacklinks),
      toc: tocToHtml(toc),
      icon,
      pageTitle: title,
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

    // Copy raw source md to dist
    await copyFile(indexPath, join(outDir, 'index.md'));
    mdCopied++;

    // Copy context files to dist
    const contextSrc = join(rootDir, page, 'context.md');
    if (await copyIfExists(contextSrc, join(outDir, 'context.md'))) {
      contextCopied++;
    }
    const contextMiniSrc = join(rootDir, page, 'context-mini.md');
    if (await copyIfExists(contextMiniSrc, join(outDir, 'context-mini.md'))) {
      contextMiniCopied++;
    }

    // Copy assets/ folder if it exists
    const assetsDir = join(rootDir, page, 'assets');
    if (await fileExists(assetsDir)) {
      const assetsOutDir = join(outDir, 'assets');
      await copyDirRecursive(assetsDir, assetsOutDir);
      assetsCopied++;
    }
  }

  // Write _opendoc/ metadata and assets
  const opendocDir = join(distDir, '_opendoc');
  await mkdir(opendocDir, { recursive: true });

  await writeFile(join(opendocDir, 'nav.json'), JSON.stringify(navTree, null, 2));
  await writeFile(join(opendocDir, 'backlinks.json'), JSON.stringify(backlinks, null, 2));

  // Write theme CSS
  await writeFile(join(opendocDir, 'theme.css'), styles);

  // Bundle client JS
  const clientDir = join(dirname(dirname(import.meta.path)), 'client');
  const buildResult = await Bun.build({
    entrypoints: [join(clientDir, 'app.ts')],
    target: 'browser',
    minify: true,
  });
  if (buildResult.outputs[0]) {
    await writeFile(join(opendocDir, 'app.js'), await buildResult.outputs[0].text());
  }

  // Copy editor.html to dist at configured editorPath
  if (editorPath !== null) {
    const editorSrc = join(dirname(dirname(import.meta.path)), 'themes', 'default', 'editor.html');
    if (await fileExists(editorSrc)) {
      const editorRelPath = editorPath.replace(/^\//, '');
      const editorOutDir = join(distDir, editorRelPath);
      await mkdir(editorOutDir, { recursive: true });
      await copyFile(editorSrc, join(editorOutDir, 'index.html'));
      summary.push(`  ${editorRelPath}/index.html`);
    }
  }

  // Write public config.json to dist/_opendoc/
  const { clientSecret: _secret, ...safeGithub } = config.github ?? {};
  const publicConfig = {
    title: config.title,
    editorPath: editorPath ?? '/editor',
    github: config.github ? safeGithub : undefined,
    theme: config.theme,
  };
  await writeFile(join(opendocDir, 'config.json'), JSON.stringify(publicConfig, null, 2));

  // Print summary
  console.log(`\nBuild summary:`);
  console.log(`  ${pages.length} pages → index.html`);
  console.log(`  ${mdCopied} pages → index.md (raw source)`);
  console.log(`  ${contextCopied} pages → context.md`);
  console.log(`  ${contextMiniCopied} pages → context-mini.md`);
  console.log(`  ${assetsCopied} pages → assets/ copied`);
  console.log(`  _opendoc/nav.json`);
  console.log(`  _opendoc/backlinks.json`);
  console.log(`  _opendoc/theme.css`);
  console.log(`  _opendoc/app.js`);
  for (const line of summary) console.log(line);
  console.log(`\nBuilt to ${distDir}`);
}
