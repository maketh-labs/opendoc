import { randomBytes, timingSafeEqual } from 'crypto'
import type { IncomingMessage } from 'http'
import { sendText, type RouteHandler } from './types'

const STATE_COOKIE = 'od_oauth_state'

/** Public origin of this request, honoring a reverse proxy's X-Forwarded-Proto. */
function requestOrigin(req: IncomingMessage, fallbackPort: number): string {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0]!.trim()
  const proto = forwarded === 'https' ? 'https' : 'http'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? `localhost:${fallbackPort}`
  return `${proto}://${String(host).split(',')[0]!.trim()}`
}

function readCookie(req: IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export const handleOAuthRedirect: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/auth/github' || req.method !== 'GET') return false

  const clientId = process.env.GITHUB_CLIENT_ID || ctx.config.github?.clientId
  if (!clientId) { sendText(res, 501, 'GITHUB_CLIENT_ID not configured. See README.'); return true }

  const origin = requestOrigin(req, ctx.port)
  const state = randomBytes(24).toString('base64url')
  const secure = origin.startsWith('https://') ? '; Secure' : ''
  const redirectUri = `${origin}/_opendoc/auth/callback`
  const ghUrl = new URL('https://github.com/login/oauth/authorize')
  ghUrl.searchParams.set('client_id', clientId)
  ghUrl.searchParams.set('redirect_uri', redirectUri)
  ghUrl.searchParams.set('scope', 'repo')
  ghUrl.searchParams.set('state', state)

  res.writeHead(302, {
    Location: ghUrl.href,
    'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/_opendoc/auth; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
  })
  res.end()
  return true
}

export const handleOAuthCallback: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/auth/callback' || req.method !== 'GET') return false

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = readCookie(req, STATE_COOKIE)
  const clientId = process.env.GITHUB_CLIENT_ID || ctx.config.github?.clientId
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || ctx.config.github?.clientSecret

  if (!state || !expectedState || !safeEqual(state, expectedState)) {
    sendText(res, 400, 'Invalid OAuth state. Start the login again.')
    return true
  }
  if (!code || !clientId || !clientSecret) {
    sendText(res, 400, 'Missing code or credentials')
    return true
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
    const data = await tokenRes.json() as { access_token?: string; error_description?: string }
    if (!data.access_token) {
      sendText(res, 502, `GitHub OAuth failed: ${data.error_description ?? 'no access token returned'}`)
      return true
    }
    // Token travels in the fragment so it never reaches server logs or Referer headers
    res.writeHead(302, {
      Location: `${ctx.editorPath ?? '/_'}#github_token=${encodeURIComponent(data.access_token)}`,
      'Set-Cookie': `${STATE_COOKIE}=; Path=/_opendoc/auth; HttpOnly; SameSite=Lax; Max-Age=0`,
      'Cache-Control': 'no-store',
    })
    res.end()
  } catch {
    sendText(res, 502, 'OAuth error: could not reach GitHub')
  }
  return true
}
