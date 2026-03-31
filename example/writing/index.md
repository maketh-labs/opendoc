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

- [ ] Unchecked to-do
- [x] Checked to-do
```

## Code

Fenced code blocks with language identifiers get full syntax highlighting via Shiki. Every code block in the viewer has a **copy button** that appears on hover.

````markdown
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`
}
```
````

Supported languages include TypeScript, JavaScript, Python, Go, Rust, SQL, JSON, Bash, CSS, HTML, and [many more](https://shiki.style/languages).

## Tables

```markdown
| Name  | Type   | Required |
|-------|--------|----------|
| title | string | No       |
| icon  | string | No       |
```

## Callouts

```markdown
> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!IMPORTANT]
> Key information users need to succeed.
```

Renders as:

> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!IMPORTANT]
> Key information users need to succeed.

Available types: `NOTE`, `TIP`, `WARNING`, `IMPORTANT`, `CAUTION`.

You can also insert callouts from the editor using the `/` block menu.

## Wikilinks

Link to other pages by title using double brackets:

```markdown
See [[Getting Started]] for installation.
See [[Configuration]] for theme options.
```

Wikilinks resolve by matching page titles case-insensitively.

## Backlinks

Every page automatically shows a **Backlinks** section listing all pages that link to it. OpenDoc builds the backlink index on every save — no configuration needed.

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

In the editor, paste or drag an image directly — it uploads automatically.

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
| `icon` | Emoji shown next to the page title in the nav and at the top of the page |
| `title` | Override the page title (defaults to the first H1) |
