# Advanced Usage

Power features for getting the most out of OpenDoc.

## MCP Integration

OpenDoc runs an MCP server on port 3001 alongside your dev server.

## Context Tiers

Each page has three tiers, generated at build time: | Tier | File | Description | |---|---|---| | full | `index.md` | Complete markdown | | context | `context.md` | Headings, code, lists kept; prose trimmed to first sentence | | context-mini | `context-mini.md` | H1-H3 headings + one-line summaries |

## Configuration

Optional config lives in `.opendoc/config.json`: { "title": "My Docs", "theme": "default", "mcp": { "port": 3001 }, "nav": { "order": ["getting-started", "guides", "api"] } }

## Custom Themes

Themes override CSS custom properties.
