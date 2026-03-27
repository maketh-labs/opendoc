// OpenDoc Browser Editor
// GitHub OAuth + two-panel markdown editor

import { initSlashCommands } from './slash-commands'
import { initCodePicker } from './code-picker'

const GITHUB_CLIENT_ID = 'PLACEHOLDER_CLIENT_ID';
const OAUTH_CALLBACK_URL = '/oauth/callback';
const MCP_URL = 'http://localhost:3001/mcp';

// --- State ---
let currentContent = '';
let originalContent = '';

function getToken(): string | null {
  return localStorage.getItem('github_token');
}

function getRepo(): string | null {
  return localStorage.getItem('github_repo');
}

function getCurrentPagePath(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('path') || 'index.md';
}

// --- Simple markdown to HTML (client-side) ---
function renderMarkdown(md: string): string {
  let html = md
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`)
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Line breaks → paragraphs
    .replace(/\n\n+/g, '</p><p>')
    // Single line breaks
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- GitHub API ---
async function fetchUserRepos(token: string): Promise<{ full_name: string }[]> {
  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch repos');
  return res.json();
}

async function loadPageContent(pagePath: string): Promise<string> {
  // Try loading from dist
  const mdPath = pagePath.endsWith('.md') ? pagePath : `${pagePath}/index.md`;
  const distPath = `/dist/${mdPath}`;
  try {
    const res = await fetch(distPath);
    if (res.ok) return res.text();
  } catch { /* fall through */ }
  return `# New Page\n\nStart writing here...`;
}

async function save(path: string, content: string, token: string, repo: string): Promise<void> {
  // 1. Get current file SHA
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let sha: string | undefined;
  if (res.ok) {
    const data = await res.json();
    sha = data.sha;
  }

  // 2. Try MCP for commit message
  let message = `edit(${path}): ${new Date().toISOString()}`;
  try {
    const mcp = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'generate_commit_message',
        params: { path, before: originalContent, after: content },
      }),
    });
    if (mcp.ok) message = (await mcp.json()).message;
  } catch { /* MCP not available, use default */ }

  // 3. Commit via GitHub API
  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(err.message || 'Failed to save');
  }
}

// --- UI Rendering ---
const app = document.getElementById('app')!;

function renderLogin(): void {
  app.innerHTML = `
    <div class="editor-header">
      <span class="logo">OpenDoc Editor</span>
    </div>
    <div class="login-screen">
      <div class="login-box">
        <h1>OpenDoc Editor</h1>
        <p>Sign in with GitHub to edit documentation.</p>
        <button class="btn btn-primary" id="login-btn">Login with GitHub</button>
      </div>
    </div>
  `;
  document.getElementById('login-btn')!.addEventListener('click', () => {
    const redirectUri = encodeURIComponent(window.location.origin + '/editor');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo`;
  });
}

function renderRepoPicker(repos: { full_name: string }[]): void {
  const options = repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('');
  app.innerHTML = `
    <div class="editor-header">
      <span class="logo">OpenDoc Editor</span>
      <span class="spacer"></span>
      <button class="btn" id="logout-btn">Logout</button>
    </div>
    <div class="repo-picker">
      <div class="repo-picker-box">
        <h2>Select a repository</h2>
        <select id="repo-select">
          <option value="">Choose a repo...</option>
          ${options}
        </select>
        <div class="or-divider">or type a repo name</div>
        <input type="text" id="repo-input" placeholder="owner/repo">
        <button class="btn btn-primary" id="repo-go" style="width:100%">Open</button>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')!.addEventListener('click', () => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_repo');
    init();
  });

  document.getElementById('repo-select')!.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val) (document.getElementById('repo-input') as HTMLInputElement).value = val;
  });

  document.getElementById('repo-go')!.addEventListener('click', () => {
    const input = (document.getElementById('repo-input') as HTMLInputElement).value.trim();
    const select = (document.getElementById('repo-select') as HTMLSelectElement).value;
    const repo = input || select;
    if (repo) {
      localStorage.setItem('github_repo', repo);
      init();
    }
  });
}

