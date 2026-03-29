# Guides

In-depth guides to get the most out of OpenDoc.

## Available Guides

- **[[Advanced]]** — Advanced configuration, theming, and MCP integration
- **Wikilinks** — Link between pages using `[[page name]]` syntax
- **Backlinks** — Every page shows what links to it
- **MCP Server** — AI agents can query your docs via the built-in MCP server

## Directory Structure

OpenDoc follows one simple rule: every page is an `index.md` inside a named folder. The folder structure becomes your navigation.

## Code Blocks

OpenDoc renders fenced code blocks with VSCode-accurate syntax highlighting. Pick any language with the selector.

```python
import os
from pathlib import Path

def walk_docs(root: str) -> list[dict]:
    """Walk a docs folder and return all index.md pages."""
    pages = []
    for dirpath, _, files in os.walk(root):
        if "index.md" in files:
            path = Path(dirpath) / "index.md"
            rel = path.relative_to(root)
            pages.append({
                "path": str(rel),
                "url": "/" + str(rel.parent).replace("\\", "/"),
                "content": path.read_text(),
            })
    return pages

if __name__ == "__main__":
    docs = walk_docs("./example")
    for page in docs:
        print(f"{page['url']} → {page['path']}")
```

## Themes

OpenDoc ships with a clean default theme built on CSS custom properties. Dark mode is automatic based on system preferences, with a manual toggle available.
