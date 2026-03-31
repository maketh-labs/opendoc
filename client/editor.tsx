// OpenDoc Editor — React + BlockNote
import './process-polyfill'
import './globals.gen.css'
import React, { useState, useEffect, createContext, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { CalloutBlock } from './callout-block'
import { BookmarkBlock } from './bookmark-block'
import { YoutubeBlock } from './youtube-block'
import { LocalEditor } from './local-editor'
import { GitHubEditor } from './github-editor'
import { LoginScreen, RepoPicker, NoAccess } from './auth-screens'
import {
  isLocal, getStoredToken, getStoredRepo,
  type SiteConfig,
} from './editor-utils'
import {
  checkRepoAccess, fetchUserRepos,
} from './github-api'

// ─── Custom Schema ───────────────────────────────────────────────────────────
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    callout: CalloutBlock(),
    bookmark: BookmarkBlock(),
    youtube: YoutubeBlock(),
  },
})

// ─── Site Config Context ──────────────────────────────────────────────────────
const SiteConfigContext = createContext<SiteConfig>({})
export const useSiteConfig = () => useContext(SiteConfigContext)

// ─── App Root ─────────────────────────────────────────────────────────────────
type AppView =
  | { view: 'loading' }
  | { view: 'local' }
  | { view: 'login' }
  | { view: 'repoPicker'; repos: { full_name: string }[] }
  | { view: 'editor'; token: string; repo: string }
  | { view: 'noAccess'; repo: string }

function App() {
  const [appView, setAppView] = useState<AppView>({ view: 'loading' })
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({})

  useEffect(() => {
    async function init() {
      if (isLocal) { setAppView({ view: 'local' }); return }

      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        try {
          const r = await fetch(`/oauth/callback?code=${code}`)
          const data = await r.json()
          if (data.access_token) localStorage.setItem('github_token', data.access_token)
        } catch {}
        window.history.replaceState({}, '', '/_')
        window.location.reload()
        return
      }

      if (window.location.hash.startsWith('#github_token=')) {
        const t = window.location.hash.slice('#github_token='.length)
        if (t) localStorage.setItem('github_token', t)
        window.history.replaceState({}, '', window.location.pathname + window.location.search)
      }

      let config: SiteConfig = {}
      try {
        const r = await fetch('/_opendoc/config.json')
        if (r.ok) config = await r.json()
      } catch {}
      setSiteConfig(config)

      if (config.github?.repo && !getStoredRepo()) {
        localStorage.setItem('github_repo', config.github.repo)
      }

      const token = getStoredToken()
      if (!token) { setAppView({ view: 'login' }); return }

      const repo = getStoredRepo()
      if (!repo) {
        try {
          const repos = await fetchUserRepos(token)
          setAppView({ view: 'repoPicker', repos })
        } catch {
          localStorage.removeItem('github_token')
          setAppView({ view: 'login' })
        }
        return
      }

      const access = await checkRepoAccess(repo, token)
      if (access === 'none') { setAppView({ view: 'noAccess', repo }); return }
      setAppView({ view: 'editor', token, repo })
    }

    init()
  }, [])

  const view = appView

  return (
    <SiteConfigContext.Provider value={siteConfig}>
      {view.view === 'loading'     && <div className="login-screen"><div style={{ color: 'var(--color-muted)' }}>Loading…</div></div>}
      {view.view === 'local'       && <LocalEditor />}
      {view.view === 'login'       && <LoginScreen clientId={siteConfig.github?.clientId} />}
      {view.view === 'repoPicker'  && <RepoPicker repos={view.repos} />}
      {view.view === 'noAccess'    && <NoAccess repo={view.repo} />}
      {view.view === 'editor'      && <GitHubEditor token={view.token} repo={view.repo} config={siteConfig} />}
    </SiteConfigContext.Provider>
  )
}

// ─── Mount ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('app')!).render(<App />)
