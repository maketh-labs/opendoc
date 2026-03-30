---
icon: 📝
---

# Writing

OpenDoc renders standard Markdown with several extensions.

## Headings

```markdown
# H1 — Page title (one per page)
## H2 — Major section
### H3 — Subsection
```

## Lists

```markdown
- Unordered item
- Another item
  - Nested item

1. Ordered item
2. Second item
```

## Code

Fenced code blocks with language identifiers get full syntax highlighting:

````markdown
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```
````

Supported languages include TypeScript, JavaScript, Python, Go, Rust, SQL, JSON, Bash, and [many more](https://shiki.style/languages).

## Tables

```markdown
| Name    | Type   | Default |
|---------|--------|---------|
| title   | string | —       |
| icon    | string | —       |
| order   | number | —       |
```

## Callouts

> [!NOTE]
> This is a note callout.

> [!TIP]
> This is a tip.

> [!WARNING]
> This is a warning.

> [!IMPORTANT]
> This is important.

```markdown
> [!NOTE]
> This is a note callout.

> [!TIP]
> This is a tip.

> [!WARNING]
> This is a warning.

> [!IMPORTANT]
> This is important.
```

## Wikilinks

Link to other pages by title using double brackets:

```markdown
See [[Getting Started]] for installation instructions.
See [[Editor]] for how to use the block editor.
```

Wikilinks resolve by matching page titles case-insensitively. If the title changes, update the wikilink to match.

## Backlinks

Every page automatically shows a **Backlinks** panel listing all pages that link to it. No configuration needed — OpenDoc builds the backlink index on every save.

## Images

Place images in an `assets/` folder next to the page's `index.md`:

```
my-page/
├── index.md
└── assets/
    └── screenshot.png
```

Reference them with a relative path:

```markdown
![Screenshot](./assets/screenshot.png)
```

## Frontmatter

Each page can have optional YAML frontmatter:

```yaml
---
icon: 🚀
title: Custom Title
---
```

| Field | Description |
|---|---|
| `icon` | Emoji shown next to the page title in the nav |
| `title` | Override the page title (defaults to the H1) |

## Math

Inline math: $E = mc^2$

Block math:

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

```markdown
Inline: $E = mc^2$

Block:
$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$
```
