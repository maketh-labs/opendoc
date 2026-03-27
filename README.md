# OpenDoc

**Your docs are just markdown files. Stop paying for a platform to render them.**

OpenDoc turns any folder of markdown files into a beautiful, searchable docs site — with a built-in MCP server so AI agents can read and write your docs too. Self-hosted. Zero database. Open source.

```bash
npx opendoc serve
```

That's it. Docs site on `:3000`. MCP server on `:3001`. No config needed.

---

## Why OpenDoc

**GitBook** charges $8–40/month to render your markdown. Your content, their lock-in.

**Obsidian Sync** charges $8/month to sync files you already own.

**OpenDoc** is free. Your files stay files. Git is the backend. There's nothing to migrate away from because there's nothing to migrate to — it just reads your existing markdown folder.

---

## Features

- **Zero config** — point it at any markdown folder and it works
- **Folder structure = nav** — no config files, no sidebar YAML, just folders
- **`[[Wikilinks]]`** — link between pages naturally, backlinks tracked automatically
- **Full-text search** — client-side, no server required
- **MCP server** — AI agents can read, search, and navigate your docs natively
- **Context tiers** — each page has compressed versions for token-efficient agent access
- **Git-native versioning** — history, blame, and changelogs come free with git
- **Themes** — CSS custom property based, community themes via GitHub forks
- **Dark mode** — system-aware with manual toggle
- **Static builds** — deploy to GitHub Pages, Netlify, Vercel, or anywhere

---

## How it works

**One rule: every page is an `index.md` inside a named folder.**

```
my-docs/
├── index.md                      ← /
├── getting-started/
│   └── index.md                  ← /getting-started
├── guides/
│   ├── index.md                  ← /guides
│   └── advanced/
│       └── index.md              ← /guides/advanced
└── .opendoc/
    └── config.json               ← optional
```

No special filenames. No front matter required. No config to write. Folder name becomes the URL. First `# Heading` becomes the page title.

---

## MCP Server

OpenDoc runs an MCP server on `:3001` alongside your docs. Point Cursor, Claude, or any MCP-compatible agent at it:

```json
{
  "mcpServers": {
    "opendoc": {
      "url": "http://localhost:3001"
    }
  }
}
```

**Available tools:**

| Tool | Description |
|---|---|
| `read_page(path, tier?)` | Read a page. `tier`: `full` \| `context` \| `context-mini` |
| `search(query)` | Full-text search across all pages |
| `list_structure()` | Full nav tree as JSON |
| `get_backlinks(path)` | Pages that link to this page |
| `get_changelog(path)` | Git history for a page |

---

## Context Tiers

Every page has three representations, generated at build time. No LLM calls. No inference cost.

Each page folder:
```
getting-started/
├── index.md          ← humans read this (full content)
├── context.md        ← agents read this (compressed)
└── context-mini.md   ← agents read this when token budget is tight
```

**`context.md`** — headings, code blocks, and lists preserved; prose stripped to first sentence per paragraph.

**`context-mini.md`** — headings only + one-line summary per section.

Agents request the tier they need. `read_page("/getting-started", "context-mini")` returns the minimal version.

---

## CLI

```bash
npx opendoc serve [dir]    # Dev server + MCP server (default: current directory)
npx opendoc build [dir]    # Build static site to .opendoc/dist
npx opendoc login          # GitHub auth for theme gallery (coming soon)
npx opendoc themes         # Browse community themes (coming soon)
```

---

## Config

Everything is optional. Drop a `.opendoc/config.json` if you need it:

```json
{
  "title": "My Docs",
  "theme": "default",
  "mcp": {
    "port": 3001
  },
  "nav": {
    "order": ["getting-started", "guides", "api"]
  }
}
```

---

## Install

```bash
# With npm/npx
npx opendoc serve

# With Bun (fastest, no download wait)
bunx opendoc serve
```

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/maketh-labs/opendoc&project-name=my-docs&build-command=bunx+opendoc+build&output-directory=.opendoc/dist)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/maketh-labs/opendoc)

**GitHub Pages:**
Add `.github/workflows/opendoc.yml`:
```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx opendoc build
      - uses: actions/deploy-pages@v4
        with:
          folder: .opendoc/dist
```

**Netlify / Vercel / Cloudflare Pages:**
Set build command to `npx opendoc build` and publish directory to `.opendoc/dist`.

**Local only:**
`npx opendoc serve` — no build step, no deploy, just open a browser.

---

## Themes

Themes are CSS custom property overrides. Fork the [theme template](https://github.com/opendoc-sh/theme-template), change the values, and your theme appears in the gallery.

No approval process. No marketplace. Just GitHub forks.

---

## Self-host

OpenDoc has no backend to host. `opendoc build` produces static HTML. Put it anywhere.

If you want the MCP server available remotely, run `opendoc serve` on your server and expose port `3001`.

---

## License

MIT — do whatever you want with it.

---

**[opendoc.sh](https://opendoc.sh)** · [GitHub](https://github.com/opendoc-sh/opendoc) · Built by [Mansa Company](https://mansa.company)
