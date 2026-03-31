---
icon: 🤖
---

# MCP Server

OpenDoc runs an [MCP](https://modelcontextprotocol.io) server alongside the dev server, letting AI agents read and search your docs programmatically.

## How It Works

When you run `opendoc serve`, an MCP server starts automatically on port 3001. Any MCP-compatible client — Claude, Cursor, Cline, Windsurf, etc. — can connect and query your documentation.

MCP endpoint: `http://localhost:3001/mcp`

## Tools

| Tool | Description |
|---|---|
| `read_page` | Read a page's content. Accepts `path` and optional `tier` (`full`, `context`, `context-mini`). |
| `search` | Full-text search across all pages. Returns matching pages with snippets. |
| `list_structure` | Returns the complete nav tree as JSON. |
| `get_backlinks` | Find all pages that link to a given path. |
| `get_changelog` | Git history for a specific page (requires a git repo). |

## Content Tiers

Every page is available at three levels of detail — useful for giving agents the right amount of context without burning tokens:

| Tier | Description |
|---|---|
| `full` | Complete `index.md` content |
| `context` | Headings and code blocks kept, prose trimmed to first sentence per paragraph |
| `context-mini` | H1–H3 headings only with one-line summaries |

## Connecting to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "opendoc": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3001/mcp"]
    }
  }
}
```

## Connecting to Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "opendoc": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

## Example Usage

Once connected, an agent can:

```
list_structure()
→ returns your full nav tree

read_page("getting-started", "context-mini")
→ returns a compact summary of the Getting Started page

search("how to configure themes")
→ returns matching pages with snippets
```

This makes it practical to give an AI agent full access to your documentation as a live knowledge base — useful for building context-aware assistants, onboarding bots, or code agents that understand your project.
