# OpenDoc Spec

> Git-native docs and wiki tool. Replaces GitBook and Obsidian. Zero database. MCP-native. Agent-ready.

---

## What It Is

OpenDoc turns any folder of markdown files into a beautiful, searchable docs site or personal wiki. It runs locally, deploys statically, and exposes an MCP server so AI agents can read and write your docs.

No database. No accounts. No lock-in. Your docs are just files in a git repo. If you stop using OpenDoc tomorrow, your files are just files. Nothing is lost.

---

## Core Principles

1. **Git is the backend.** Branching, history, versioning, collaboration — git already does all of this.
2. **Files are the data model.** Folder structure = nav structure. File path = URL. No database layer.
3. **Static by default.** Build output is plain HTML/CSS/JS. Deployable anywhere.
4. **Agent-first, human-friendly.** MCP and context files are first-class, not bolt-ons.
5. **Zero config to start.** `npx opendoc` on any markdown folder should just work.
6. **One rule, no exceptions.** Convention over configuration. Predictable beats flexible.

---

## Directory Structure

### Content repo (yours)

Every page is an `index.md` inside a folder named after the page. This is the only rule.

```
my-docs/
├── index.md                        ← home page (/)
├── getting-started/
│   └── index.md                    ← /getting-started
├── guides/
│   ├── index.md                    ← /guides
│   └── advanced/
│       └── index.md                ← /guides/advanced
├── api/
│   └── index.md                    ← /api
└── .opendoc/
    ├── config.json                 ← optional config
    ├── theme.css                   ← optional theme override
    └── dist/                       ← build output (gitignored)
```

### Page folder contents

Each page folder can contain:

```
guides/
├── index.md            ← the page (served to humans)
├── context.md          ← compressed version (MCP only, never served)
├── context-mini.md     ← ultra-compressed version (MCP only, never served)
└── assets/
    └── diagram.png     ← assets (never a page)
```

**Only `index.md` is ever rendered as a page.** Everything else in a folder is internal. No ignore lists, no config — the convention itself is the protection. `context.md` and `context-mini.md` are invisible to the static site build.

---

## File Naming Rules

| File | Visibility | Purpose |
|---|---|---|
| `index.md` | Public — rendered as a page | Human-readable content |
| `context.md` | Internal — MCP only | Compressed for agent reasoning |
| `context-mini.md` | Internal — MCP only | Ultra-compressed, minimal tokens |
| `assets/*` | Internal — referenced only | Images, diagrams, attachments |
| `.opendoc/` | Internal | Config and build output |

---

## Feature Set

### v1 — Core

- Walk directory tree → generate sidebar nav from folder structure
- Render `index.md` → HTML (with syntax highlighting)
- `[[wikilink]]` support with path resolution
- Backlinks index (built at build time)
- Client-side full-text search (Pagefind)
- Dev server with hot reload (`opendoc serve`)
- Static site build (`opendoc build`)
- Dark/light mode
- Clean, readable typography
- GitHub Action template for auto-deploy

### v1 — MCP Server

Runs on `:3001` alongside the static site. Read-only in v1.

```
tools:
  read_page(path, tier?)         → content at tier: 'full' | 'context' | 'context-mini'
  search(query, limit?)          → matching pages with snippets
  list_structure()               → full nav tree as JSON
  get_backlinks(path)            → pages that link to this page
  get_changelog(path, limit?)    → git log for a specific file
```

### v1 — Context Files (Compression)

Three tiers per page, generated at build time. No LLM calls. Pure text processing. Deterministic.

| Tier | File | Description |
|---|---|---|
| `full` | `index.md` | Complete markdown, as written |
| `context` | `context.md` | Headings, code blocks, lists kept. Body prose stripped to first sentence per paragraph. |
| `context-mini` | `context-mini.md` | H1–H3 headings only + one-line summary per section. |

MCP `read_page` accepts a `tier` parameter and returns the appropriate file. All tiers are pre-built and static — zero inference cost at read time.

