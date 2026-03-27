// OpenDoc Browser Editor
// GitHub OAuth + two-panel markdown editor
// Supports local mode (localhost) and remote mode (GitHub API)

import { initSlashCommands } from './slash-commands'
import { initCodePicker } from './code-picker'

const GITHUB_CLIENT_ID = 'PLACEHOLDER_CLIENT_ID';
const OAUTH_CALLBACK_URL = '/oauth/callback';
const MCP_URL = 'http://localhost:3001/mcp';

// --- Local mode detection ---
const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.endsWith('.local');

// --- State ---
let currentContent = '';
let originalContent = '';
let repoAccess: 'write' | 'read' | 'none' = 'none';
let cachedUsername: string | null = null;

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

// --- Local file API ---
async function localLoadFile(filePath: string): Promise<string> {
  const res = await fetch(`/_opendoc/file?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to load ${filePath}`);
  return res.text();
}

async function localSaveFile(filePath: string, content: string): Promise<void> {
  const res = await fetch(`/_opendoc/file?path=${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to save file');
}

// --- Nav helpers ---
interface NavNode {
  title: string;
  path: string;
  url: string;
  icon?: string;
  children: NavNode[];
}

function flattenNav(node: NavNode | null): { title: string; filePath: string }[] {
  if (!node) return [];
  const result: { title: string; filePath: string }[] = [];
  const pagePath = node.path === '.' ? '' : node.path;
  result.push({ title: node.title, filePath: pagePath ? `${pagePath}/index.md` : 'index.md' });
  for (const child of node.children || []) {
    result.push(...flattenNav(child));
  }
  return result;
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

// --- Permission Check ---
async function checkRepoAccess(repo: string, token: string): Promise<'write' | 'read' | 'none'> {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 'none';
  const data = await res.json();
  return data.permissions?.push ? 'write' : 'read';
}

async function getGitHubUsername(token: string): Promise<string> {
  if (cachedUsername) return cachedUsername;
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to get user info');
  const data = await res.json();
  cachedUsername = data.login;
  return data.login;
}

// --- Toast ---
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: 'success' | 'error' | 'warning', linkUrl?: string): void {
  // Remove existing toast
  const existing = document.getElementById('od-toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.id = 'od-toast';
  toast.className = `od-toast ${type === 'warning' ? 'warning' : type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>${
    linkUrl ? `<a href="${escapeHtml(linkUrl)}" target="_blank">View →</a>` : ''
  }`;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 5000);
}

// --- Commit Message ---
async function getCommitMessage(path: string): Promise<string> {
  const fallback = `edit(${path}): ${new Date().toISOString()}`;
  try {
    const mcp = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'generate_commit_message',
        params: { path, before: originalContent, after: currentContent },
      }),
    });
    if (mcp.ok) return (await mcp.json()).message;
  } catch { /* MCP not available */ }
  return fallback;
}

// --- Save: Direct Commit ---
async function commitDirectly(path: string, content: string, token: string, repo: string): Promise<{ url?: string }> {
  // Get current file SHA
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let sha: string | undefined;
  if (res.ok) {
    const data = await res.json();
    sha = data.sha;
  }

  const message = await getCommitMessage(path);

  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;

  const branch = siteConfig.github?.branch || 'main';
  body.branch = branch;

  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(err.message || 'Failed to save');
  }
  const data = await putRes.json();
  return { url: data.commit?.html_url };
}

// --- Save: Fork + PR ---
async function openPullRequest(path: string, content: string, token: string, repo: string): Promise<{ url?: string }> {
  const username = await getGitHubUsername(token);
  const [, repoName] = repo.split('/');

  // Fork if needed
  await fetch(`https://api.github.com/repos/${repo}/forks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  // Wait for fork
  const forkRepo = `${username}/${repoName}`;
  let forkReady = false;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const check = await fetch(`https://api.github.com/repos/${forkRepo}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (check.ok) { forkReady = true; break; }
  }
  if (!forkReady) throw new Error('Fork not ready after 10s');

  const baseBranch = siteConfig.github?.branch || 'main';
  const branch = `opendoc-edit-${Date.now()}`;

  // Get default branch SHA from fork
  const refRes = await fetch(`https://api.github.com/repos/${forkRepo}/git/ref/heads/${baseBranch}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!refRes.ok) throw new Error('Failed to get branch ref from fork');
  const { object: { sha: branchSha } } = await refRes.json();

  // Create branch on fork
  const branchRes = await fetch(`https://api.github.com/repos/${forkRepo}/git/refs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: branchSha }),
  });
  if (!branchRes.ok) throw new Error('Failed to create branch on fork');

  // Get file SHA from fork
  const fileRes = await fetch(`https://api.github.com/repos/${forkRepo}/contents/${path}?ref=${branch}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let sha: string | undefined;
  if (fileRes.ok) {
    const data = await fileRes.json();
    sha = data.sha;
  }

  // Commit to fork branch
  const message = await getCommitMessage(path);
  const commitBody: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };
  if (sha) commitBody.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${forkRepo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commitBody),
  });
  if (!putRes.ok) throw new Error('Failed to commit to fork');

  // Open PR
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: message,
      head: `${username}:${branch}`,
      base: baseBranch,
      body: `_Opened via [OpenDoc](https://opendoc.sh) editor_`,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.json();
    throw new Error(err.message || 'Failed to create pull request');
  }
  const pr = await prRes.json();
  return { url: pr.html_url };
}

