---
icon: ✏️
---

# Editor

OpenDoc ships with a Notion-style block editor at `/_`. Every change saves automatically and the viewer updates instantly.

## Opening the Editor

Navigate to `/_` while your dev server is running. The site settings panel opens by default.

To edit a specific page, click it in the sidebar — the URL updates to `/_/<page-path>` and the editor loads that page.

## Site Settings

Click the **site name** at the top of the sidebar to open site settings:

* **Site title** — the name shown in the browser tab and sidebar

* **Favicon** — global favicon applied to all pages

* **OG image** — default social share image for all pages

## Page Settings

### hello

Click the **page icon** (📄) in the top bar to open settings for the current page:

* **Favicon** — overrides the global favicon for this page and its children

* **OG image** — overrides the global OG image for this page and its children

Favicons and OG images cascade: a folder's settings apply to all its children unless a child sets its own.

## Blocks

Every piece of content is a block. Click anywhere to start typing. Press `/` to open the block picker.

| Block           | Description                                  |
| --------------- | -------------------------------------------- |
| Paragraph       | Default text block                           |
| Heading 1–3     | Section headings                             |
| Bulleted list   | Unordered list                               |
| Numbered list   | Ordered list                                 |
| To-do list      | Checkbox items                               |
| Code            | Syntax-highlighted code block                |
| Quote           | Block quote                                  |
| Callout         | Info / tip / warning / danger blocks         |
| Table           | Grid with header row support                 |
| Image           | Upload or paste an image                     |
| Bookmark        | Embed a link card with title and description |
| YouTube / Embed | Embed a YouTube, Vimeo, or Loom video        |
| Divider         | Horizontal rule                              |

## Code Blocks

Code blocks have a toolbar in the top-right corner (visible on hover):

* **Language selector** — click to change the syntax highlighting language

* **Copy button** — copies the code to clipboard with a checkmark confirmation

## Page Management

### Creating Pages

Click **+** next to any section in the sidebar. Type the page name and press **Enter**.

### Reordering Pages

Drag any page in the sidebar to reorder it. Drop between items to reorder at the same level.

### Moving Pages

Drag a page and drop it **on top of** another page to nest it underneath.

### Renaming Pages

Edit the title at the top of the page. The sidebar nav updates in real time.

### Deleting Pages

Right-click any page in the sidebar (or click **⋯**) → **Delete**. Confirms before deleting.

## Autosave

Changes save automatically 1 second after you stop typing. The top bar shows the save state.

Press `Cmd+S` / `Ctrl+S` to save immediately.

## Git Integration

If your docs folder is a Git repo, OpenDoc shows branch and changed-file count in the top bar. Enter a commit message and click **Commit & Push** to publish directly to GitHub.

## Dark Mode

Toggle dark mode with the sun/moon icon in the top bar. Your preference is saved per browser.

## Theme Customization

Click the **palette icon** (🎨) in the top bar to open the theme panel. Customize colors, fonts, sizes, and border radius with a live preview. Click **Save** to write the theme to `.opendoc/theme.css`.

See [[Configuration]] for the full theme system and community themes.