---
icon: 🚀
---

# Getting Started

Get a docs site running in under a minute.

## Install

```bash
bun add -g opendoc
```

Or run without installing:

```bash
bunx opendoc serve ./my-docs
```

## Run the Dev Server

Point OpenDoc at any folder of markdown files:

```bash
opendoc serve ./my-docs
```

Your docs site opens at `http://localhost:3000`. The editor is at `http://localhost:3000/_`.

## Folder Structure

Every page is an `index.md` inside a named folder. The folder structure becomes your navigation.

```
my-docs/
├── index.md                  → / (home page)
├── getting-started/
│   └── index.md              → /getting-started
├── guides/
│   ├── index.md              → /guides
│   └── advanced/
│       └── index.md          → /guides/advanced
└── reference/
    └── index.md              → /reference
```

## Create Your First Page

Open the editor at `/_` and click **+** in the sidebar. Type the page name and press **Enter** — it's created and opened immediately.

Or create it manually:

```bash
mkdir my-docs/my-page
echo "# My Page\n\nHello, world!" > my-docs/my-page/index.md
```

The dev server picks up the change instantly — no restart needed.

## Site Settings

Go to `/_` to open site settings. From there you can set:

- **Site title** — shown in the browser tab and sidebar header
- **Favicon** — applied to all pages (individual pages can override this)
- **OG image** — default social share image for all pages

## What's Next

- [[Editor]] — the block editor and everything it can do
- [[Writing]] — markdown, callouts, wikilinks, and more
- [[Configuration]] — config file, themes, page ordering
