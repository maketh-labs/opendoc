# OpenDoc Theme Guide

OpenDoc is fully themeable through a single CSS file. Place your theme at `.opendoc/theme.css` in your docs root and it will be loaded on top of the default styles.

No build step. No config. Just CSS.

---

## How it works

OpenDoc's UI is built with CSS custom properties (variables). Every color, size, font, and spacing value has a named variable. Your `theme.css` overrides those variables — and optionally specific class rules — to reshape the entire UI.

```
my-docs/
├── .opendoc/
│   ├── config.json
│   └── theme.css   ← your theme goes here
├── index.md
└── ...
```

---

## The full variable reference

Copy this into your `theme.css` and uncomment what you want to change.

```css
:root {
  /* ── Colors: Backgrounds ──────────────────────────────────── */
  --od-bg:              #ffffff;   /* Page background */
  --od-bg-surface:      #f8f9fa;   /* Sidebar + header background */
  --od-bg-surface-2:    #e9ecef;   /* Hover states */
  --od-bg-code:         #f6f8fa;   /* Code block background */
  --od-bg-code-inline:  #f0f2f5;   /* Inline code background */

  /* ── Colors: Borders ──────────────────────────────────────── */
  --od-border:          #e1e4e8;

  /* ── Colors: Text ─────────────────────────────────────────── */
  --od-text:            #1a1a2e;   /* Primary text */
  --od-text-muted:      #6b7280;   /* Secondary text, placeholders */

  /* ── Colors: Accent ───────────────────────────────────────── */
  --od-accent:          #0969da;   /* Links, active nav, focus rings */
  --od-accent-hover:    #0550ae;

  /* ── Colors: Callouts ─────────────────────────────────────── */
  --od-callout-note-color:      #0969da;
  --od-callout-note-bg:         #f0f6ff;
  --od-callout-tip-color:       #1a7f37;
  --od-callout-tip-bg:          #ecfdf5;
  --od-callout-warning-color:   #d1242f;
  --od-callout-warning-bg:      #fffbeb;
  --od-callout-caution-bg:      #fef2f2;
  --od-callout-important-color: #8250df;
  --od-callout-important-bg:    #f5f3ff;

  /* ── Typography: Fonts ────────────────────────────────────── */
  --od-font-body:     -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --od-font-heading:  inherit;   /* All headings (overridden per-level below) */
  --od-font-h1:       inherit;
  --od-font-h2:       inherit;
  --od-font-h3:       inherit;
  --od-font-mono:     "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --od-font-nav:      inherit;   /* Sidebar nav font */
  --od-font-logo:     inherit;   /* Site name font */

  /* ── Typography: Sizes ────────────────────────────────────── */
  --od-text-base:   1rem;
  --od-text-sm:     0.875rem;
  --od-text-xs:     0.75rem;
  --od-text-nav:    0.8375rem;
  --od-text-logo:   0.9rem;
  --od-text-h1:     2.5rem;
  --od-text-h2:     1.5rem;
  --od-text-h3:     1.2rem;
  --od-text-h4:     1rem;
  --od-text-code:   0.875em;

  /* ── Typography: Weights ──────────────────────────────────── */
  --od-weight-body:       400;
  --od-weight-h1:         700;
  --od-weight-h2:         600;
  --od-weight-h3:         600;
  --od-weight-h4:         600;
  --od-weight-logo:       600;
  --od-weight-nav:        400;
  --od-weight-nav-active: 500;

  /* ── Typography: Line heights ─────────────────────────────── */
  --od-line-height:          1.75;
  --od-line-height-heading:  1.2;
  --od-line-height-code:     1.5;

  /* ── Layout: Dimensions ───────────────────────────────────── */
  --od-header-height:  48px;
  --od-sidebar-width:  260px;
  --od-content-max:    720px;   /* Max width of article body */
  --od-toc-width:      200px;

  /* ── Layout: Spacing ──────────────────────────────────────── */
  --od-header-padding:         0 12px;
  --od-sidebar-padding:        12px 8px;
  --od-content-padding:        2rem 3rem 0;
  --od-content-bottom:         6rem;
  --od-content-gap:            2rem;   /* Gap between article and TOC */

  /* ── Nav ──────────────────────────────────────────────────── */
  --od-nav-item-padding:   5px 10px;
  --od-nav-item-gap:       1px;
  --od-nav-nested-indent:  10px;
  --od-nav-nested-margin:  6px;

  /* ── Article spacing ──────────────────────────────────────── */
  --od-p-margin:          1rem;
  --od-list-margin:       1rem;
  --od-list-indent:       1.5rem;
  --od-li-gap:            0.25rem;
  --od-h1-margin-bottom:  1rem;
  --od-h2-margin-top:     2rem;
  --od-h2-margin-bottom:  0.75rem;
  --od-h3-margin-top:     1.5rem;
  --od-h3-margin-bottom:  0.5rem;
  --od-h4-margin-top:     1.25rem;
  --od-h4-margin-bottom:  0.5rem;
  --od-hr-margin:         2rem 0;
  --od-blockquote-margin: 1rem 0;
  --od-code-block-margin: 1rem 0;
  --od-table-margin:      1rem 0;

  /* ── Article: Code ────────────────────────────────────────── */
  --od-code-block-padding:   1rem;
  --od-code-inline-padding:  0.15em 0.35em;
  --od-code-inline-radius:   3px;

  /* ── Article: Blockquote ──────────────────────────────────── */
  --od-blockquote-border-width: 3px;
  --od-blockquote-padding-left: 1rem;

  /* ── Article: Table ───────────────────────────────────────── */
  --od-table-cell-padding:  0.5rem 0.75rem;

  /* ── Callout ──────────────────────────────────────────────── */
  --od-callout-padding:       0.75rem 1rem;
  --od-callout-gap:           0.75rem;
  --od-callout-border-width:  4px;
  --od-callout-icon-size:     1.2rem;

  /* ── TOC ──────────────────────────────────────────────────── */
  --od-toc-item-padding:         3px 12px;
  --od-toc-nested-padding:       3px 24px;
  --od-toc-active-border-width:  2px;

  /* ── Misc ─────────────────────────────────────────────────── */
  --od-radius:      6px;       /* Global border radius */
  --od-transition:  200ms ease;
}

/* Dark mode overrides (optional) */
[data-theme="dark"] {
  --od-bg:             #0f0f0f;
  --od-bg-surface:     #1a1a1a;
  /* ... */
}
```

