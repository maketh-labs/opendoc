import type { RouteHandler } from './types'

export const handleOAuthRedirect: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/auth/github' || req.method !== 'GET') return false

  const clientId = process.env.GITHUB_CLIENT_ID || ctx.config.github?.clientId
  if (!clientId) {
    res.writeHead(501, { 'Content-Type': 'text/plain' })
    res.end('GITHUB_CLIENT_ID not configured. See README.')
    return true
  }
  const origin = req.headers.host ? `http://${req.headers.host}` : `http://localhost:${ctx.port}`
  const redirectUri = `${origin}/_opendoc/auth/callback`
  const ghUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`
  res.writeHead(302, { Location: ghUrl })
  res.end()
  return true
}

export const handleOAuthCallback: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/auth/callback' || req.method !== 'GET') return false

  const code = url.searchParams.get('code')
  const clientId = process.env.GITHUB_CLIENT_ID || ctx.config.github?.clientId
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || ctx.config.github?.clientSecret

  if (!code || !clientId || !clientSecret) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing code or credentials')
    return true
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
    const { access_token } = await tokenRes.json() as { access_token: string }
    const editorTarget = ctx.editorPath ?? '/_editor'
    res.writeHead(302, { Location: `${editorTarget}#github_token=${access_token}` })
    res.end()
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(`OAuth error: ${e}`)
  }
  return true
}
