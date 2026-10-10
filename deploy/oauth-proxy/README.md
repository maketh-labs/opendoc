# OpenDoc OAuth proxy

A static OpenDoc site (`opendoc build`) can't log editors in to GitHub by itself: exchanging the OAuth code for a token needs the app's client secret. This Cloudflare Worker does that exchange and hands the token back to your editor page.

Any running `opendoc serve` can do the same job; set `github.allowedOrigins` on it instead of deploying this worker.

## Setup

1. Create a GitHub OAuth app. Set its **Authorization callback URL** to `https://<your-worker>.workers.dev/_opendoc/auth/callback`.
2. Deploy the worker:
   ```bash
   cd deploy/oauth-proxy
   # Set ALLOWED_ORIGINS in wrangler.toml to your docs site's origin(s)
   bunx wrangler secret put GITHUB_CLIENT_ID
   bunx wrangler secret put GITHUB_CLIENT_SECRET
   bunx wrangler deploy
   ```
3. Point your docs at it in `opendoc.json`:
   ```json
   {
     "github": {
       "repo": "owner/docs-repo",
       "clientId": "<GitHub OAuth app client ID>",
       "oauthProxy": "https://<your-worker>.workers.dev"
     }
   }
   ```

The editor sends users to `<oauthProxy>/_opendoc/auth/github?return_to=<editor URL>`. The worker only redirects to origins listed in `ALLOWED_ORIGINS`, checks a `state` cookie on the way back, and returns the token in the URL fragment (`#github_token=...`), which never reaches server logs.
