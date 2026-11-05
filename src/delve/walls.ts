// Mike 2026-11-05: the Inn's two walls, and the last words of a fallen hero.
//   The death tally: a book chained to the wall; read it for every hero lost below (name, deepest floor, books
//   handed in, what killed them, the date, and their last words).
//   The survivors' wall: the ones who reached the hoard and climbed out alive, as drawings. Only Kavik, to start.
import * as THREE from 'three';
import { drawKavik, loadSurvivors, loadTally, type Survivor } from './descent';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function survivorArt(s: Survivor, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  if (s.kavik) drawKavik(g, size, size);
  else if (s.art) { const img = new Image(); img.onload = () => { g.drawImage(img, 0, 0, size, size); }; img.src = s.art; g.fillStyle = '#EADBB4'; g.fillRect(0, 0, size, size); }
  else { g.fillStyle = '#EADBB4'; g.fillRect(0, 0, size, size); g.fillStyle = '#3A2E22'; g.font = `italic ${size / 8}px Georgia, serif`; g.textAlign = 'center'; g.fillText(s.name, size / 2, size / 2); }
  return c;
}

/** The two walls, read up close. */
export class InnWalls {
  readonly el: HTMLDivElement;
  isOpen = false;
  private done: () => void = () => undefined;
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'innWall'; this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act="close"]')) this.close(); });
  }
  open(which: 'tally' | 'survivors', done: () => void) {
    this.done = done; this.isOpen = true;
    if (which === 'tally') {
      const t = loadTally();
      this.el.innerHTML = `<div class="card narrow wall-card"><div class="eyebrow">The Inn · chained to the wall</div><h1>The Death Tally</h1>
        <p class="fine">Everyone who went down for the books and didn't come back up. The innkeeper adds a line each time.</p>
        ${t.length ? `<ol class="tally">${t.map((f) => `<li><b>${esc(f.name)}</b> · floor ${f.floor} · ${f.books} book${f.books === 1 ? '' : 's'} handed in · slain by ${esc(f.by)} <span class="fine">${esc(f.at)}</span>${f.words ? `<div class="tally-words">“${esc(f.words)}”</div>` : ''}</li>`).join('')}</ol>`
        : '<p class="tally-empty">No names yet. The page is ruled and waiting.</p>'}
        <button class="secondary" data-act="close">Close</button></div>`;
    } else {
      const s = loadSurvivors();
      this.el.innerHTML = `<div class="card wall-card"><div class="eyebrow">The Inn · pinned up by the hearth</div><h1>The Survivors' Wall</h1>
        <p class="fine">Reach the hoard on the thirtieth floor and climb back out alive, and your drawing goes up here.</p>
        <div class="survivors"></div><button class="secondary" data-act="close">Close</button></div>`;
      const grid = this.el.querySelector('.survivors')!;
      for (const v of s) {
        const fig = document.createElement('figure'); fig.className = 'survivor';
        fig.appendChild(survivorArt(v, 160));
        const cap = document.createElement('figcaption'); cap.innerHTML = `<b>${esc(v.name)}</b>${v.at ? ` <span class="fine">${esc(v.at)}</span>` : ''}${v.line ? `<div class="fine">${esc(v.line)}</div>` : ''}`;
        fig.appendChild(cap); grid.appendChild(fig);
      }
    }
    this.el.classList.remove('hidden');
  }
  close() { if (!this.isOpen) return; this.isOpen = false; this.el.classList.add('hidden'); this.done(); }
}