---

### v2 — Themes

- Theme system based on CSS custom properties
- Official theme template repo: `github.com/opendoc-sh/theme-template`
- Community themes via GitHub forks, discovered through GitHub API
- `theme.json` manifest required for gallery listing:
  ```json
  {
    "name": "Theme Name",
    "author": "username",
    "description": "Clean minimal look",
    "tags": ["minimal", "dark", "serif"],
    "preview": "preview.png",
    "version": "1.0.0"
  }
  ```
- GitHub device flow auth → unlocks full gallery (5,000 req/hr vs 60 unauthed)
- Token stored locally in `~/.opendoc/config.json`, never leaves machine

Themes are CSS custom property overrides only. Cannot affect layout or inject scripts. Safe to apply from untrusted forks.

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f8f8f8;
  --color-text: #1a1a1a;
  --color-muted: #666666;
  --color-accent: #0066ff;
  --color-border: #e5e5e5;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-size-base: 16px;
  --line-height-body: 1.7;
  --sidebar-width: 260px;
  --content-max-width: 720px;
  --border-radius: 6px;
}
```

### IDE-Style Layout

The OpenDoc UI is IDE-inspired with collapsible sidebars:

```
┌──────────────────────────────────────────────────────┐
│ [≡] OpenDoc          [◁ pages] [themes ▷]            │  ← header bar with sidebar toggles
├─────────┬────────────────────────────┬───────────────┤
│  LEFT   │                            │     RIGHT     │
│ SIDEBAR │        CONTENT             │    SIDEBAR    │
│         │                            │               │
│  Nav    │   Page renders here        │  Theme panel  │
│  Pages  │                            │  CSS editor   │
│  Tree   │                            │               │
└─────────┴────────────────────────────┴───────────────┘
```

Sidebars are toggled by buttons in the header. State persisted in localStorage.

### Right Sidebar — Theme Panel

The right sidebar has three sections:

**1. Theme Gallery**
- Search input with keyword filtering (searches name, description, tags)
- Grid of theme cards — name, author, tag chips, mode badge (`light` / `dark` / `both`)
- Click a card → applies theme live to the page instantly (no reload)
- "Cancel" button → reverts to previous theme
- "Save" button → writes theme to `.opendoc/config.json`, locks it in
- Unauthenticated: shows bundled themes only
- Authenticated (GitHub): fetches community forks from GitHub API

**2. CSS Customizer**
- Collapsible section below the gallery: "Customize"
- Monaco-style code editor (or simple textarea with monospace) showing current CSS variables
- If theme supports `both` modes: tabs to switch between editing light and dark variables
- Live: edits apply to the page in real time as you type
- Reset button → reverts to theme defaults
- Copy button → copies the CSS block to clipboard
- Save → same as above, writes to config

**3. Favicon Generator**
- Collapsible section: "Favicon"
- Upload a 512×512 PNG or SVG
- All resizing and format generation happens in the browser via Canvas API — no server
- Generates:
  - `favicon.ico` (multi-size: 16, 32, 48px)
  - `favicon-16x16.png`
  - `favicon-32x32.png`
  - `apple-touch-icon.png` (180×180)
  - `android-chrome-192x192.png`
  - `android-chrome-512x512.png`
  - `site.webmanifest`
  - Full HTML `<head>` meta tag block (copy/paste ready)
- Files saved to `.opendoc/favicons/` and automatically included in build output
- Meta tags injected into `template.html` at build time

### Theme Light/Dark Mode

Each theme declares a `mode`:

```typescript
type ThemeMode = "light" | "dark" | "both"