async function renderEditor(): Promise<void> {
  const token = getToken()!;
  const repo = getRepo()!;
  const pagePath = getCurrentPagePath();

  app.innerHTML = `
    <div class="editor-header">
      <span class="logo">OpenDoc Editor</span>
      <span class="repo-name">${escapeHtml(repo)}</span>
      <span class="page-path">${escapeHtml(pagePath)}</span>
      <span class="spacer"></span>
      <span class="status" id="save-status"></span>
      <button class="btn btn-primary" id="save-btn">Save</button>
      <button class="btn" id="change-repo-btn">Change Repo</button>
      <button class="btn" id="logout-btn">Logout</button>
    </div>
    <div class="editor-panels">
      <div class="editor-pane">
        <div class="pane-header">Markdown</div>
        <textarea id="editor-textarea" spellcheck="false"></textarea>
      </div>
      <div class="editor-pane">
        <div class="pane-header">Preview</div>
        <div id="preview"></div>
      </div>
    </div>
  `;

  const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
  const preview = document.getElementById('preview')!;
  const status = document.getElementById('save-status')!;

  // Load content
  status.textContent = 'Loading...';
  const content = await loadPageContent(pagePath);
  originalContent = content;
  currentContent = content;
  textarea.value = content;
  preview.innerHTML = renderMarkdown(content);
  status.textContent = '';

  // Live preview
  textarea.addEventListener('input', () => {
    currentContent = textarea.value;
    preview.innerHTML = renderMarkdown(currentContent);
  });

  // Save
  document.getElementById('save-btn')!.addEventListener('click', async () => {
    status.textContent = 'Saving...';
    try {
      await save(pagePath, currentContent, token, repo);
      originalContent = currentContent;
      status.textContent = 'Saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    } catch (err) {
      status.textContent = `Error: ${(err as Error).message}`;
    }
  });

  // Change repo
  document.getElementById('change-repo-btn')!.addEventListener('click', () => {
    localStorage.removeItem('github_repo');
    init();
  });

  // Logout
  document.getElementById('logout-btn')!.addEventListener('click', () => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_repo');
    init();
  });

  // Init slash commands and code picker
  initSlashCommands(textarea)
  initCodePicker(textarea)

  // Keyboard shortcut: Cmd/Ctrl+S to save
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('save-btn')!.click();
    }
  });
}

// --- OAuth callback handling ---
function handleOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  // Exchange code for token via CF Worker
  const callbackUrl = `${OAUTH_CALLBACK_URL}?code=${code}`;
  fetch(callbackUrl)
    .then(res => res.json())
    .then((data: { access_token?: string }) => {
      if (data.access_token) {
        localStorage.setItem('github_token', data.access_token);
      }
      // Clean URL
      window.history.replaceState({}, '', '/editor');
      init();
    })
    .catch(() => {
      window.history.replaceState({}, '', '/editor');
      init();
    });
  return true;
}

// --- Config ---
interface SiteConfig {
  title?: string
  editorPath?: string
  github?: { repo?: string; branch?: string }
  theme?: string
}

let siteConfig: SiteConfig = {};

async function loadSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch('/_opendoc/config.json');
    if (res.ok) return await res.json();
  } catch { /* config not available */ }
  return {};
}

// --- Init ---
async function init(): Promise<void> {
  // Handle OAuth callback
  if (handleOAuthCallback()) return;

  // Load site config
  siteConfig = await loadSiteConfig();

  // If github.repo is configured, pre-select it
  if (siteConfig.github?.repo && !getRepo()) {
    localStorage.setItem('github_repo', siteConfig.github.repo);
  }

  const token = getToken();
  if (!token) {
    renderLogin();
    return;
  }

  const repo = getRepo();
  if (!repo) {
    try {
      const repos = await fetchUserRepos(token);
      renderRepoPicker(repos);
    } catch {
      // Token might be invalid
      localStorage.removeItem('github_token');
      renderLogin();
    }
    return;
  }

  await renderEditor();
}

init();
