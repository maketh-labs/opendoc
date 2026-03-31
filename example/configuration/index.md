---
icon: ⚙️
---

# Configuration

OpenDoc works with zero config. Everything here is optional.

## Config File

Create `.opendoc/config.json` in your docs root to customize behavior:

```json
{
  "title": "My Docs",
  "github": {
    "repo": "your-org/your-repo",
    "branch": "main",
    "clientId": "your-oauth-app-client-id"
  }
}
```

| Field | Default | Description |
|---|---|---|
| `title` | `"My Docs"` | Site title shown in browser tab and sidebar |
| `editorPath` | `"/_"` | URL prefix for the editor. Set to `null` to disable. |
| `github.repo` | — | GitHub repo for cloud editing (e.g. `"org/repo"`) |
| `github.branch` | `"main"` | Branch to read/write from |
| `github.clientId` | — | GitHub OAuth App client ID |

## Page Ordering

By default, pages are sorted alphabetically. To set an explicit order, create an `order.json` in any directory:

```json
["getting-started", "editor", "writing", "configuration", "mcp", "deployment"]
```

Each entry is the folder name of a child page. Unlisted folders are appended alphabetically.

You can also reorder pages by dragging them in the editor sidebar — this writes `order.json` automatically.

## Themes

OpenDoc's viewer is fully themeable through a single CSS file. Every color, font, spacing, and layout value is a CSS custom property.

To create a theme, add `.opendoc/theme.css` to your docs root:

```css
:root {
  /* Colors */
  --od-bg:           #ffffff;
  --od-bg-surface:   #f8f9fa;
  --od-border:       #e1e4e8;
  --od-text:         #1a1a2e;
  --od-accent:       #7c3aed;

  /* Typography */
  --od-font-body:    'Inter', sans-serif;
  --od-font-mono:    'JetBrains Mono', monospace;
  --od-text-base:    1rem;
  --od-line-height:  1.75;

  /* Layout */
  --od-content-max:  720px;
  --od-radius:       6px;
}

[data-theme="dark"] {
  --od-bg:        #0f0f0f;
  --od-bg-surface: #1a1a1a;
  --od-text:      #e5e5e5;
  --od-accent:    #a78bfa;
}
```

The theme panel in the editor (🎨 icon) lets you customize and preview changes live before saving.

### Full variable reference

See `/example/themes/README.md` for the complete list of ~80 CSS variables and class names you can target. The `example/themes/` folder also includes ready-to-use starter themes:

| Theme file | Description |
|---|---|
| `minimal.css` | Clean, generous whitespace, neutral palette |
| `dark.css` | Dark-first, GitHub-inspired |
| `serif.css` | Editorial, Georgia body, warm tones |
| `dense.css` | Compact, tighter spacing, reference-doc feel |
| `newspaper.css` | High contrast, strong typographic hierarchy |

Copy any of these to `.opendoc/theme.css` to use it.

## Favicon & OG Image

### Global (site-wide)

Go to `/_` → Site Settings to upload a global favicon and OG image. These apply to all pages.

### Per-page overrides

Open any page in the editor and click the **page icon** (📄) in the top bar → Page Settings. Upload a favicon or OG image to override the global one for that page and all its children.

This uses a cascade: the nearest ancestor with a favicon/OG image set wins, unless a page sets its own.

### Manual (file-based)

You can also place files directly in any page folder — OpenDoc detects them automatically:

| File | What it does |
|---|---|
| `favicon.ico`, `favicon.svg`, `favicon.png` | Favicon for this page and children |
| `og-image.png`, `og-image.jpg`, `og-image.webp` | OG image for this page and children |

Root-level files apply site-wide.

## Disabling the Editor

Set `editorPath` to `null` in your config to disable the editor entirely. This is useful for production deployments where you want to serve docs without exposing the edit UI.

```json
{
  "title": "My Docs",
  "editorPath": null
}
```
