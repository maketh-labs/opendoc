/**
 * GitHub OAuth web flow, shared by `opendoc serve` (/_opendoc/auth/*) and the standalone
 * OAuth proxy worker (deploy/oauth-proxy). Uses only web-standard APIs.
 *
 *   GET {base}/_opendoc/auth/github[?return_to=<editor URL>]  → GitHub authorize (state cookie set)
 *   GET {base}/_opendoc/auth/callback?code&state              → <return_to>#github_token=<token>
 *
 * `return_to` lets a statically hosted editor on another origin log in through this server;
 * its origin must be listed in `allowedOrigins`, otherwise the token could be sent anywhere.
 */

export const AUTH_START_PATH = '/_opendoc/auth/github'
export const AUTH_CALLBACK_PATH = '/_opendoc/auth/callback'

const STATE_COOKIE = 'od_oauth_state'
const RETURN_COOKIE = 'od_oauth_return'

export interface OAuthSettings {
  clientId?: string
  clientSecret?: string
  /** Origins (e.g. "https://docs.example.com") allowed as `return_to` targets */
  allowedOrigins?: string[]
  /** Where to send the token when no `return_to` was given (path on this origin, e.g. "/_") */
  defaultReturnPath: string
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

/** Public origin of this request, honoring a reverse proxy's X-Forwarded-Proto/Host. */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url)
  const proto = (req.headers.get('x-forwarded-proto') ?? '').split(',')[0]!.trim() || url.protocol.replace(':', '')
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host).split(',')[0]!.trim()
  return `${proto === 'https' ? 'https' : 'http'}://${host}`
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function cookie(name: string, value: string, maxAge: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/_opendoc/auth; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Validate a return_to URL: must be http(s) on this origin or an allowed origin. */
export function validateReturnTo(raw: string, ownOrigin: string, allowedOrigins: string[] = []): string | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const allowed = new Set([ownOrigin, ...allowedOrigins.map(o => o.replace(/\/+$/, ''))])
  if (!allowed.has(u.origin)) return null
  u.hash = ''
  return u.href
}

export function startLogin(req: Request, settings: OAuthSettings): Response {
  if (!settings.clientId) return text(501, 'GitHub OAuth is not configured (missing client ID). See README.')

  const origin = requestOrigin(req)
  const secure = origin.startsWith('https://')
  const returnParam = new URL(req.url).searchParams.get('return_to')
  const returnTo = returnParam ? validateReturnTo(returnParam, origin, settings.allowedOrigins) : null
  if (returnParam && !returnTo) return text(400, 'return_to origin is not allowed. Add it to github.allowedOrigins.')

  const state = randomState()
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', settings.clientId)
  authorize.searchParams.set('redirect_uri', origin + AUTH_CALLBACK_PATH)
  authorize.searchParams.set('scope', 'repo')
  authorize.searchParams.set('state', state)

  const headers = new Headers({ Location: authorize.href, 'Cache-Control': 'no-store' })
  headers.append('Set-Cookie', cookie(STATE_COOKIE, state, 600, secure))
  headers.append('Set-Cookie', cookie(RETURN_COOKIE, returnTo ?? '', returnTo ? 600 : 0, secure))
  return new Response(null, { status: 302, headers })
}

export async function finishLogin(req: Request, settings: OAuthSettings, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = readCookie(req, STATE_COOKIE)
  if (!state || !expected || !constantTimeEqual(state, expected)) {
    return text(400, 'Invalid OAuth state. Start the login again.')
  }
  if (!code || !settings.clientId || !settings.clientSecret) return text(400, 'Missing code or OAuth credentials')

  const origin = requestOrigin(req)
  // Re-validate: the allowlist may have changed since the cookie was set
  const savedReturn = readCookie(req, RETURN_COOKIE)
  const returnTo = (savedReturn && validateReturnTo(savedReturn, origin, settings.allowedOrigins)) || origin + settings.defaultReturnPath

  let token: string | undefined
  let errorDescription: string | undefined
  try {
    const res = await fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: settings.clientId, client_secret: settings.clientSecret, code }),
    })
    const data = await res.json() as { access_token?: string; error_description?: string }
    token = data.access_token
    errorDescription = data.error_description
  } catch {
    return text(502, 'OAuth error: could not reach GitHub')
  }
  if (!token) return text(502, `GitHub OAuth failed: ${errorDescription ?? 'no access token returned'}`)

  const secure = origin.startsWith('https://')
  // Token travels in the fragment so it never reaches server logs or Referer headers
  const headers = new Headers({ Location: `${returnTo}#github_token=${encodeURIComponent(token)}`, 'Cache-Control': 'no-store' })
  headers.append('Set-Cookie', cookie(STATE_COOKIE, '', 0, secure))
  headers.append('Set-Cookie', cookie(RETURN_COOKIE, '', 0, secure))
  return new Response(null, { status: 302, headers })
}
