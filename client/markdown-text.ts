// Pure text helpers for the markdown ⇄ BlockNote round-trip.
// Kept free of BlockNote/DOM imports so they can be unit-tested directly.

export type CalloutKind = 'info' | 'note' | 'tip' | 'warning' | 'caution' | 'important' | 'danger'

export type MarkdownPart =
  | { type: 'text'; text: string }
  | { type: 'callout'; calloutType: CalloutKind; content: string }

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/
const CALLOUT_RE = /^>\s*\[!(INFO|NOTE|TIP|WARNING|CAUTION|IMPORTANT|DANGER)\][ \t]*(.*)$/i

/** Split markdown into alternating prose / fenced-code segments. */
export function splitFencedCode(md: string): Array<{ code: boolean; text: string }> {
  const segments: Array<{ code: boolean; text: string }> = []
  const lines = md.split('\n')
  let buf: string[] = []
  let fence: { char: string; len: number } | null = null

  const flush = (code: boolean) => {
    if (buf.length) segments.push({ code, text: buf.join('\n') })
    buf = []
  }

  for (const line of lines) {
    const m = line.match(FENCE_RE)
    if (!fence && m) {
      flush(false)
      fence = { char: m[1]![0]!, len: m[1]!.length }
      buf.push(line)
    } else if (fence && m && m[1]![0] === fence.char && m[1]!.length >= fence.len && line.trim() === m[1]) {
      buf.push(line)
      flush(true)
      fence = null
    } else {
      buf.push(line)
    }
  }
  flush(fence !== null)
  return segments
}

/** Apply `fn` to text outside inline code spans. */
function mapOutsideInlineCode(text: string, fn: (s: string) => string): string {
  let out = ''
  let last = 0
  const re = /(?<!`)(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    out += fn(text.slice(last, m.index)) + m[0]
    last = m.index + m[0].length
  }
  return out + fn(text.slice(last))
}

/** Apply `fn` to prose only — fenced code blocks and inline code are left untouched. */
export function mapOutsideCode(md: string, fn: (s: string) => string): string {
  return splitFencedCode(md)
    .map(seg => (seg.code ? seg.text : mapOutsideInlineCode(seg.text, fn)))
    .join('\n')
}

// encodeURIComponent leaves ( ) ! ' * unescaped — parentheses would end a markdown link href.
function encodeWl(s: string): string {
  return encodeURIComponent(s).replace(/[()!'*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function escapeLabel(s: string): string {
  return s.replace(/([\\[\]])/g, '\\$1')
}

function unescapeLabel(s: string): string {
  return s.replace(/\\([\\[\]])/g, '$1')
}

// Convert [[wiki links]] to markdown links for BlockNote, preserving round-trip.
// They are encoded as /wl/Page%20Name[%23anchor] so BlockNote treats them as valid links.
export function preProcessWikiLinks(md: string): string {
  return mapOutsideCode(md, text =>
    text.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, page: string, anchor?: string, label?: string) => {
      const display = label || page
      const anchorPart = anchor ? '%23' + encodeWl(anchor) : ''
      return `[${escapeLabel(display)}](/wl/${encodeWl(page.trim())}${anchorPart})`
    }),
  )
}

// Convert /wl/... hrefs back to [[wiki link]] syntax.
export function postProcessWikiLinks(md: string): string {
  return mapOutsideCode(md, text =>
    text.replace(/\[((?:\\.|[^\]\\])+)\]\(\/wl\/([^)\s]+)\)/g, (_, rawLabel: string, encoded: string) => {
      const label = unescapeLabel(rawLabel)
      // The page part never contains '#', so the first %23 is always the anchor separator
      const sep = encoded.indexOf('%23')
      let page: string, anchor: string
      try {
        page = decodeURIComponent(sep === -1 ? encoded : encoded.slice(0, sep))
        anchor = sep === -1 ? '' : decodeURIComponent(encoded.slice(sep + 3))
      } catch {
        return _
      }
      const anchorPart = anchor ? `#${anchor}` : ''
      if (label === page) return `[[${page}${anchorPart}]]`
      return `[[${page}${anchorPart}|${label}]]`
    }),
  )
}

