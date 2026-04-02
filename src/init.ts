import { join, resolve, basename } from 'path'
import { mkdir, writeFile, access } from 'fs/promises'
import { execSync } from 'child_process'

const GREEN  = '\x1b[32m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const RESET  = '\x1b[0m'

function ok(msg: string)   { console.log(`${GREEN}✓${RESET} ${msg}`) }
function info(msg: string) { console.log(`${DIM}  ${msg}${RESET}`) }
function log(msg: string)  { console.log(msg) }

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

async function ask(question: string, fallback: string): Promise<string> {
  process.stdout.write(`${question} ${DIM}(${fallback})${RESET} `)
  return new Promise(resolve => {
    let input = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.resume()
    process.stdin.once('data', chunk => {
      process.stdin.pause()
      input = chunk.toString().trim()
      resolve(input || fallback)
    })
  })
}

export async function init(targetDir: string) {
  log('')
  log(`${BOLD}OpenDoc Init${RESET}`)
  log(`${DIM}Set up a new docs project${RESET}`)
  log('')

  // Resolve target directory
  const dir = resolve(targetDir)
  const name = basename(dir)

  // Ask for site title
  const title = await ask('Site title?', name)

  log('')

  // Check if dir already has content
  const alreadyExists = await exists(dir)
  const hasContent = alreadyExists && await exists(join(dir, 'getting-started', 'index.md'))

  if (hasContent) {
    log(`${DIM}  Found existing content — skipping scaffold, only creating opendoc.json${RESET}`)
    log('')
  }

  // Write config
  const configPath = join(dir, 'opendoc.json')
  if (!await exists(configPath)) {
    await mkdir(dir, { recursive: true })
    await writeFile(configPath, JSON.stringify({ title }, null, 2) + '\n')
    ok(`opendoc.json`)
  } else {
    info(`opendoc.json already exists — skipped`)
  }

  if (!hasContent) {
    // Starter page
    await mkdir(join(dir, 'getting-started'), { recursive: true })
    await writeFile(join(dir, 'getting-started', 'index.md'), [
      `---`,
      `icon: 🚀`,
      `---`,
      ``,
      `# Getting Started`,
      ``,
      `This is your first page. Edit it in the [[Editor]] or open \`getting-started/index.md\` in any text editor.`,
      ``,
      `## Next Steps`,
      ``,
      `- [ ] Write your first page`,
      `- [ ] Create a new page with **+** in the sidebar`,
      `- [ ] Customize your theme at \`/_\` → Site Settings`,
    ].join('\n') + '\n')
    ok(`getting-started/index.md`)

    // order.json
    await writeFile(join(dir, 'order.json'), JSON.stringify(['getting-started'], null, 2) + '\n')
    ok(`order.json`)
  }

  // .gitignore
  const gitignorePath = join(dir, '.gitignore')
  if (!await exists(gitignorePath)) {
    await writeFile(gitignorePath, GITIGNORE_CONTENT)
    ok('.gitignore')
  } else {
    info('.gitignore already exists — skipped')
  }

  // CLAUDE.md — AI agent conventions
  const claudePath = join(dir, 'CLAUDE.md')
  if (!await exists(claudePath)) {
    await writeFile(claudePath, CLAUDE_MD_CONTENT)
    ok('CLAUDE.md')
  } else {
    info('CLAUDE.md already exists — skipped')
  }

  // Initialize git if not already in a repo
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' })
    info(`already in a git repo — skipped git init`)
  } catch {
    execSync('git init', { cwd: dir, stdio: 'ignore' })
    ok(`git init`)
  }

  log('')
  log(`${GREEN}${BOLD}Done!${RESET} Your docs are ready.`)
  log('')
  log(`  ${CYAN}${BOLD}cd ${targetDir === '.' ? '' : targetDir}${RESET}`)
  log(`  ${CYAN}${BOLD}bunx opendoc serve${RESET}${DIM}  →  http://localhost:3000${RESET}`)
  log(`  ${CYAN}${BOLD}bunx opendoc serve _${RESET}${DIM}  →  http://localhost:3000/_  (editor)${RESET}`)
  log('')
}

const GITIGNORE_CONTENT = `.DS_Store
node_modules/
dist/
*.swp
*.swo
*~
.env
.env.*
`

const CLAUDE_MD_CONTENT = `# OpenDoc Conventions

This file describes the content model for AI agents working in this repo.

## Page Structure

| Rule | Detail |
|------|--------|
| One page = one folder | Every page is an \`index.md\` inside a named folder |
| Folder name = slug | \`getting-started/index.md\` → URL \`/getting-started\` |
| Title from heading | First \`# Heading\` in the file is the page title |
| No bare \`.md\` files | Never create a loose \`.md\` file — always \`folder/index.md\` |

## Nav Ordering

- Default order: alphabetical by folder name
- Override: add \`order.json\` in any folder with an array of child folder names
- Unlisted folders are appended after ordered items

## Reserved / Internal — Do Not Edit

| Path | Purpose |
|------|---------|
| \`context.md\` | Auto-generated compressed version for MCP |
| \`context-mini.md\` | Auto-generated ultra-compressed version |
| \`assets/\` | Images and attachments (never rendered as pages) |
| \`dist/\` | Static site build output |

## Reserved Names

- \`_\` — reserved (editor route prefix)
- Folders starting with \`.\` — ignored by the walker

## Favicon & OG Image

- Place \`favicon.ico\`, \`favicon.svg\`, \`favicon.png\`, \`og-image.png/jpg/webp\` directly in a page folder
- Inherits upward — root-level files are site-wide defaults

## Wikilinks

- \`[[page-name]]\` links to another page by folder name
- Backlinks are tracked automatically
`

