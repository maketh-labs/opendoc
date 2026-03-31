---
icon: 📖
---

# OpenDoc

A Notion-style docs and wiki tool with a block editor, full theming, and an MCP server for AI agents.

## Quick Start

```bash
bun add -g opendoc
opendoc init ./my-docs
opendoc serve ./my-docs
```

Open `http://localhost:3000` to read, `http://localhost:3000/_` to edit.

## Features

- **Block editor** — Notion-style editing with `/` commands, callouts, code blocks, tables
- **Git-native** — your docs are plain markdown files; commit and push from the editor
- **Full theming** — every CSS value is a custom property, override with `.opendoc/theme.css`
- **MCP server** — AI agents can read and search your docs at `http://localhost:3001/mcp`
- **Static build** — export to plain HTML/CSS/JS and deploy anywhere

→ [[Getting Started]]