/** A fallen hero's last words: an epitaph or a line of a ballad, for the tally. */
export class LastWords {
  readonly el: HTMLDivElement;
  isOpen = false;
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'lastWords'; this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
  }
  open(o: { name: string; floor: number; by: string; books: number; lost: number }, done: (words: string) => void) {
    this.isOpen = true;
    this.el.innerHTML = `<div class="card narrow"><div class="eyebrow">Floor ${o.floor} · under the Ruined Library</div><h1>${esc(o.name)} has fallen</h1>
      <p>${esc(o.by)} got the last blow in. The bag, the crowns${o.lost ? ` and ${o.lost} carried book${o.lost === 1 ? '' : 's'}` : ''} stay down there.
      Your writing, sketches, forge designs and the gallery are kept; ${o.books} book${o.books === 1 ? '' : 's'} reached Natalie.</p>
      <label class="field">Last words, for the tally at the Inn (an epitaph, or a line of a ballad)<textarea id="lwText" maxlength="200" rows="3" placeholder="Tell them the stairs moved."></textarea></label>
      <button class="primary" data-act="write">Carve it</button><button class="secondary" data-act="skip">Leave it unsaid</button></div>`;
    this.el.classList.remove('hidden');
    const finish = (w: string) => { this.isOpen = false; this.el.classList.add('hidden'); done(w.trim().slice(0, 200)); };
    this.el.querySelector('[data-act="write"]')!.addEventListener('click', () => finish((this.el.querySelector('#lwText') as HTMLTextAreaElement).value));
    this.el.querySelector('[data-act="skip"]')!.addEventListener('click', () => finish(''));
  }
}

/** The boards on the Inn's front wall, either side of the door: the tally (a book on a shelf) and the drawings. */
export function buildInnBoards(): { tally: THREE.Group; wall: THREE.Group; refresh(): void } {
  const wood = new THREE.MeshLambertMaterial({ color: '#5E4128' });
  const board = (w: number, h: number) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map: t }), wood]);
    m.castShadow = true;
    return { m, c, t };
  };
  const tally = new THREE.Group(); tally.name = 'inn-tally';
  const tb = board(0.9, 1.1); tb.m.position.y = 1.6; tally.add(tb.m);
  const wall = new THREE.Group(); wall.name = 'inn-survivors';
  const wb = board(1.4, 1.0); wb.m.position.y = 1.65; wall.add(wb.m);
  const refresh = () => {
    let g = tb.c.getContext('2d')!;
    g.fillStyle = '#E4D2A6'; g.fillRect(0, 0, tb.c.width, tb.c.height);
    g.strokeStyle = '#4A3222'; g.lineWidth = 8; g.strokeRect(4, 4, tb.c.width - 8, tb.c.height - 8);
    g.fillStyle = '#2A1E14'; g.textAlign = 'center'; g.font = 'bold 30px Georgia, serif'; g.fillText('The Tally', 128, 48);
    const t = loadTally();
    g.font = '18px Georgia, serif';
    t.slice(0, 7).forEach((f, i) => g.fillText(`${f.name} · floor ${f.floor}`.slice(0, 26), 128, 90 + i * 28));
    if (!t.length) { g.font = 'italic 18px Georgia, serif'; g.fillText('No names yet.', 128, 110); }
    g.font = 'italic 16px Georgia, serif'; g.fillText(`${t.length} lost below`, 128, tb.c.height - 22);
    tb.t.needsUpdate = true;
    g = wb.c.getContext('2d')!;
    g.fillStyle = '#7A5634'; g.fillRect(0, 0, wb.c.width, wb.c.height);
    const s = loadSurvivors();
    g.textAlign = 'center'; g.fillStyle = '#F4E6C0';
    if (s.length === 1) { g.drawImage(survivorArt(s[0], 128), 68, 14, 120, 120); g.font = 'italic 16px Georgia, serif'; g.fillText('Room for more.', 128, 168); }
    else s.slice(-3).forEach((v, i) => { g.drawImage(survivorArt(v, 128), 10 + i * 82, 30, 76, 76); g.font = '13px Georgia, serif'; g.fillText(v.name.slice(0, 11), 48 + i * 82, 126); });
    wb.t.needsUpdate = true;
  };
  refresh();
  return { tally, wall, refresh };
}
