import changelog from '../CHANGELOG.md?raw';
import { renderMarkdown } from './markdown';
import { escapeHtml } from './submit';
import { VERSION } from './version';
import './whatsnew.css';

// v0.06 M6: "What's new", shown once per session on Begin. Built from CHANGELOG.md (the one changelog), so it never
// drifts: the current version is open at the top, every older version is a bar you can open. In the merged
// "Unreleased" block a section belongs to the version named by the next "vX.YY" heading below it (style and
// leanness passes shipped inside a version round); sections below the last one are the v0.03 round.
export interface VersionNotes { version: string; sections: { title: string; body: string }[] }

export function parseChangelog(md: string, current = VERSION): VersionNotes[] {
  const out: VersionNotes[] = [];
  const blocks = md.replace(/\r\n?/g, '\n').split(/^## /m).slice(1);
  for (const block of blocks) {
    const [head, ...rest] = block.split('\n');
    const secs = rest.join('\n').split(/^### /m);
    const lead = secs.shift() ?? '';
    const released = /^(\d+\.\d+)/.exec(head.trim());
    if (released) { out.push({ version: released[1], sections: [{ title: head.trim(), body: lead.trim() }] }); continue; }
    let pending: VersionNotes['sections'] = [];
    for (const s of secs) {
      const [t, ...b] = s.split('\n');
      pending.push({ title: t.trim(), body: b.join('\n').trim() });
      const v = /\bv(\d+\.\d+)/.exec(t)?.[1];
      if (!v) continue;
      const at = out.find((o) => o.version === v);
      if (at) at.sections.push(...pending); else out.push({ version: v, sections: pending });
      pending = [];
    }
    if (pending.length) {
      const at = out.find((o) => o.version === '0.03');
      if (at) at.sections.push(...pending); else out.push({ version: '0.03', sections: pending });
    }
  }
  // The version being built may have no tagged section yet: give it an empty entry so it still leads.
  if (!out.some((o) => o.version === current)) out.unshift({ version: current, sections: [] });
  return out.sort((a, b) => Number(b.version) - Number(a.version));
}

export class WhatsNew {
  readonly el: HTMLDivElement;
  readonly notes = parseChangelog(changelog);
  shown = false;
  private onClose = () => {};

  constructor(prompt: string) {
    this.el = document.createElement('div');
    this.el.id = 'whatsNew';
    this.el.className = 'screen hidden';
    this.el.innerHTML = `<div class="card wn-card" role="dialog" aria-label="What's new">
      <button class="wn-x" data-act="close" aria-label="Close">✕</button>
      <div class="eyebrow">Tales of Artheria</div><h1>What's new</h1>
      <div class="wn-list">${this.notes.map((n, i) => `<details class="wn-ver"${i === 0 ? ' open' : ''} data-v="${n.version}">
        <summary>v${n.version}${i === 0 ? ' <span class="wn-now">this version</span>' : ''}</summary>
        <div class="wn-body"></div></details>`).join('')}</div>
      <p class="daily"><span>Today's prompt</span><span id="dailyPrompt">${escapeHtml(prompt)}</span></p>
      <button class="primary" data-act="close">Continue</button></div>`;
    document.body.appendChild(this.el);
    // Bodies render when a bar first opens (the older rounds are long).
    this.el.querySelectorAll<HTMLDetailsElement>('.wn-ver').forEach((d, i) => {
      const fill = () => {
        const body = d.querySelector('.wn-body')!;
        if (body.childElementCount) return;
        for (const s of this.notes[i].sections) {
          const h = document.createElement('h3'); h.textContent = s.title; body.appendChild(h);
          renderMarkdown(s.body, () => null).forEach((e) => body.appendChild(e));
        }
      };
      if (d.open) fill();
      d.addEventListener('toggle', () => { if (d.open) fill(); });
    });
    this.el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act="close"]')) this.close(); });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open(onClose: () => void) {
    this.shown = true;
    this.onClose = onClose;
    this.el.classList.remove('hidden');
    this.el.querySelector<HTMLButtonElement>('button.primary')?.focus({ preventScroll: true });
  }
  close() {
    if (!this.isOpen) return;
    this.el.classList.add('hidden');
    this.onClose();
  }
}
