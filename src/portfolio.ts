import { escapeHtml } from './submit';
import { loadSketches, sketchDataUrl, sketchMarkdown } from './writing/sketch';
import { loadForge, forgeMarkdown } from './forge/character';
import { loadWeapon, weaponMarkdown, loadSword, swordMarkdown } from './forge/weapon';
import { loadBallads, balladMarkdown } from './campfire/ballad';
import { loadMargins, marginsMarkdown } from './writing/margins';
import { loadFolk, folkMarkdown } from './quest/folklore';
import { loadQuest } from './quest/quest';
import { theoryMarkdown } from './quest/casebook';

// B37 (Mike 2026-11-04 "All 3 yes"): everything you made in one place. Extras → Portfolio lists your hero,
// crossbow, sketches, ballads, margin notes, folklore and theory. "Export portfolio" saves ONE self-contained
// .html file (pictures inside, opens in any browser, each piece's lore file tucked under it for Mike to merge),
// and each piece can be saved as a postcard PNG framed like a gallery plaque (B9). Nothing is sent anywhere.
export interface Piece { kind: string; title: string; text: string; image?: string; color?: string; markdown: string }

const has = (k: string) => { try { return !!localStorage.getItem(k); } catch { return false; } };

export function gatherPortfolio(author: string, titleOf: (entryId: string) => string = (id) => id): Piece[] {
  const out: Piece[] = [];
  if (has('gametool.forge.character')) {
    const c = loadForge();
    out.push({ kind: 'Hero', title: c.name || 'Unnamed hero', text: c.backstory.trim() || 'A look from the Tailor.', color: c.look.primary, markdown: forgeMarkdown(c, author) });
  }
  if (has('gametool.forge.weapon')) {
    const w = loadWeapon();
    out.push({ kind: 'Crossbow', title: w.name || 'Unnamed crossbow', text: [w.engraving && `Engraved: “${w.engraving}”`, w.legend].filter(Boolean).join('\n\n') || `A ${w.stock} crossbow, ${w.stockMat} and ${w.limbMat}.`, color: w.fittings, markdown: weaponMarkdown(w, author) });
  }
  if (has('gametool.forge.sword')) {   // Mike 2026-11-05: the forged sword
    const w = loadSword();
    out.push({ kind: 'Sword', title: w.name || 'Unnamed sword', text: [w.engraving && `Engraved: “${w.engraving}”`, w.legend].filter(Boolean).join('\n\n') || `A ${w.blade} blade, ${w.guard} guard.`, color: w.metal, markdown: swordMarkdown(w, author) });
  }
  for (const s of loadSketches()) out.push({ kind: 'Sketch', title: s.name || 'Untitled sketch', text: '', image: sketchDataUrl(s, 6), markdown: sketchMarkdown(s, author) });
  for (const b of loadBallads()) out.push({ kind: 'Ballad', title: b.title, text: b.verses.map((v) => v.join('\n')).join('\n\n'), markdown: balladMarkdown(b, author) });
  const byEntry = new Map<string, ReturnType<typeof loadMargins>>();
  for (const n of loadMargins()) byEntry.set(n.entryId, [...(byEntry.get(n.entryId) ?? []), n]);
  for (const [id, notes] of byEntry) {
    const e = { id, title: titleOf(id) };
    out.push({ kind: 'Margins', title: `Margins: ${e.title}`, text: notes.map((n) => n.text).join('\n\n'), markdown: marginsMarkdown(e, notes, author) });
  }
  for (const [id, f] of Object.entries(loadFolk())) {
    if (!f.history && !f.rumor) continue;
    out.push({ kind: 'Folklore', title: f.name || id, text: [f.history, f.rumor && `Rumor: ${f.rumor}`].filter(Boolean).join('\n\n'), markdown: folkMarkdown({ id, name: f.name || id }, f, author) });
  }
  const th = loadQuest().theory;
  if (th) out.push({ kind: 'Theory', title: 'A theory', text: th.text, markdown: theoryMarkdown(th, author) });
  return out;
}

/** One file: a page with every piece (pictures inline) and its lore file under it. */
export function portfolioHtml(pieces: Piece[], author: string): string {
  const who = author.trim() || 'a traveller';
  const card = (p: Piece) => `<article><div class="k">${escapeHtml(p.kind)}</div><h2>${escapeHtml(p.title)}</h2>
${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.title)}">` : p.color ? `<div class="sw" style="background:${escapeHtml(p.color)}"></div>` : ''}
${p.text ? `<p>${escapeHtml(p.text).replace(/\n/g, '<br>')}</p>` : ''}
<details><summary>Lore file</summary><pre>${escapeHtml(p.markdown)}</pre></details></article>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portfolio of ${escapeHtml(who)} · Tales of Artheria</title><style>
body{margin:0;padding:24px 16px;background:#1E2420;color:#EFE3C4;font:16px/1.5 Georgia,serif}
header,main{max-width:860px;margin:0 auto}h1{margin:0 0 4px;font-size:28px}.sub{color:#B9B2A0;margin:0 0 20px}
main{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
article{background:#EFE3C4;color:#2B2A24;border:6px solid #6B4423;outline:2px solid #C9A86A;outline-offset:-10px;border-radius:4px;padding:16px 18px}
.k{font:600 11px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8A5A2B}h2{margin:6px 0 10px;font-size:20px}
img{width:100%;image-rendering:pixelated;border:1px solid #C9A86A}.sw{height:40px;border-radius:4px;border:1px solid #6B4423}
p{white-space:normal}details{margin-top:8px;font-size:13px}pre{white-space:pre-wrap;font-size:12px;background:#E3D4AE;padding:8px;border-radius:4px}
</style></head><body><header><h1>Portfolio of ${escapeHtml(who)}</h1><p class="sub">${pieces.length} pieces made in Tales of Artheria · ${new Date().toISOString().slice(0, 10)}</p></header>
<main>${pieces.map(card).join('\n')}</main></body></html>`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

/** A 1200×800 postcard, framed like a gallery plaque, as a canvas (PNG via toBlob). */
export async function postcard(p: Piece, author: string): Promise<HTMLCanvasElement> {
  const W = 1200, H = 800, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#6B4423'; x.fillRect(0, 0, W, H);                       // the frame
  x.fillStyle = '#EFE3C4'; x.fillRect(28, 28, W - 56, H - 56);           // the card
  x.strokeStyle = '#C9A86A'; x.lineWidth = 4; x.strokeRect(44, 44, W - 88, H - 88);
  let left = 90;
  if (p.image) {
    const img = new Image(); img.src = p.image;
    await img.decode().catch(() => undefined);
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 90, 150, 480, 480); x.strokeRect(90, 150, 480, 480);
    left = 620;
  } else if (p.color) { x.fillStyle = p.color; x.fillRect(90, 150, 120, 120); x.strokeRect(90, 150, 120, 120); left = 250; }
  x.fillStyle = '#8A5A2B'; x.font = '600 22px system-ui, sans-serif'; x.fillText(p.kind.toUpperCase(), 90, 110);
  x.fillStyle = '#2B2A24'; x.font = 'bold 44px Georgia, serif';
  x.fillText(p.title.slice(0, 40), left, 190);
  x.font = '26px Georgia, serif';
  const lines = wrap(x, p.text || '', W - left - 100).slice(0, 14);
  lines.forEach((l, i) => x.fillText(l, left, 250 + i * 36));
  x.fillStyle = '#6B4423'; x.font = 'italic 22px Georgia, serif';
  x.fillText(`by ${author.trim() || 'a traveller'} · Tales of Artheria`, 90, H - 80);
  return c;
}

export function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'piece';