---

## Class reference

Every element in the viewer has a semantic class name prefixed with `od-`. You can target these directly in your `theme.css` for structural changes that go beyond variables.

| Class | What it is |
|---|---|
| `.od-header` | Fixed top bar |
| `.od-header-left / -center / -right` | Header slot regions |
| `.od-logo` | Site name / branding link |
| `.od-toggle-btn` | Icon buttons (sidebar, theme) |
| `.od-search-box` | Search input wrapper |
| `.od-layout` | Main grid container |
| `.od-sidebar-left` | Left navigation panel |
| `.od-nav` | Navigation tree |
| `.od-nav a` | Nav link |
| `.od-nav a.active` | Active page link |
| `.od-nav ul ul` | Nested nav level |
| `.od-content` | Scrollable content column |
| `.od-content-wrap` | Article inner wrapper |
| `.od-article` | Rendered markdown body |
| `.od-page-header` | Page title area |
| `.od-page-icon` | Large page emoji/icon |
| `.od-article h1–h4` | Article headings |
| `.od-article p` | Paragraphs |
| `.od-article a` | Inline links |
| `.od-article code` | Inline code |
| `.od-article pre` | Code block |
| `.od-article blockquote` | Block quote |
| `.od-article table/th/td` | Tables |
| `.od-article img` | Images |
| `.od-article hr` | Dividers |
| `.od-copy-btn` | Copy button on code blocks |
| `.od-callout` | Callout/admonition container |
| `.od-callout-note/tip/warning/…` | Callout variants |
| `.od-toc` | Right-hand table of contents |
| `.od-toc-list` | TOC link list |
| `.od-toc-list li a.active` | Active TOC section |
| `.od-backlinks` | "Referenced by" footer section |
| `.od-figure` | Figure with caption |
| `.od-figure figcaption` | Image caption |

---

## Example themes

See the files in this directory:

- [`minimal.css`](./minimal.css) — clean, more whitespace, subtle palette
- [`dark.css`](./dark.css) — dark-first, GitHub-inspired
- [`serif.css`](./serif.css) — editorial, Georgia body, warm tones
- [`dense.css`](./dense.css) — compact, tight spacing, smaller fonts
- [`newspaper.css`](./newspaper.css) — high contrast, strong typographic hierarchy
