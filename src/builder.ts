import { readFile, writeFile, mkdir, copyFile, access, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { walkDir, getAllPages } from './walker';
import { buildBacklinks } from './backlinks';
import { compress, compressMini } from './compressor';
import { loadTemplate, loadStyles, renderTemplate } from './theme';
import { ensureConfig, getEditorPath, buildPublicConfig } from './config';
import { buildTitleMap } from './utils.js';
import { navToHtml } from './render-utils.js';
import { renderPageData } from './page-data';
import { loadClientBundles, themeFiles } from './assets';

/** Per-page site files (favicons, manifest, OG image) the dev server serves from page directories. */
const PAGE_SITE_FILES = [
  'favicon.ico', 'favicon.svg', 'favicon.png', 'favicon-96x96.png', 'favicon-dark.png', 'favicon-dark.svg',
  'apple-touch-icon.png', 'web-app-manifest-192x192.png', 'web-app-manifest-512x512.png', 'site.webmanifest',
  'og-image.png', 'og-image.jpg', 'og-image.webp',
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

export async function build(rootDir: string): Promise<void> {
  const config = await ensureConfig(rootDir);
  const editorPath = getEditorPath(config);
  const siteTitle = config.title || 'OpenDoc';
  const distDir = join(rootDir, 'dist');

  // Root index.md is the "/" page
  const childPages = await getAllPages(rootDir);
  const pages = (await fileExists(join(rootDir, 'index.md'))) ? ['.', ...childPages] : childPages;
  const navTree = await walkDir(rootDir);
  const backlinks = await buildBacklinks(rootDir);
  const template = await loadTemplate();
  const titleMap = await buildTitleMap(rootDir, childPages);
  const navHtml = navTree ? `<ul>${navToHtml(navTree)}</ul>` : '';

  // Start clean so deleted pages don't linger in the output
  await rm(distDir, { recursive: true, force: true });
  const opendocDir = join(distDir, '_opendoc');
  await mkdir(join(opendocDir, 'page'), { recursive: true });

  console.log(`Building ${pages.length} pages...`);

  const summary: string[] = [];
  let assetsCopied = 0;

  for (const page of pages) {
    const srcDir = page === '.' ? rootDir : join(rootDir, page);
    const outDir = page === '.' ? distDir : join(distDir, page);
    await mkdir(outDir, { recursive: true });

    const rendered = await renderPageData(rootDir, page, titleMap, backlinks);
    if (!rendered) continue;
    const { data } = rendered;

    // Pre-rendered HTML (no-JS / crawlers); the viewer SPA takes over on load
    const html = renderTemplate(template, {
      title: data.title,
      siteTitle,
      content: data.html,
      nav: navHtml,
      backlinks: data.backlinks,
      toc: data.toc,
      icon: data.icon,
      pageTitle: data.title,
      pageFavicon: data.faviconUrl || '',
      ogImage: data.ogImageUrl || '',
    });
    await writeFile(join(outDir, 'index.html'), html);

    // Page JSON for the viewer SPA (same payload as the dev server's /_opendoc/page route)
    const jsonPath = page === '.' ? join(opendocDir, 'page.json') : join(opendocDir, 'page', `${page}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(data));

    // Raw source + context tiers for agents (generated into dist only — never into the source tree)
    const markdown = await readFile(join(srcDir, 'index.md'), 'utf-8');
    await writeFile(join(outDir, 'index.md'), markdown);
    await writeFile(join(outDir, 'context.md'), compress(markdown));
    await writeFile(join(outDir, 'context-mini.md'), compressMini(markdown));

    const assetsDir = join(srcDir, 'assets');
    if (await fileExists(assetsDir)) {
      await copyDirRecursive(assetsDir, join(outDir, 'assets'));
      assetsCopied++;
    }
  }

  // Favicons / manifest / OG images live in page directories (and are inherited by subpages)
  let siteFilesCopied = 0;
  for (const page of ['.', ...childPages]) {
    for (const name of PAGE_SITE_FILES) {
      const src = page === '.' ? join(rootDir, name) : join(rootDir, page, name);
      if (await fileExists(src)) {
        const dest = page === '.' ? join(distDir, name) : join(distDir, page, name);
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(src, dest);
        siteFilesCopied++;
      }
    }
  }

  await writeFile(join(opendocDir, 'nav.json'), JSON.stringify(navTree, null, 2));
  await writeFile(join(opendocDir, 'backlinks.json'), JSON.stringify(backlinks, null, 2));
  await writeFile(join(opendocDir, 'config.json'), JSON.stringify(buildPublicConfig(config, editorPath), null, 2));

  // Theme CSS: base styles + the user's theme.css overrides (same as the dev server)
  let css = await loadStyles();
  try {
    css += '\n' + await readFile(join(rootDir, 'theme.css'), 'utf-8');
  } catch {}
  await writeFile(join(opendocDir, 'theme.css'), css);

  const bundles = await loadClientBundles({ editor: editorPath !== null });
  await writeFile(join(opendocDir, 'viewer.js'), bundles.viewerJs);

  // Editor (GitHub mode). Login needs a running `opendoc serve` for the OAuth code exchange.
  if (editorPath !== null && bundles.editorJs && bundles.editorCss) {
    await writeFile(join(opendocDir, 'editor.js'), bundles.editorJs);
    await writeFile(join(opendocDir, 'editor.css'), bundles.editorCss);
    const editorOutDir = join(distDir, editorPath.replace(/^\//, ''));
    await mkdir(editorOutDir, { recursive: true });
    await writeFile(join(editorOutDir, 'index.html'), themeFiles.editorHtml);
    summary.push(`  ${editorPath.replace(/^\//, '')}/index.html`);
  }

  // Copy 404/index.html to dist/404.html for static hosting platforms
  const notFoundSrc = join(distDir, '404', 'index.html');
  if (await fileExists(notFoundSrc)) {
    await copyFile(notFoundSrc, join(distDir, '404.html'));
    summary.push('  404.html (copied from 404/index.html)');
  }

  console.log(`\nBuild summary:`);
  console.log(`  ${pages.length} pages → index.html, index.md, context.md, context-mini.md, _opendoc/page JSON`);
  console.log(`  ${assetsCopied} pages → assets/ copied`);
  console.log(`  ${siteFilesCopied} favicon/manifest/og-image files copied`);
  console.log(`  _opendoc/{nav,backlinks,config}.json, theme.css, viewer.js`);
  for (const line of summary) console.log(line);
  console.log(`\nBuilt to ${distDir}`);
}
