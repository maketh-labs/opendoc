--- icon: 🚀 title: Getting Started ---

# Getting Started

Get up and running with OpenDoc in under a minute.

## Installation

```bash
npx opendoc serve
```
That's it.

> [!TIP] > You can also install OpenDoc globally with `bun add -g opendoc` for easier access.

## Create Your First Page

Every page is an `index.md` inside a folder:

```
my-docs/
├── index.md                 ← home page
├── getting-started/
│   └── index.md             ← this page
└── guides/
    └── index.md             ← /guides
```
> [!NOTE] > Only `index.md` files are rendered as pages.

## Build for Production

```bash
npx opendoc build
```
This generates a static site in `.opendoc/dist/` that you can deploy anywhere.

> [!WARNING] > Make sure your content directory doesn't contain sensitive files — everything in the folder will be included in the build output.

## Images

You can include images by placing them in an `assets/` folder next to your `index.md`:

![Placeholder image](./assets/placeholder.png) *An example asset referenced from the page*

## What's Next

Check out the [[Guides]] for more detailed walkthroughs on theming, MCP integration, and advanced features.
