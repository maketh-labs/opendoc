/**
 * OpenDoc GitHub OAuth proxy — a Cloudflare Worker that lets a statically hosted
 * OpenDoc editor log in with GitHub (the code exchange needs the client secret,
 * which can't live in a static site).
 *
 * Deploy: see README.md in this folder. Then set in opendoc.json:
 *   "github": { "clientId": "...", "oauthProxy": "https://<worker>.workers.dev" }
 */
import { AUTH_START_PATH, AUTH_CALLBACK_PATH, startLogin, finishLogin, type OAuthSettings } from '../../src/oauth-flow'

export interface Env {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  /** Comma-separated origins of your docs sites, e.g. "https://docs.example.com" */
  ALLOWED_ORIGINS: string
}

function settings(env: Env): OAuthSettings {
  return {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    allowedOrigins: env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean),
    // Without return_to there is no editor on this origin to return to
    defaultReturnPath: '/',
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url)
    if (req.method === 'GET' && pathname === AUTH_START_PATH) {
      if (!new URL(req.url).searchParams.get('return_to')) {
        return new Response('Missing return_to', { status: 400 })
      }
      return startLogin(req, settings(env))
    }
    if (req.method === 'GET' && pathname === AUTH_CALLBACK_PATH) return finishLogin(req, settings(env))
    return new Response('OpenDoc OAuth proxy', { status: 404 })
  },
}
