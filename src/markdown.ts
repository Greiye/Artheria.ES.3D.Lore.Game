// F3.5: small built-in Markdown renderer (headings, bold, italic, lists, images, plus quotes,
// inline code and rules). Built in rather than a library so the game has no network/CDN
// dependency. Returns a flat list of block elements so the book can paginate block by block.
// All text is escaped; raw HTML in lore is shown as text, never executed.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type ImageResolver = (src: string) => string | null;
// F5.6: [[slug]] → a tappable link (title from the index); unknown slug → plain text with a "missing page" note.
export type LinkResolver = (slug: string) => string | null;
let linkResolver: LinkResolver = () => null;
export function setLinkResolver(r: LinkResolver) { linkResolver = r; }

function inline(text: string, resolve: ImageResolver): string {
  let s = esc(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const url = resolve(src.replace(/&amp;/g, '&'));
    return url ? `<img src="${esc(url)}" alt="${alt}">` : `<span class="missing-img">[image: ${alt || src}]</span>`;
  });
  s = s.replace(/\[\[([a-zA-Z0-9][a-zA-Z0-9-]*)\]\]/g, (_m, slug: string) => {
    const t = linkResolver(slug.toLowerCase());
    return t ? `<a href="#" class="wikilink" data-link="${esc(slug.toLowerCase())}">${esc(t)}</a>` : `<span class="missing-link">${esc(slug)} <em>(missing page)</em></span>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => `<strong>${a ?? b}</strong>`);
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)|(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g,
    (_m, p1, a, p2, b) => `${p1 ?? p2 ?? ''}<em>${a ?? b}</em>`);
  return s;
}

export function renderMarkdown(md: string, resolve: ImageResolver): HTMLElement[] {
  const out: HTMLElement[] = [];
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const mk = (tag: string, html: string) => { const e = document.createElement(tag); e.innerHTML = html; out.push(e); return e; };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { mk('h' + Math.min(4, h[1].length + 1), inline(h[2].trim(), resolve)); i++; continue; }
    if (/^(\*\s*\*\s*\*|-\s*-\s*-)[\s*-]*$/.test(line)) { out.push(document.createElement('hr')); i++; continue; }
    const li = /^\s*([-*+]|\d+[.)])\s+/;
    if (li.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (i < lines.length && li.test(lines[i])) {
        const item = document.createElement('li');
        item.innerHTML = inline(lines[i].replace(li, ''), resolve);
        list.appendChild(item); i++;
      }
      out.push(list); continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      mk('blockquote', buf.map((l) => inline(l, resolve)).join('<br>')); continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])) buf.push(lines[i++].trim());
    const p = buf.join(' ');
    // A paragraph that is only an image becomes a figure block (sized to fit a page).
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(p)) mk('figure', inline(p, resolve)); else mk('p', inline(p, resolve));
  }
  return out;
}
