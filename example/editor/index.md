---
icon: ✏️
---

# Editor

OpenDoc ships with a Notion-style block editor at `/_editor`. Every edit saves automatically and the viewer updates instantly.

## Opening the Editor

Navigate to `http://localhost:3000/editor` while your dev server is running. The editor loads the current page — switch pages using the dropdown in the top bar or the sidebar nav.

## Blocks

Every piece of content is a block. Click anywhere to start typing. Press `/` to insert a new block type.

| Block | Description |
|---|---|
| Paragraph | Default text block |
| Heading 1–3 | Section headings |
| Bulleted list | Unordered list |
| Numbered list | Ordered list |
| Code | Syntax-highlighted code block with language selector |
| Table | Grid with header row support |
| Callout | Highlighted info/tip/warning/error blocks |
| Image | Upload or paste an image |
| Bookmark | Embed a link card with title and description |
| YouTube | Embed a YouTube video by URL |
| Divider | Horizontal rule |

## Page Management

### Creating Pages

Click the **+** button next to any section in the sidebar. Type the page name and press **Enter** — the page is saved to disk immediately and appears in the nav.

Press **Escape** to cancel without creating anything.

### Reordering Pages

Drag any page in the sidebar to reorder it. Drop between items to reorder at the same level.

### Moving Pages

Drag a page and drop it **on top of** another page to nest it underneath. This moves the folder on disk and updates navigation automatically.

### Renaming Pages

Edit the title at the top of the page. The sidebar nav updates in real time. The new name is saved on the next autosave.

## Autosave

Changes are saved automatically 1 second after you stop typing. The top bar shows **Unsaved** while changes are pending and **✓ Saved** when committed to disk.

Press `Cmd+S` (or `Ctrl+S`) to save immediately.

## GitHub Integration

If your docs folder is a Git repo, OpenDoc shows branch and changed-file status in the top bar. Enter a commit message and click **Commit & Push** to publish changes directly to GitHub.

For GitHub-hosted docs, connect your GitHub account via the editor settings to edit and open PRs without running a local server.

## Dark Mode

Toggle dark mode with the sun/moon icon in the top bar. Your preference is saved per browser.
