import { AUTH_START_PATH, AUTH_CALLBACK_PATH, startLogin, finishLogin, type OAuthSettings } from '../oauth-flow'
import type { RouteContext, RouteHandler } from './types'

function settings(ctx: RouteContext): OAuthSettings {
  return {
    clientId: process.env.GITHUB_CLIENT_ID || ctx.config.github?.clientId,
    clientSecret: process.env.GITHUB_CLIENT_SECRET || ctx.config.github?.clientSecret,
    allowedOrigins: ctx.config.github?.allowedOrigins,
    defaultReturnPath: ctx.editorPath ?? '/_',
  }
}

export const handleOAuthRedirect: RouteHandler = (req, url, ctx) => {
  if (url.pathname !== AUTH_START_PATH || req.method !== 'GET') return null
  return startLogin(req, settings(ctx))
}

export const handleOAuthCallback: RouteHandler = (req, url, ctx) => {
  if (url.pathname !== AUTH_CALLBACK_PATH || req.method !== 'GET') return null
  return finishLogin(req, settings(ctx))
}