interface Theme {
  id: string
  name: string
  author: string
  description: string
  tags: string[]
  mode: ThemeMode       // "light" | "dark" | "both"
  css: string           // light CSS variables (or fixed if mode !== "both")
  darkCss?: string      // dark CSS variables (only if mode === "both")
  source?: string
}
```

**Mode behavior:**
- `"both"` — theme has light + dark variable sets; dark mode toggle is shown; system preference respected
- `"light"` — theme is fixed light; dark mode toggle hidden; `[data-theme="dark"]` never applied
- `"dark"` — theme is fixed dark; dark mode toggle hidden; always dark

**CSS structure for `"both"` themes:**
```css
/* Light mode */
:root {
  --od-color-bg: #ffffff;
  --od-color-text: #1a1a1a;
  /* ... */
}

/* Dark mode */
[data-theme="dark"] {
  --od-color-bg: #0f0f0f;
  --od-color-text: #e5e5e5;
  /* ... */
}
```

**Built-in themes and their modes:**
| Theme | Mode |
|---|---|
| `default` | `both` |
| `clean` | `both` |
| `prose` | `both` |
| `dark` | `dark` (fixed) |
| `mono` | `dark` (fixed) |

### v2 — MCP Writes

- `write_page(path, content)` — creates/updates a page, auto-commits to git
- `create_page(path, title)` — scaffolds a new page with empty `index.md`
- Every agent write = a git commit with attribution
- Full audit trail of what every agent touched

### v2 — Git Versioning UI

- Browse docs at any git tag or branch
- Version switcher in sidebar
- Powered by `simple-git`

### v2 — Plugins

Plugin API deferred to v2. Patterns will be extracted from real v1 usage before the API is designed.

```json
// .opendoc/config.json — v2
{
  "plugins": [
    "opendoc-plugin-mermaid",
    "opendoc-plugin-callouts"
  ]
}
```

Internally, the remark/rehype pipeline is built to be pluggable from day one — just not exposed yet.

---

### v3 — Desktop App

- Tauri wrapper around the CLI
- Double-click to open a folder as a wiki
- System tray: start/stop server
- Target: non-technical users, Obsidian refugees

### v3 — Hosted Service (opendoc.app)

- Connect a GitHub repo → get a hosted URL
- Open source core, paid hosting
- Auth already solved via GitHub device flow

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Bun | Fast, single binary potential |
| Dev server / build | Vite | HMR + static build, no framework opinions |
| Markdown pipeline | unified + remark + rehype | Composable, pluggable |
| Search | Pagefind | Indexes at build time, zero server |
| MCP | @modelcontextprotocol/sdk | Official SDK |
| Git | simple-git | Clean Node API over git |
| UI | Vanilla JS + CSS | No framework weight, full control |
| Desktop (v3) | Tauri | Lightweight native wrapper |

---

## CLI Interface

```bash
npx opendoc serve          # Start dev server + MCP server
npx opendoc build          # Build static site to .opendoc/dist
npx opendoc login          # GitHub device flow auth
npx opendoc themes         # Browse and apply themes
```

---

## Config (.opendoc/config.json) — all optional

```json
{
  "title": "My Docs",
  "theme": "default",
  "editorPath": "/editor",
  "github": {
    "repo": "owner/repo-name",
    "branch": "main"
  },
  "mcp": {
    "port": 3001
  },
  "nav": {
    "order": ["getting-started", "guides", "api"]
  }
}
```

### `editorPath`

Controls where the editor is mounted. Defaults to `"/editor"` if not set.

```json
{ "editorPath": "/editor" }      // default — editor at /editor
{ "editorPath": "/admin/edit" }  // custom path
{ "editorPath": null }           // editor disabled — route not built, page not served
```

If `editorPath` is `null` or the key is absent with explicit `null`, the builder skips generating the editor HTML entirely. The site cannot be used as an editor. Useful for public-facing sites where you don't want anyone attempting to use the editor interface.

New projects are initialized with `"editorPath": "/editor"` by default.

### `github`

Tells the editor which repo and branch to target.

```json
{
  "github": {
    "repo": "owner/repo-name",   // required for pre-configured editing
    "branch": "main"             // optional, defaults to "main"
  }
}
```

**Behavior:**
- If `github.repo` is set: editor skips the repo picker and goes straight to editing that repo
- If not set: editor shows a repo picker (lists user's GitHub repos after login)
- Either way, GitHub permissions are the access control — if the user lacks write access, Save fails gracefully

**Every OpenDoc site is a universal editor.** The same `/editor` URL that serves on `docs.myproject.com` works for editing any repo the logged-in user has access to. `github.repo` just sets the default.

---

## Deployment Targets

- **GitHub Pages** — push `.opendoc/dist`, done
- **Netlify / Vercel / Cloudflare Pages** — connect repo, build command: `npx opendoc build`
- **Self-hosted** — any static file server
- **Local only** — `npx opendoc serve`, never build

---

## Build Output (dist)

`opendoc build` writes everything needed to `.opendoc/dist/`. The dist folder is fully self-contained — no source files needed at runtime.

```
.opendoc/dist/
├── getting-started/
│   ├── index.html          ← rendered page (served to browser)
│   ├── index.md            ← raw source (served to editor + MCP)
│   ├── context.md          ← MCP tier 2 (served to agents)
│   └── context-mini.md     ← MCP tier 3 (served to agents)
├── assets/                 ← copied as-is
├── _opendoc/
│   ├── nav.json            ← pre-built full nav tree
│   ├── backlinks.json      ← pre-built backlinks index
│   └── search-index/       ← Pagefind search index
├── theme.css               ← active theme
└── app.js                  ← client bundle
```

**Why copy `.md` files to dist:**
- Editor pre-populates from `index.md` — no GitHub API call needed for reads
- MCP server reads from dist when deployed remotely — no source directory needed
- Faster: static file serve vs runtime processing
- Everything needed for the full experience ships in one folder

---

## Editor (`/editor`)

A browser-based markdown editor accessible at any OpenDoc URL:

```
localhost:3000/editor              ← local dev
docs.myproject.com/editor          ← self-hosted production
opendoc.sh/editor                  ← hosted service
```

All three are the same editor. All three commit to the same GitHub repo. The editor doesn't care where it's running — it talks to GitHub directly, not to the local filesystem or server.

### Auth flow

GitHub OAuth via a Cloudflare Worker (~20 lines, free tier):

```
Browser → CF Worker (exchanges code → token) → GitHub
Token returned to browser, stored in localStorage
All subsequent API calls go browser → GitHub directly
Server never stores tokens
```

### Save / commit flow

```
User edits index.md in browser
User clicks Save
  → if MCP reachable: call generate_commit_message(path, before, after)
    → agent reads diff, returns: "docs: update getting started guide"
  → if MCP not reachable: message = "edit({path}): {ISO timestamp}"
  →  GitHub Contents API: PUT /repos/{owner}/{repo}/contents/{path}
     with base64 content + current file SHA
  → commit created under user's GitHub identity
  → GitHub Action triggers → site rebuilds → production updated
```

Save = deployed. No deploy button. No CMS publish workflow.

### The loop

```
Open /editor (anywhere)
→ GitHub login → pick repo (or create one)
→ edit a page → click Save
→ commit to GitHub → Action triggers → site rebuilt → live
```

Works from phone, from a team member with no dev setup, from an agent via MCP writes. Repo is the single source of truth. Editor is just a UI for committing to it.

### v2 MCP tool additions

```
generate_commit_message(path, before, after) → string
write_page(path, content)                    → commits via GitHub API
create_page(path, title)                     → scaffolds + commits
```

---

## What This Is Not

- Not a CMS (no admin UI, no user accounts in the core)
- Not a database-backed wiki
- Not a blogging platform
- Not a replacement for GitHub itself

---

## Success Metrics (v1 launch)

- `npx opendoc serve` works on any markdown folder in under 5 seconds
- MCP server passes Claude/Cursor tool call tests
- At least 3 built-in themes
- GitHub Action template included
- Editor opens, authenticates, and commits successfully
- Twitter demo: repo → docs site → browser edit → live in 60 seconds
