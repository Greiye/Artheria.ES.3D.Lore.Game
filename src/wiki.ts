import * as THREE from 'three';
import type { Collider } from './world';
import { renderMarkdown } from './markdown';
import { escapeHtml } from './submit';

// B21 (Mike 2026-10-31): the GitHub wiki inside the game. scripts/pull-wiki.mjs pulls it at build time into
// content/wiki/ and the build bakes the pages in (__WIKI__), so it reads offline and never calls GitHub while you
// play. Read it at the reading room lectern in the Ruined Library, or from Extras → Wiki on the main menu.
// Wiki links ([[Page]], [[Text|Page]], [text](Page)) stay inside; web links open in a new tab.
export interface WikiPage { slug: string; title: string; md: string }
declare const __WIKI__: WikiPage[];
export const WIKI_PAGES: WikiPage[] = typeof __WIKI__ === 'undefined' ? [] : __WIKI__;
export const WIKI_URL = 'https://github.com/Greiye/Artheria.ES.3D.Lore.Game/wiki';

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/\.md$/, '');
export const findPage = (name: string) => WIKI_PAGES.find((p) => norm(p.slug) === norm(name) || norm(p.title) === norm(name));

/** Wiki markdown → elements. Links are swapped for tokens before the (escaping) renderer and put back as safe <a>s. */
export function renderWiki(md: string): HTMLElement[] {
  const links: { text: string; to: string }[] = [];
  const token = (text: string, to: string) => { links.push({ text, to: to.trim() }); return `\u0001${links.length - 1}\u0001`; };
  const src = md
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, a: string, b: string) => token(a, b))
    .replace(/\[\[([^\]]+)\]\]/g, (_m, a: string) => token(a, a))
    .replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => token(t, u))
    .replace(/<!--[\s\S]*?-->/g, '');
  const els = renderMarkdown(src, () => null);
  for (const el of els) el.innerHTML = el.innerHTML.replace(/\u0001(\d+)\u0001/g, (_m, n: string) => {
    const l = links[Number(n)];
    if (/^https?:\/\//i.test(l.to)) return `<a href="${escapeHtml(l.to)}" target="_blank" rel="noopener">${escapeHtml(l.text)}</a>`;
    const p = findPage(decodeURIComponent(l.to.replace(/^.*\/wiki\//, '').replace(/#.*$/, '')));
    return p ? `<a href="#" class="wikilink" data-page="${escapeHtml(p.slug)}">${escapeHtml(l.text)}</a>` : `<span class="missing-link">${escapeHtml(l.text)}</span>`;
  });
  return els;
}

export class WikiPanel {
  readonly el: HTMLDivElement;
  page: WikiPage | null = null;
  private onClose: () => void = () => {};
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'wiki';
    this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const a = t.closest<HTMLElement>('[data-page]');
      if (a) { e.preventDefault(); this.show(a.dataset.page!); return; }
      if (t.closest('#wkIndex')) this.show(null);
      else if (t.closest('#wkClose')) this.close();
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open(onClose: () => void, where: 'library' | 'menu') {
    this.onClose = onClose;
    this.el.dataset.where = where;
    this.show(WIKI_PAGES.length === 1 ? WIKI_PAGES[0].slug : null);
    this.el.classList.remove('hidden');
  }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  /** B / Esc: from a page back to the index, from the index out. */
  back() { if (this.page && WIKI_PAGES.length > 1) this.show(null); else this.close(); }
  show(slug: string | null) {
    this.page = slug ? WIKI_PAGES.find((p) => p.slug === slug) ?? null : null;
    const where = this.el.dataset.where === 'library' ? 'Reading room · Ruined Library' : 'Extras';
    const head = `<div class="eyebrow">${where} · Wiki</div>`;
    const foot = `<p class="fine wk-src">From the <a href="${WIKI_URL}" target="_blank" rel="noopener">GitHub wiki</a>, as of this build. Public lore only.</p>
      <div class="row">${this.page && WIKI_PAGES.length > 1 ? '<button class="secondary" id="wkIndex">All pages</button>' : ''}<button class="secondary" id="wkClose">Close</button></div>`;
    if (!this.page) {
      this.el.innerHTML = `<div class="card wk-card">${head}<h1>Wiki</h1>
        ${WIKI_PAGES.length ? `<ul class="wk-index">${WIKI_PAGES.map((p) => `<li><button class="secondary" data-page="${escapeHtml(p.slug)}">${escapeHtml(p.title)}</button></li>`).join('')}</ul>` : '<p class="fine">No pages yet.</p>'}${foot}</div>`;
    } else {
      this.el.innerHTML = `<div class="card wk-card">${head}<h1>${escapeHtml(this.page.title)}</h1><div class="wk-body"></div>${foot}</div>`;
      this.el.querySelector('.wk-body')!.append(...renderWiki(this.page.md));
    }
    this.el.querySelector<HTMLElement>('.wk-card')?.scrollTo?.(0, 0);
  }
}

/** The reading room lectern, just inside the Ruined Library on the left of the aisle, with an open book. */
export const LECTERN = { x: -5, z: -21.5 };
export function buildWikiLectern(group: THREE.Group, colliders: Collider[]): THREE.Mesh {
  const { x, z } = LECTERN, wood = new THREE.MeshLambertMaterial({ color: 0x6B4428 }), page = new THREE.MeshLambertMaterial({ color: 0xEFE3C4 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), wood); post.position.set(x, 0.52, z);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.5), wood); foot.position.set(x, 0.04, z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.46), wood); top.position.set(x, 1.1, z); top.rotation.z = -0.35;
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.34), page); book.position.set(x + 0.01, 1.14, z); book.rotation.z = -0.35;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.03), new THREE.MeshLambertMaterial({ color: 0x2F5F86 })); spine.position.set(x, 1.135, z); spine.rotation.z = -0.35;
  for (const m of [post, foot, top, book, spine]) { m.castShadow = true; m.raycast = () => {}; group.add(m); }
  colliders.push({ kind: 'circle', x, z, r: 0.35 });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, 0.7, z); hit.name = 'wiki-lectern'; group.add(hit);
  return hit;
}
