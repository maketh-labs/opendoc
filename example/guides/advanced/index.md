# Advanced Usage

Power features for getting the most out of OpenDoc.

## MCP Integration

OpenDoc runs an MCP server on port 3001 alongside your dev server. AI agents can use these tools:

- `read_page(path, tier?)` — read any page at full, context, or context-mini tier
- `search(query)` — full-text search across all pages
- `list_structure()` — get the complete nav tree as JSON
- `get_backlinks(path)` — find all pages linking to a given page
- `get_changelog(path)` — git history for a specific page

## Context Tiers

Each page has three tiers, generated at build time:

| Tier | File | Description |
|---|---|---|
| full | `index.md` | Complete markdown |
| context | `context.md` | Headings, code, lists kept; prose trimmed to first sentence |
| context-mini | `context-mini.md` | H1-H3 headings + one-line summaries |

## Configuration

Optional config lives in `.opendoc/config.json`:

```json
{
  "title": "My Docs",
  "theme": "default",
  "mcp": { "port": 3001 },
  "nav": { "order": ["getting-started", "guides", "api"] }
}
```

## Math & LaTeX

OpenDoc supports inline and block math via KaTeX.

Inline math: The formula is $E = mc^2$ where $c$ is the speed of light.

Block math:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

## Custom Themes

Themes override CSS custom properties. Create `.opendoc/theme.css`:

```css
:root {
  --color-accent: #e63946;
  --font-body: 'Georgia', serif;
}
```
