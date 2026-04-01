import React, { useState } from 'react'
import { showToast } from './editor-utils'
import { Button } from './ui/button'

export function LoginScreen({ clientId }: { clientId?: string }) {
  function login() {
    if (!clientId) {
      showToast('GitHub OAuth client ID not configured', 'error')
      return
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/editor')
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`
  }
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-2 h-10 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0"><span className="font-semibold text-sm">OpenDoc Editor</span></div>
      <div className="flex items-center justify-center flex-1">
        <div className="text-center p-12">
          <h1 className="text-2xl mb-2">OpenDoc Editor</h1>
          <p className="text-[var(--color-muted)] mb-6">Sign in with GitHub to edit documentation.</p>
          <Button onClick={login}>Login with GitHub</Button>
        </div>
      </div>
    </div>
  )
}

export function RepoPicker({ repos }: { repos: { full_name: string }[] }) {
  const [input, setInput] = useState('')

  function go() {
    if (input.trim()) {
      localStorage.setItem('github_repo', input.trim())
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-2 h-10 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
        <span className="font-semibold text-sm">OpenDoc Editor</span>
        <span className="flex-1" />
        <Button variant="outline" onClick={() => { localStorage.removeItem('github_token'); window.location.reload() }}>Logout</Button>
      </div>
      <div className="flex items-center justify-center flex-1">
        <div className="w-[400px] p-8">
          <h1 className="text-lg mb-4">Select a repository</h1>
          <select className="w-full py-2 px-3 border border-[var(--color-border)] rounded-[var(--border-radius)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm mb-3" onChange={e => setInput(e.target.value)} defaultValue="" aria-label="Select repository">
            <option value="" disabled>Choose a repo…</option>
            {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
          <div className="text-center text-[var(--color-muted)] text-xs mb-3">or type a repo name</div>
          <input
            className="w-full py-2 px-3 border border-[var(--color-border)] rounded-[var(--border-radius)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm mb-3"
            type="text"
            placeholder="owner/repo"
            aria-label="Repository name"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go()}
          />
          <Button style={{ width: '100%' }} onClick={go}>Open</Button>
        </div>
      </div>
    </div>
  )
}

export function NoAccess({ repo }: { repo: string }) {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-2 h-10 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
        <span className="font-semibold text-sm">OpenDoc Editor</span>
        <span className="flex-1" />
        <Button variant="outline" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Change Repo</Button>
        <Button variant="outline" onClick={() => { localStorage.removeItem('github_token'); localStorage.removeItem('github_repo'); window.location.reload() }}>Logout</Button>
      </div>
      <div className="flex items-center justify-center flex-1">
        <div className="text-center p-12">
          <h1 className="text-2xl mb-2">No Access</h1>
          <p className="text-[var(--color-muted)] mb-6">You don't have access to <strong>{repo}</strong>.</p>
          <Button onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>
            Choose Another Repo
          </Button>
        </div>
      </div>
    </div>
  )
}
