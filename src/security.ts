import { resolve, relative, isAbsolute, dirname, sep } from 'path'
import { realpath } from 'fs/promises'
import { lookup } from 'dns/promises'
import { isIP } from 'net'

/** Error carrying an HTTP status — thrown by request helpers, mapped to a response by the server. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ── Path containment ─────────────────────────────────────────────────────────

/** True if fullPath is rootDir itself or inside it. Separator- and platform-aware. */
export function isWithinRoot(rootDir: string, fullPath: string): boolean {
  const rel = relative(resolve(rootDir), resolve(fullPath))
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
}

export interface ResolveOptions {
  /** Allow path segments starting with "." (e.g. ".git", ".env"). Default false. */
  allowDotSegments?: boolean
}

/**
 * Resolve a user-supplied path relative to rootDir. Returns null if it escapes the root,
 * contains a NUL byte, or (by default) touches a dot-prefixed segment such as `.git`.
 * Symlinks are followed: the nearest existing ancestor must also resolve inside the root.
 */
export async function resolveInRoot(rootDir: string, userPath: string, opts: ResolveOptions = {}): Promise<string | null> {
  if (userPath.includes('\0')) return null
  const root = resolve(rootDir)
  const full = resolve(root, userPath.replace(/^[/\\]+/, ''))
  if (!isWithinRoot(root, full)) return null

  if (!opts.allowDotSegments) {
    const segments = relative(root, full).split(/[/\\]/)
    if (segments.some(s => s.startsWith('.') && s !== '.')) return null
  }

  // Follow symlinks on the deepest existing ancestor
  const realRoot = await realpath(root).catch(() => root)
  let probe = full
  while (true) {
    try {
      const real = await realpath(probe)
      if (!isWithinRoot(realRoot, real)) return null
      break
    } catch {
      const parent = dirname(probe)
      if (parent === probe) break
      probe = parent
    }
  }
  return full
}

// ── Request trust ────────────────────────────────────────────────────────────

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return LOOPBACK_HOSTNAMES.has(h) || h.endsWith('.localhost')
}

export function isLoopbackAddress(addr: string | undefined | null): boolean {
  if (!addr) return false
  return addr === '::1' || addr.startsWith('127.') || addr.startsWith('::ffff:127.')
}

/**
 * True only for requests made from a browser/tool on this machine to a loopback hostname.
 * Guards the local editing API against LAN access, DNS rebinding (Host check),
 * cross-site requests (Origin check), and reverse-proxied public traffic (forwarded headers).
 */
export function isTrustedLocalRequest(req: Request, remoteAddress: string | undefined | null): boolean {
  if (!isLoopbackAddress(remoteAddress)) return false
  const h = req.headers
  if (h.get('x-forwarded-for') || h.get('x-forwarded-host') || h.get('forwarded')) return false

  const host = h.get('host')
  if (!host) return false
  let hostname: string
  try { hostname = new URL(`http://${host}`).hostname } catch { return false }
  if (!isLoopbackHostname(hostname)) return false

  const origin = h.get('origin')
  if (origin !== null) {
    try {
      const o = new URL(origin)
      if (o.host !== host || !isLoopbackHostname(o.hostname)) return false
    } catch {
      return false
    }
  }

  // Reject cross-site requests from browsers that send Fetch Metadata but no Origin
  const site = h.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false

  return true
}

// ── Body reading ─────────────────────────────────────────────────────────────

/** Max request body (uploads included) — enforced by Bun.serve's maxRequestBodySize */
export const MAX_BODY_BYTES = 100 * 1024 * 1024

/** Read and parse a JSON object body; throws HttpError(400) on malformed input. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  let parsed: unknown
  try { parsed = JSON.parse(await req.text()) } catch { throw new HttpError(400, 'Invalid JSON body') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'Expected a JSON object')
  return parsed as T
}

/** Parse a multipart body; throws HttpError(400) on malformed input. */
export async function readFormData(req: Request): Promise<FormData> {
  try {
    return await req.formData()
  } catch {
    throw new HttpError(400, 'Invalid multipart body')
  }
}

// ── Outbound fetch (SSRF guard) ──────────────────────────────────────────────

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0
}

function inV4Range(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/') as [string, string]
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask)
}

const BLOCKED_V4 = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
  '172.16.0.0/12', '192.0.0.0/24', '192.168.0.0/16', '198.18.0.0/15', '224.0.0.0/4', '240.0.0.0/4',
]

/** True if the IP is loopback, private, link-local, CGNAT, multicast, or otherwise non-public. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) return BLOCKED_V4.some(c => inV4Range(ip, c))
  if (v === 6) {
    const lower = ip.toLowerCase()
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1]!)
    return lower === '::' || lower === '::1' ||
      lower.startsWith('fc') || lower.startsWith('fd') ||   // unique local
      lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || // link-local
      lower.startsWith('ff')                                 // multicast
  }
  return true
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpError(400, 'Only http(s) URLs are allowed')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addrs.length === 0 || addrs.some(a => isPrivateIp(a.address))) {
    throw new HttpError(400, 'URL resolves to a non-public address')
  }
}

/**
 * Fetch a public http(s) URL as text with SSRF protection: rejects private/loopback targets
 * (re-checked on every redirect), caps the response size, and enforces a total timeout.
 */
export async function fetchPublicText(
  rawUrl: string,
  { maxBytes = 1024 * 1024, timeoutMs = 5000, maxRedirects = 3, headers = {} as Record<string, string> } = {},
): Promise<{ url: URL; text: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = new URL(rawUrl)
    for (let i = 0; ; i++) {
      await assertPublicUrl(url)
      const r = await fetch(url, { signal: controller.signal, redirect: 'manual', headers })
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        if (i >= maxRedirects) throw new HttpError(400, 'Too many redirects')
        url = new URL(r.headers.get('location')!, url)
        continue
      }
      if (!r.body) return { url, text: '' }
      const reader = r.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        chunks.push(value)
        if (size >= maxBytes) { await reader.cancel(); break }
      }
      return { url, text: new TextDecoder().decode(Buffer.concat(chunks)) }
    }
  } finally {
    clearTimeout(timer)
  }
}
