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

Your docs site opens automatically at `http://localhost:3000`. The editor is at `/_editor`.

## Folder Structure

One rule: every page is an `index.md` inside a named folder. The folder structure becomes your navigation.

```
my-docs/
├── getting-started/
│   └── index.md          → /getting-started
├── guides/
│   ├── index.md          → /guides
│   └── advanced/
│       └── index.md      → /guides/advanced
└── reference/
    └── index.md          → /reference
```

> [!NOTE]
> There is no root `index.md`. The docs root redirects to your first page automatically.

## Create Your First Page

In the editor at `/_editor`, click **New Page** in the sidebar. Type the page name and press Enter — the page is created and opened immediately.

Or create it manually:

```bash
mkdir my-docs/my-page
echo "# My Page\n\nHello, world!" > my-docs/my-page/index.md
```

The dev server picks up the change instantly.

## What's Next

- [[Editor]] — learn the block editor
- [[Writing]] — markdown, callouts, wikilinks, and more
- [[Configuration]] — config file, themes, page ordering
