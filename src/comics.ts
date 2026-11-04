// B47 (Mike 2026-11-04): comic-book versions of the lore books. A book with a file in content/comics/<entry-id>.json
// can be read as panels as well as text; the book's Text / Comic button flips between them. The lore text stays the
// source of truth: captions and speech are lines quoted from it (test/e2e-comics.mjs checks that).
// Panel art lives in content/assets/comics/<entry-id>/; until a panel has a file it draws a placeholder card.
import { portraitFile, placeholder } from './dialogue';
import './comics.css';

export interface ComicLine { who: string; name: string; text: string }
export interface ComicPanel { scene: string; art?: string; caption?: string; say?: ComicLine[]; wide?: boolean }
export interface Comic { book: string; panels: ComicPanel[] }

const files = import.meta.glob('../content/comics/*.json', { eager: true, import: 'default' }) as Record<string, Comic>;
export const comics = new Map(Object.values(files).map((c) => [c.book, c]));

const art = import.meta.glob('../content/assets/comics/*/*.{png,jpg,jpeg,webp,svg}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const artFor = (book: string, file: string) => art[`../content/assets/comics/${book}/${file}`] ?? null;

// Per profile (not a shared setting): every "gametool.*" key outside profiles.ts SHARED follows the profile.
const MODE_KEY = 'gametool.bookmode';
export type BookMode = 'text' | 'comic';
export function bookMode(): BookMode {
  try { return localStorage.getItem(MODE_KEY) === 'comic' ? 'comic' : 'text'; } catch { return 'text'; }
}
export function setBookMode(m: BookMode) { try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ } }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Placeholder panel: an inked frame tinted from the scene text, with the scene written in pencil.
function sketch(scene: string): string {
  let h = 0; for (const c of scene) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `<div class="cp-sketch" style="--hue:${hue}"><span>${esc(scene)}</span></div>`;
}

function face(who: string, name: string): string {
  const f = portraitFile(who);
  return f ? `<img src="portraits/${encodeURI(f)}" alt="">` : placeholder(name);
}

/** One block per panel, so the book's paginator lays panels out page by page. */
export function comicBlocks(c: Comic): HTMLElement[] {
  return c.panels.map((p, i) => {
    const el = document.createElement('figure');
    el.className = 'comic-panel' + (p.wide ? ' wide' : '');
    el.dataset.panel = String(i + 1);
    const src = p.art ? artFor(c.book, p.art) : null;
    el.innerHTML = (p.caption ? `<figcaption class="cp-cap">${esc(p.caption)}</figcaption>` : '')
      + `<div class="cp-art">${src ? `<img src="${src}" alt="${esc(p.scene)}">` : sketch(p.scene)}</div>`
      + (p.say ?? []).map((s) => `<div class="cp-say"><span class="cp-face">${face(s.who, s.name)}</span><span class="cp-bubble"><b>${esc(s.name)}</b> ${esc(s.text)}</span></div>`).join('');
    return el;
  });
}