/**
 * Split markdown into prose and GitHub-style callouts (`> [!TYPE]`).
 * Callout content keeps its line structure (lists, multiple paragraphs).
 * Lines inside fenced code blocks are never treated as callouts.
 */
export function extractCallouts(markdown: string): MarkdownPart[] {
  const parts: MarkdownPart[] = []
  let buffer: string[] = []
  const flushText = () => {
    const text = buffer.join('\n')
    if (text.trim()) parts.push({ type: 'text', text: text + '\n' })
    buffer = []
  }

  for (const seg of splitFencedCode(markdown)) {
    if (seg.code) { buffer.push(seg.text); continue }
    const lines = seg.text.split('\n')
    let i = 0
    while (i < lines.length) {
      const m = lines[i]!.match(CALLOUT_RE)
      if (!m) { buffer.push(lines[i]!); i++; continue }
      flushText()
      const contentLines: string[] = []
      if (m[2]?.trim()) contentLines.push(m[2].trim())
      i++
      while (i < lines.length && /^>/.test(lines[i]!) && !CALLOUT_RE.test(lines[i]!)) {
        contentLines.push(lines[i]!.replace(/^>[ \t]?/, ''))
        i++
      }
      parts.push({
        type: 'callout',
        calloutType: m[1]!.toLowerCase() as CalloutKind,
        content: contentLines.join('\n').replace(/^\n+|\n+$/g, ''),
      })
    }
  }
  flushText()
  return parts
}

/** Serialize a callout given its already-rendered markdown body. */
export function formatCallout(calloutType: string, bodyMd: string): string {
  const ct = (calloutType || 'info').toUpperCase()
  const body = bodyMd.trim()
  if (!body) return `> [!${ct}]`
  const quoted = body.split('\n').map(l => (l ? `> ${l}` : '>')).join('\n')
  return `> [!${ct}]\n${quoted}`
}

// ─── Front matter ────────────────────────────────────────────────────────────

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

export interface PageMeta {
  title: string
  icon: string
  body: string
  /** Raw front matter (without the --- fences), preserved verbatim on save. */
  frontmatter: string
}

export function extractPageMeta(markdown: string): PageMeta {
  const fmMatch = markdown.match(FM_RE)
  const frontmatter = fmMatch?.[1] ?? ''
  const rest = (fmMatch ? markdown.slice(fmMatch[0].length) : markdown).trimStart()
  const iconMatch = frontmatter.match(/^icon:\s*(.+)$/m)
  const icon = iconMatch?.[1]?.trim() ?? ''
  const h1Match = rest.match(/^#\s+(.+)\n?/)
  const title = h1Match?.[1] ? h1Match[1].trim() : ''
  const body = h1Match?.[0] ? rest.slice(h1Match[0].length).trimStart() : rest
  return { title, icon, body, frontmatter }
}

/** Rebuild a page. All front matter keys are kept; only `icon:` is rewritten. */
export function buildMarkdown(title: string, icon: string, body: string, frontmatter = ''): string {
  const lines = frontmatter ? frontmatter.split(/\r?\n/) : []
  const iconIdx = lines.findIndex(l => /^icon:/.test(l))
  if (icon) {
    if (iconIdx === -1) lines.unshift(`icon: ${icon}`)
    else lines[iconIdx] = `icon: ${icon}`
  } else if (iconIdx !== -1) {
    lines.splice(iconIdx, 1)
  }
  let md = ''
  if (lines.some(l => l.trim())) md += `---\n${lines.join('\n')}\n---\n\n`
  if (title) md += `# ${title}\n\n`
  md += body
  return md
}

/** Same simple heuristic the MCP server uses for commit messages. */
export function generateCommitMessage(path: string, before: string | undefined, after: string): string {
  const section = path.replace(/\/?index\.md$/, '').replace(/^\//, '') || 'home'
  let description = 'update'
  if (before == null || before === '') description = 'create page'
  else {
    const b = before.split('\n').length
    const a = after.split('\n').length
    if (a > b + 5) description = 'expand content'
    else if (b > a + 5) description = 'trim content'
    else if (before !== after) description = 'revise content'
  }
  return `docs(${section}): ${description}`
}
