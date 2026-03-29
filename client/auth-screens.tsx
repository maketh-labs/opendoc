import React, { useState } from 'react'
import { showToast } from './editor-utils'

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header"><span className="logo">OpenDoc Editor</span></div>
      <div className="login-screen">
        <div className="login-box">
          <h1>OpenDoc Editor</h1>
          <p>Sign in with GitHub to edit documentation.</p>
          <button className="btn btn-primary" onClick={login}>Login with GitHub</button>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header">
        <span className="logo">OpenDoc Editor</span>
        <span className="spacer" />
        <button className="btn" onClick={() => { localStorage.removeItem('github_token'); window.location.reload() }}>Logout</button>
      </div>
      <div className="repo-picker">
        <div className="repo-picker-box">
          <h2>Select a repository</h2>
          <select onChange={e => setInput(e.target.value)} defaultValue="">
            <option value="" disabled>Choose a repo…</option>
            {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
          <div className="or-divider">or type a repo name</div>
          <input
            type="text"
            placeholder="owner/repo"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go()}
          />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={go}>Open</button>
        </div>
      </div>
    </div>
  )
}

export function NoAccess({ repo }: { repo: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header">
        <span className="logo">OpenDoc Editor</span>
        <span className="spacer" />
        <button className="btn" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>Change Repo</button>
        <button className="btn" onClick={() => { localStorage.removeItem('github_token'); localStorage.removeItem('github_repo'); window.location.reload() }}>Logout</button>
      </div>
      <div className="login-screen">
        <div className="login-box">
          <h1>No Access</h1>
          <p>You don't have access to <strong>{repo}</strong>.</p>
          <button className="btn btn-primary" onClick={() => { localStorage.removeItem('github_repo'); window.location.reload() }}>
            Choose Another Repo
          </button>
        </div>
      </div>
    </div>
  )
}
