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
  "theme": "default",
  "editor": {
    "path": "/_editor"
  },
  "github": {
    "repo": "your-org/your-repo",
    "branch": "main",
    "clientId": "your-oauth-app-client-id"
  }
}
```

| Field | Default | Description |
|---|---|---|
| `title` | `"OpenDoc"` | Site title shown in the browser tab |
| `theme` | `"default"` | Theme name |
| `editor.path` | `"/_editor"` | URL path for the editor. Set to `null` to disable. |
| `github.repo` | — | GitHub repo for the GitHub editor integration |
| `github.branch` | `"main"` | Branch to read/write from |
| `github.clientId` | — | GitHub OAuth App client ID for auth |

## Page Ordering

By default, pages are sorted alphabetically. To set an explicit order, create an `order.json` in any directory:

```json
["getting-started", "editor", "writing", "configuration", "mcp", "deployment"]
```

Each entry is the folder name of a child page. Folders not listed are appended alphabetically after the listed ones.

You can also reorder pages by dragging them in the editor sidebar — this writes `order.json` automatically.

## Themes

OpenDoc's default theme is built on CSS custom properties. Override any variable by creating `.opendoc/theme.css` in your docs root:

```css
:root {
  --color-accent: #7c3aed;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

The theme panel in the editor (⚙️ icon in the top bar) lets you customize colors and preview changes live.

## Ignoring Files

OpenDoc only renders `index.md` files. Any other files in your docs folder (images, PDFs, data files) are served as static assets but not rendered as pages.

The following are always ignored:

- `node_modules/`
- `.opendoc/` (internal build output)
- `assets/` directories (served as static files)
- Dotfiles and dotfolders
