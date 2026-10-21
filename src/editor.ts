// Backlog item promoted 2026-10-18: write a lore entry from inside the game and publish it
// straight to GitHub (Contents API) — no git, no npm, no local file juggling. If no publish
// token is set up yet, the entry downloads as a .md file instead, for manual upload.
// The token lives only in this browser's localStorage; it is never sent anywhere but
// api.github.com, and only when "Publish to GitHub" is clicked.

const GH_KEY = 'gametool.github';
const AUTHOR_KEY = 'gametool.author';

export interface GitHubConfig { owner: string; repo: string; branch: string; token: string }

export function loadGitHub(): GitHubConfig {
  try {
    const raw = localStorage.getItem(GH_KEY);
    if (!raw) return { owner: '', repo: '', branch: 'main', token: '' };
    const c = JSON.parse(raw) as Partial<GitHubConfig>;
    return {
      owner: typeof c.owner === 'string' ? c.owner : '',
      repo: typeof c.repo === 'string' ? c.repo : '',
      branch: typeof c.branch === 'string' && c.branch ? c.branch : 'main',
      token: typeof c.token === 'string' ? c.token : '',
    };
  } catch { return { owner: '', repo: '', branch: 'main', token: '' }; }
}

export function saveGitHub(c: GitHubConfig): void {
  try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch { /* private mode / quota */ }
}

export function loadAuthor(): string {
  try { return localStorage.getItem(AUTHOR_KEY) ?? ''; } catch { return ''; }
}
export function saveAuthor(name: string): void {
  try { localStorage.setItem(AUTHOR_KEY, name); } catch { /* ignore */ }
}

// Mirrors build-lore.mjs's filename convention: a plain, URL-safe slug of the title.
export function slugify(title: string): string {
  const s = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'entry';
}

function b64utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Builds the same frontmatter+body shape build-lore.mjs validates (title/contributor/credit_as/created/tags/type).
// D9: the name the player typed is also their credit line, exactly as written.
export function buildMarkdown(title: string, contributor: string, tags: string[], body: string): string {
  const created = new Date().toISOString().slice(0, 10);
  const clean = tags.map((t) => t.trim()).filter(Boolean);
  const tagLine = `[${(clean.length ? clean : ['misc']).join(', ')}]`;
  return `---\ntitle: ${title}\ncontributor: ${contributor}\ncredit_as: ${contributor}\ncreated: ${created}\ntags: ${tagLine}\ntype: lore\n---\n${body.trim()}\n`;
}

export type PublishResult = { ok: true; actionsUrl: string } | { ok: false; error: string };

export async function publishToGitHub(cfg: GitHubConfig, slug: string, markdown: string, title: string): Promise<PublishResult> {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return { ok: false, error: 'GitHub publish settings aren\'t filled in yet (owner / repo / token).' };
  }
  const put = (name: string) => fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/content/lore/${name}.md`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Add lore: ${title}`, content: b64utf8(markdown), branch: cfg.branch }),
  });
  try {
    let res = await put(slug);
    if (res.status === 422) {
      // That filename is already taken — retry once under a disambiguated name rather than failing outright.
      res = await put(`${slug}-${Date.now().toString(36)}`);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { message?: string }));
      return { ok: false, error: `GitHub said: ${res.status} ${body.message ?? res.statusText}` };
    }
    return { ok: true, actionsUrl: `https://github.com/${cfg.owner}/${cfg.repo}/actions` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error — check the connection or the token.' };
  }
}

export function downloadMarkdown(slug: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
