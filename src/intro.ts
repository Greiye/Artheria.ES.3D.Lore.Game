import { audio } from './audio';
import './intro.css';

// v0.05 boot sequence: a 1 s developer splash, then the title (a carved stone wall that slowly pans and zooms,
// flowing water, the logo), and on any key, click, tap or pad button the main menu (#title) underneath.
// Browsers keep sound locked until the first input, so on a cold load the splash jingle is skipped and the
// water starts with that first input; it keeps running under the main menu until Begin.
export type IntroPhase = 'splash' | 'title' | 'done';

const BOOK_SWORD = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <path d="M60 34 C46 26 26 26 14 30 L14 92 C26 88 46 88 60 96 C74 88 94 88 106 92 L106 30 C94 26 74 26 60 34 Z" fill="#2A2218" stroke="#E8D3A0" stroke-width="3" stroke-linejoin="round"/>
  <path d="M60 34 L60 96" stroke="#E8D3A0" stroke-width="2.5"/>
  <path d="M24 42 C34 39 44 39 52 42 M24 52 C34 49 44 49 52 52 M24 62 C34 59 44 59 52 62 M68 42 C76 39 86 39 96 42 M68 52 C76 49 86 49 96 52" stroke="#9C8A62" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M60 6 L64 14 L64 78 L60 86 L56 78 L56 14 Z" fill="#D9DEE6" stroke="#8C96A6" stroke-width="1.5"/>
  <rect x="44" y="76" width="32" height="6" rx="2" fill="#C9A36B" stroke="#7A5A30" stroke-width="1.5"/>
  <rect x="57" y="82" width="6" height="22" rx="2" fill="#5A3A22"/>
  <circle cx="60" cy="108" r="5" fill="#C9A36B" stroke="#7A5A30" stroke-width="1.5"/>
</svg>`;

/** A stone wall with carved symbols, drawn once on a canvas and used as a tiling background. */
function wallTexture(): string {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  if (!g) return '';
  let seed = 4242;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#3B3833'; g.fillRect(0, 0, S, S);
  const rowH = 64;
  for (let row = 0; row < S / rowH; row++) {
    const y = row * rowH, off = row % 2 ? -48 : 0;
    for (let x = off; x < S; x += 96 + Math.floor(R() * 3) * 16) {
      const w = 92 + Math.floor(R() * 2) * 16, tone = 58 + Math.floor(R() * 22);
      g.fillStyle = `rgb(${tone + 6},${tone + 2},${tone - 6})`;
      g.fillRect(x + 3, y + 3, w - 6, rowH - 6);
      // Chisel marks and lichen: the natural "noise" of real stone.
      for (let k = 0; k < 140; k++) {
        const v = Math.floor(R() * 40) - 20;
        g.fillStyle = `rgba(${tone + v},${tone + v - 2},${tone + v - 8},0.55)`;
        g.fillRect(x + 4 + R() * (w - 10), y + 4 + R() * (rowH - 10), 2 + R() * 4, 2 + R() * 3);
      }
      if (R() < 0.25) { g.fillStyle = 'rgba(96,120,70,0.35)'; g.beginPath(); g.ellipse(x + R() * w, y + rowH - 8, 10 + R() * 18, 5 + R() * 6, 0, 0, Math.PI * 2); g.fill(); }
    }
  }
  // Carved symbols: a dark groove with a lit lower edge, so they read as cut into the stone.
  const glyphs: [number, number][][][] = [
    [[[0, -1], [0, 1]], [[-0.6, -0.4], [0, 0], [0.6, -0.4]]],                    // a branching rune
    [[[-0.7, 0.7], [0, -0.8], [0.7, 0.7], [-0.7, 0.7]]],                         // a triangle
    [[[-0.8, 0], [0.8, 0]], [[0, -0.8], [0, 0.8]], [[-0.5, -0.5], [0.5, 0.5]]],  // a star
    [[[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]]],                      // a zigzag
    [[[0, -0.9], [0.8, 0], [0, 0.9], [-0.8, 0], [0, -0.9]], [[0, -0.3], [0, 0.3]]], // a lozenge eye
  ];
  const carve = (cx: number, cy: number, r: number, gi: number) => {
    for (const [col, dx, dy, lw] of [['rgba(20,18,16,0.85)', 0, 0, 5], ['rgba(190,180,150,0.32)', 1.5, 2, 2]] as const) {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const stroke of glyphs[gi % glyphs.length]) {
        g.beginPath();
        stroke.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, cx + px * r + dx, cy + py * r + dy));
        g.stroke();
      }
    }
  };
  for (let i = 0; i < 9; i++) carve(40 + R() * (S - 80), 40 + R() * (S - 80), 12 + R() * 14, i);
  return c.toDataURL('image/png');
}

export class Intro {
  readonly el: HTMLDivElement;
  phase: IntroPhase = 'splash';
  /** When each phase began (ms since page start), for the checks. */
  readonly log: [IntroPhase, number][] = [['splash', performance.now()]];
  private timers: number[] = [];

  constructor(private onDone: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'intro';
    this.el.innerHTML = `
      <div class="splash">${BOOK_SWORD}<p>Michael P. Go Presents:</p></div>
      <div class="titlewall">
        <div class="wall"></div>
        <div class="logo"><span class="of">Tales of</span><span class="name">Artheria</span></div>
        <div class="press">Press any button</div>
        <p class="foot">This is a prototype, vibe coded by Michael Go. 2026, All Rights Reserved.</p>
      </div>`;
    document.body.appendChild(this.el);
    const tex = wallTexture();
    if (tex) (this.el.querySelector('.wall') as HTMLElement).style.backgroundImage = `url(${tex})`;
    const key = (e: Event) => { if (this.phase !== 'done') { e.preventDefault(); e.stopImmediatePropagation(); this.input(); } };
    window.addEventListener('keydown', key, true);
    this.el.addEventListener('pointerdown', key);
    this.cleanup = () => window.removeEventListener('keydown', key, true);
    // Phase 1: the splash, with the jingle if sound is already allowed; it fades to black at 1.0 s.
    audio.jingle();
    this.el.classList.add('splash-on');
    this.timers.push(window.setTimeout(() => this.el.classList.add('splash-out'), 800), window.setTimeout(() => this.toTitle(), 1000));
  }
  private cleanup = () => {};
  get active() { return this.phase !== 'done'; }

  private toTitle() {
    if (this.phase !== 'splash') return;
    this.timers.forEach((t) => clearTimeout(t));
    this.phase = 'title';
    this.log.push(['title', performance.now()]);
    this.el.classList.remove('splash-on', 'splash-out');
    this.el.classList.add('title-on');
    audio.water(true);
  }

  /** Any key, click, tap or pad button: skip the splash, or leave the title for the main menu. */
  input() {
    if (this.phase === 'splash') { this.toTitle(); return; }
    if (this.phase !== 'title') return;
    this.phase = 'done';
    this.log.push(['done', performance.now()]);
    audio.resume();
    audio.water(true);
    audio.blip();
    this.cleanup();
    this.el.classList.add('leaving');
    window.setTimeout(() => this.el.remove(), 700);
    this.onDone();
  }
}
