// B23 (Mike 2026-11-08, "Run b23"): localization. The game is written in English, and English is the key: a
// dictionary per language maps each English UI string to its translation, so code keeps writing English and nothing
// needs a key name. The DOM translator walks the UI (text, placeholder, title, aria-label) and swaps known strings
// as they appear, including panels drawn later; switching back to English restores the originals.
// Never translated: anything inside an element with a lang attribute (the Spanish caravan, and the Japanese and Tagalog
// speakers, stay in their own language whatever the UI says, per B16) or marked data-noi18n (lore, player text).
import { ES, ES_PATTERNS } from './i18n/es';

export type Lang = 'en' | 'es';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'en', name: 'English' }, { id: 'es', name: 'Español' }];
const KEY = 'gametool.lang';
const DICTS: Record<Exclude<Lang, 'en'>, { words: Record<string, string>; patterns: [string, string][] }> = { es: { words: ES, patterns: ES_PATTERNS } };

let lang: Lang = (() => { try { const l = localStorage.getItem(KEY); return l === 'es' ? 'es' : 'en'; } catch { return 'en'; } })();
const listeners = new Set<(l: Lang) => void>();
export const getLang = () => lang;
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  document.documentElement.lang = l;
  translateAll();
  for (const f of listeners) f(l);
}
export const onLang = (f: (l: Lang) => void) => { listeners.add(f); return () => listeners.delete(f); };

// Patterns: "Talk to {x}" style entries, compiled once per language. {x} matches anything; the captured part is
// translated again when it is itself a known string (so "Talk to the smith" can become "Hablar con el herrero").
type Compiled = { re: RegExp; to: string; names: string[] };
const compiled = new Map<Lang, Compiled[]>();
function patternsFor(l: Exclude<Lang, 'en'>): Compiled[] {
  let c = compiled.get(l);
  if (!c) {
    c = DICTS[l].patterns.map(([from, to]) => {
      const names: string[] = [];
      const src = from.split(/(\{\w+\})/).map((part) => { const m = /^\{(\w+)\}$/.exec(part); if (m) { names.push(m[1]); return '(.+?)'; } return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('');
      return { re: new RegExp('^' + src + '$'), to, names };
    });
    compiled.set(l, c);
  }
  return c;
}

/** The UI string in the current language (English in, translation out; unknown strings pass through). */
export function t(en: string): string {
  if (lang === 'en' || !en) return en;
  return translate(en, lang);
}
function translate(en: string, l: Exclude<Lang, 'en'>, depth = 0): string {
  const d = DICTS[l].words;
  const hit = d[en];
  if (hit !== undefined) return hit;
  const trimmed = en.trim();
  if (trimmed !== en) { const h = d[trimmed]; if (h !== undefined) return en.replace(trimmed, h); }
  if (depth > 1 || trimmed.length > 160) return en;
  for (const p of patternsFor(l)) {
    const m = p.re.exec(trimmed);
    if (!m) continue;
    let out = p.to;
    p.names.forEach((n, i) => { out = out.replace('{' + n + '}', translate(m[i + 1], l, depth + 1)); });
    return trimmed !== en ? en.replace(trimmed, out) : out;
  }
  return en;
}

// ---------- the DOM translator ----------
const ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const textOrig = new WeakMap<Text, { en: string; shown: string }>();
const attrOrig = new WeakMap<Element, Map<string, { en: string; shown: string }>>();
let root: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function skip(el: Element | null): boolean {
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    if (e.hasAttribute('data-noi18n')) return true;
    if (e.hasAttribute('lang') && e.getAttribute('lang') !== 'en') return true;
    const tag = e.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CANVAS') return true;
  }
  return false;
}
function doText(n: Text) {
  const v = n.nodeValue ?? '';
  const o = textOrig.get(n);
  if (o && v === o.shown) {   // our own write, or unchanged: re-derive only when the language changed
    const want = lang === 'en' ? o.en : translate(o.en, lang);
    if (want !== v) { o.shown = want; n.nodeValue = want; }
    return;
  }
  if (!/[A-Za-z]/.test(v)) { textOrig.delete(n); return; }
  if (skip(n.parentElement)) return;
  const want = lang === 'en' ? v : translate(v, lang);
  textOrig.set(n, { en: v, shown: want });
  if (want !== v) n.nodeValue = want;
}
function doAttrs(el: Element) {
  let m = attrOrig.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    const o = m?.get(a);
    let en = v;
    if (o && v === o.shown) en = o.en;
    else if (skip(el)) continue;
    const want = lang === 'en' ? en : translate(en, lang);
    if (!m) { m = new Map(); attrOrig.set(el, m); }
    m.set(a, { en, shown: want });
    if (want !== v) el.setAttribute(a, want);
  }
}
function walk(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) { doText(node as Text); return; }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.hasAttribute('data-noi18n') || (el.hasAttribute('lang') && el.getAttribute('lang') !== 'en')) return;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CANVAS') return;
  doAttrs(el);
  for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
}
export function translateAll() { if (root) walk(root); }

/** Translate a part of the page now and whenever it changes. */
export function watch(el: HTMLElement) {
  root = el;
  document.documentElement.lang = lang;
  walk(el);
  observer?.disconnect();
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') { if (m.target.nodeType === Node.ELEMENT_NODE) doAttrs(m.target as Element); }
      else m.addedNodes.forEach((n) => { if (!skip(n.parentElement)) walk(n); });
    }
  });
  observer.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}
