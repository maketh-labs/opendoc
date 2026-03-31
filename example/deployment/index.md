---
icon: 🚢
---

# Deployment

Build your docs into a static site and deploy anywhere.

## Build

```bash
opendoc build ./my-docs
```

This generates a complete static site in `my-docs/.opendoc/dist/`. The output is plain HTML, CSS, and JS — no server required to serve it.

## Deploy to Vercel

```bash
cd my-docs
vercel deploy .opendoc/dist
```

Or configure your Vercel project to build automatically on push:

- **Build command:** `bunx opendoc build ./docs`
- **Output directory:** `docs/.opendoc/dist`

## Deploy to Netlify

Drop the `.opendoc/dist` folder into [app.netlify.com/drop](https://app.netlify.com/drop), or configure your build:

```toml
# netlify.toml
[build]
  command = "bunx opendoc build ./docs"
  publish = "docs/.opendoc/dist"
```

## Deploy to GitHub Pages

```yaml
# .github/workflows/docs.yml
name: Deploy Docs
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bunx opendoc build ./docs
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/.opendoc/dist
```

## Self-Host with Live Editor

The dev server (`opendoc serve`) is production-capable for small teams. Run it behind a reverse proxy to get the live editor in production — team members can edit docs directly from the browser.

```nginx
server {
  listen 80;
  server_name docs.example.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
  }
}
```

> [!TIP]
> To disable the editor on the public-facing site, set `"editorPath": null` in `.opendoc/config.json`. See [[Configuration]] for details.

## What Gets Built

The build output in `.opendoc/dist/` contains:

- One HTML file per page (with favicon and OG image tags resolved)
- Theme CSS and client JS
- All assets (images, PDFs, etc.) copied verbatim
- `context.md` and `context-mini.md` per page (for MCP)

The output is fully static — no Node.js or Bun required to serve it.
