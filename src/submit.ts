// Curated submissions (Mike, 2026-10-26): player-made things stay on this device. "Submit" never
// writes anywhere public: it hands the player a lore file to download or copy, and a pre-filled
// GitHub issue to send it to the maintainer, who reviews and merges it (credit_as gives the credit).
import { downloadMarkdown, slugify } from './editor';

export const SUBMIT_REPO = 'Greiye/Artheria.ES.3D.Lore.Game';
const MAX_URL_BODY = 6000;   // GitHub's new-issue URL starts failing past ~8 KB

export interface Submission { kind: string; title: string; markdown: string }

export function issueUrl(s: Submission): string {
  const body = s.markdown.length > MAX_URL_BODY
    ? `${s.markdown.slice(0, MAX_URL_BODY)}\n\n…(cut: attach the downloaded .md file for the rest)`
    : s.markdown;
  const intro = `A player submitted a ${s.kind} from the game. Review it, then add it under content/ to publish.\n\n\`\`\`markdown\n`;
  return `https://github.com/${SUBMIT_REPO}/issues/new?title=${encodeURIComponent(`[${s.kind}] ${s.title}`)}&labels=submission&body=${encodeURIComponent(intro + body + '\n```\n')}`;
}

// Front matter in the same shape build-lore.mjs validates. `extra` adds type-specific fields.
export function entryMarkdown(o: { title: string; author: string; type: string; tags: string[]; body: string; extra?: Record<string, string> }): string {
  const created = new Date().toISOString().slice(0, 10);
  const q = (v: string) => JSON.stringify(v);
  const extra = Object.entries(o.extra ?? {}).map(([k, v]) => `${k}: ${q(v)}\n`).join('');
  const who = o.author.trim() || 'anonymous';
  return `---\ntitle: ${q(o.title)}\ncontributor: ${q(who)}\ncredit_as: ${q(who)}\ncreated: ${created}\ntags: [${o.tags.join(', ')}]\ntype: ${o.type}\n${extra}---\n${o.body.trim()}\n`;
}

// The submit sheet: one small panel reused by every creative tool.
export function openSubmitSheet(s: Submission, onClose: () => void = () => undefined): HTMLElement {
  const el = document.createElement('div');
  el.className = 'submit-sheet';
  el.innerHTML = `
    <div class="submit-card" role="dialog" aria-label="Submit">
      <h3>Submit "${escapeHtml(s.title)}"</h3>
      <p>It stays saved on this device. To share it with everyone, send it to the maintainer: they review it and
      add it to the game with your name on it. Nothing is published until then.</p>
      <div class="submit-actions">
        <a class="btn" data-act="issue" target="_blank" rel="noopener">Send for review (GitHub)</a>
        <button class="btn" data-act="download">Download .md</button>
        <button class="btn" data-act="copy">Copy text</button>
        <button class="btn ghost" data-act="close">Close</button>
      </div>
    </div>`;
  (el.querySelector('[data-act=issue]') as HTMLAnchorElement).href = issueUrl(s);
  el.querySelector('[data-act=download]')!.addEventListener('click', () => downloadMarkdown(slugify(s.title), s.markdown));
  el.querySelector('[data-act=copy]')!.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(s.markdown); (e.target as HTMLElement).textContent = 'Copied'; } catch { (e.target as HTMLElement).textContent = 'Copy failed'; }
  });
  el.querySelector('[data-act=close]')!.addEventListener('click', () => { el.remove(); onClose(); });
  document.body.appendChild(el);
  return el;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