// --- Unified Save Handler ---
async function handleSave(path: string, content: string, token: string, repo: string, forcePR: boolean): Promise<void> {
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
  const dropdown = document.getElementById('save-dropdown');
  if (dropdown) dropdown.hidden = true;

  // Show loading state
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="od-spinner"></span>Saving…';
  }

  try {
    let result: { url?: string };
    if (repoAccess === 'write' && !forcePR) {
      result = await commitDirectly(path, content, token, repo);
      originalContent = content;
      showToast('Saved', 'success', result.url);
    } else {
      result = await openPullRequest(path, content, token, repo);
      originalContent = content;
      showToast('Pull request opened', 'success', result.url);
    }
  } catch (err) {
    showToast((err as Error).message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      // Restore label based on access
      saveBtn.textContent = repoAccess === 'write' ? 'Save' : 'Suggest Edit';
    }
  }
}

// --- UI Rendering ---
const app = document.getElementById('app')!;

// --- Local Editor ---
async function renderLocalEditor(): Promise<void> {
  const pagePath = getCurrentPagePath();

  // Fetch nav tree for page picker
  let pages: { title: string; filePath: string }[] = [];
  try {
    const navTree = await fetch('/_opendoc/nav.json').then(r => r.json());
    pages = flattenNav(navTree);
  } catch { /* nav not available */ }

  // If no path specified and we have pages, default to first
  const currentFile = pagePath || (pages.length > 0 ? pages[0]!.filePath : 'index.md');

  // Build page picker options
  const pageOptions = pages.map(p =>
    `<option value="${escapeHtml(p.filePath)}"${p.filePath === currentFile ? ' selected' : ''}>${escapeHtml(p.title)}</option>`
  ).join('');

  app.innerHTML = `
    <div class="editor-header">
      <span class="logo">OpenDoc Editor</span>
      <span class="page-path" style="color: var(--color-muted); font-size: 0.8rem;">Local</span>
      ${pages.length > 0 ? `<select id="page-picker" style="padding:0.3rem 0.5rem;border:1px solid var(--color-border);border-radius:var(--border-radius);background:var(--color-bg);color:var(--color-text);font-size:0.8rem;">${pageOptions}</select>` : `<span class="page-path">${escapeHtml(currentFile)}</span>`}
      <span class="spacer"></span>
      <span class="od-git-status" id="git-status"></span>
      <button class="od-save-primary" id="save-btn" style="border-radius:var(--border-radius)">Save</button>
      <div class="od-commit-group" id="commit-group">
        <input type="text" class="od-commit-msg" id="commit-msg" placeholder="Commit message (optional)">
        <button class="btn btn-primary" id="commit-btn">Commit &amp; Push</button>
      </div>
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

  // Load file content
  async function loadFile(filePath: string): Promise<void> {
    try {
      const content = await localLoadFile(filePath);
      originalContent = content;
      currentContent = content;
      textarea.value = content;
      preview.innerHTML = renderMarkdown(content);
    } catch {
      const fallback = `# New Page\n\nStart writing here...`;
      originalContent = fallback;
      currentContent = fallback;
      textarea.value = fallback;
      preview.innerHTML = renderMarkdown(fallback);
    }
  }

  await loadFile(currentFile);

  // Debounced live preview
  let previewTimeout: ReturnType<typeof setTimeout>;
  textarea.addEventListener('input', () => {
    currentContent = textarea.value;
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
      preview.innerHTML = renderMarkdown(currentContent);
    }, 300);
  });

  // Save button
  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const picker = document.getElementById('page-picker') as HTMLSelectElement | null;
    const activeFile = picker ? picker.value : currentFile;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="od-spinner"></span>Saving\u2026';

    try {
      await localSaveFile(activeFile, currentContent);
      originalContent = currentContent;
      showToast('Saved', 'success');
      updateGitStatus();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  // Page picker
  document.getElementById('page-picker')?.addEventListener('change', (e) => {
    const newPath = (e.target as HTMLSelectElement).value;
    const url = new URL(window.location.href);
    url.searchParams.set('path', newPath);
    window.history.pushState({}, '', url.toString());
    loadFile(newPath);
  });

  // Keyboard shortcut: Cmd/Ctrl+S to save
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('save-btn')!.click();
    }
  });

  // Init slash commands and code picker
  initSlashCommands(textarea);
  initCodePicker(textarea);

  // --- Git status & commit ---
  async function updateGitStatus(): Promise<void> {
    try {
      const res = await fetch('/_opendoc/git-status');
      const status = await res.json();
      const el = document.getElementById('git-status');
      if (!el) return;

      if (!status.isRepo) {
        el.textContent = 'not a git repo';
        el.className = 'od-git-status od-git-muted';
        const cg = document.getElementById('commit-group');
        if (cg) cg.style.display = 'none';
        return;
      }

      el.textContent = status.changes > 0
        ? `${status.changes} changed file${status.changes > 1 ? 's' : ''}`
        : '\u2713 up to date';
      el.className = `od-git-status ${status.changes > 0 ? 'od-git-dirty' : 'od-git-clean'}`;
      if (status.branch) {
        el.title = `Branch: ${status.branch} | Remote: ${status.remote || 'none'}`;
      }
    } catch { /* git status not available */ }
  }

  updateGitStatus();

  // Check for OAuth token in hash
  if (window.location.hash.startsWith('#github_token=')) {
    const ghToken = window.location.hash.slice('#github_token='.length);
    if (ghToken) localStorage.setItem('github_token', ghToken);
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }

  document.getElementById('commit-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('commit-btn') as HTMLButtonElement;
    const msgInput = document.getElementById('commit-msg') as HTMLInputElement;

    btn.disabled = true;
    btn.textContent = 'Committing...';

    const token = localStorage.getItem('github_token') || undefined;

    try {
      const res = await fetch('/_opendoc/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgInput.value.trim() || undefined,
          token,
        }),
      });
      const result = await res.json();

      if (result.ok) {
        showToast(
          result.pushed
            ? `\u2713 Committed & pushed (${result.hash})`
            : `\u2713 Committed locally (${result.hash}) \u2014 push failed or no remote`,
          result.pushed ? 'success' : 'warning',
        );
        msgInput.value = '';
        updateGitStatus();
      } else {
        showToast(`\u2717 ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`\u2717 ${(err as Error).message}`, 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Commit & Push';
  });
}

function renderLogin(): void {
  app.innerHTML = `
    <div class="editor-header">
      <span class="logo">OpenDoc Editor</span>
    </div>
    <div class="login-screen">
      <div class="login-box">
        <h1>OpenDoc Editor</h1>
        <p>Sign in with GitHub to edit documentation.</p>
        <button class="btn btn-primary" id="login-btn">Login to Save</button>
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

  // Check permissions
  repoAccess = await checkRepoAccess(repo, token);

  if (repoAccess === 'none') {
    app.innerHTML = `
      <div class="editor-header">
        <span class="logo">OpenDoc Editor</span>
        <span class="spacer"></span>
        <button class="btn" id="change-repo-btn">Change Repo</button>
        <button class="btn" id="logout-btn">Logout</button>
      </div>
      <div class="login-screen">
        <div class="login-box">
          <h1>No Access</h1>
          <p>You don't have access to <strong>${escapeHtml(repo)}</strong>.</p>
          <button class="btn btn-primary" id="pick-another">Choose Another Repo</button>
        </div>
      </div>
    `;
    document.getElementById('pick-another')!.addEventListener('click', () => {
      localStorage.removeItem('github_repo');
      init();
    });
    document.getElementById('change-repo-btn')!.addEventListener('click', () => {
      localStorage.removeItem('github_repo');
      init();
    });
    document.getElementById('logout-btn')!.addEventListener('click', () => {
      localStorage.removeItem('github_token');
      localStorage.removeItem('github_repo');
      init();
    });
    return;
  }

  const isWrite = repoAccess === 'write';
  const saveLabel = isWrite ? 'Save' : 'Suggest Edit';

  // Build save button HTML
  const saveBtnHtml = isWrite
    ? `<div class="od-save-btn-group" id="save-btn-group">
        <button class="od-save-primary" id="save-btn">${saveLabel}</button>
        <button class="od-save-dropdown-trigger" id="save-dropdown-trigger" aria-label="More save options">
          <svg viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="od-save-dropdown" id="save-dropdown" hidden>
          <button class="od-save-option" id="save-as-pr">Open Pull Request</button>
        </div>
      </div>`
    : `<button class="od-save-primary" id="save-btn" style="border-radius:var(--border-radius)">${saveLabel}</button>`;

  app.innerHTML = `
    <div class="editor-header">
      <span class="logo">OpenDoc Editor</span>
      <span class="repo-name">${escapeHtml(repo)}</span>
      <span class="page-path">${escapeHtml(pagePath)}</span>
      <span class="spacer"></span>
      ${saveBtnHtml}
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

  // Load content
  const content = await loadPageContent(pagePath);
  originalContent = content;
  currentContent = content;
  textarea.value = content;
  preview.innerHTML = renderMarkdown(content);

  // Live preview
  textarea.addEventListener('input', () => {
    currentContent = textarea.value;
    preview.innerHTML = renderMarkdown(currentContent);
  });

  // Save button — direct commit (write) or fork+PR (read)
  document.getElementById('save-btn')!.addEventListener('click', () => {
    handleSave(pagePath, currentContent, token, repo, false);
  });

  // PR option from dropdown (write access only)
  document.getElementById('save-as-pr')?.addEventListener('click', () => {
    handleSave(pagePath, currentContent, token, repo, true);
  });

  // Dropdown toggle
  document.getElementById('save-dropdown-trigger')?.addEventListener('click', () => {
    const dropdown = document.getElementById('save-dropdown');
    if (dropdown) dropdown.hidden = !dropdown.hidden;
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const group = document.getElementById('save-btn-group');
    const dropdown = document.getElementById('save-dropdown');
    if (group && dropdown && !group.contains(e.target as Node)) {
      dropdown.hidden = true;
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
  initSlashCommands(textarea);
  initCodePicker(textarea);

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
  // Local mode: skip GitHub entirely
  if (isLocal) {
    await renderLocalEditor();
    return;
  }

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
