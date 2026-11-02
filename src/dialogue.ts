// F3.1–F3.3: Ren'Py-style dialogue box. Bottom panel, name tag, typewriter at 40 ch/s.
// LMB / Space / E skip the typewriter, then advance. Choices are buttons (or keys 1–9).
// v0.05: choices are also D-pad / arrow / W-S friendly: one is highlighted, up/down move it, A / E / Enter pick it.
// Scripts are content/dialogue/*.json (§6.7); actions are handed back to the game (F3.4).
import { randomPrompt } from './prompts';
import { reading } from './reading';

// B30: `mood` picks an expression portrait (<speaker>-<mood>.png); `portrait` names the speaker's portrait file when it
// isn't the id the game talks to them by.
export interface DialogueNode { text: string; next?: string; choices?: { text: string; next: string }[]; actions?: string[]; end?: boolean; mood?: string }
export interface DialogueScript { speaker: string; start: string; nodes: Record<string, DialogueNode>; portrait?: string }

// B30 (Mike 2026-11-01): Ren'Py-style portraits on the left of the box. Files in assets/portraits/ (baked list), else a
// drawn placeholder card: a silhouette, the speaker's initial and name, in a colour of their own.
declare const __PORTRAITS__: string[];
const PORTRAIT_FILES: string[] = typeof __PORTRAITS__ === 'undefined' ? [] : __PORTRAITS__;
export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** The portrait file for a speaker id and mood, or null for the placeholder. */
function portraitFile(id: string, mood?: string): string | null {
  const find = (base: string) => PORTRAIT_FILES.find((f) => f.replace(/\.[a-z]+$/i, '').toLowerCase() === base);
  return (mood && find(`${id}-${slug(mood)}`)) || find(id) || null;
}
function placeholder(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360, initial = (name.trim()[0] ?? '?').toUpperCase();
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  return `<svg viewBox="0 0 80 100" aria-hidden="true"><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 35% 34%)"/><stop offset="1" stop-color="hsl(${hue} 30% 18%)"/></linearGradient></defs>
    <rect width="80" height="100" fill="url(#pg)"/><circle cx="40" cy="38" r="17" fill="hsl(${hue} 20% 12% / .75)"/><path d="M8 100 C10 72 24 62 40 62 C56 62 70 72 72 100 Z" fill="hsl(${hue} 20% 12% / .75)"/>
    <text x="40" y="45" text-anchor="middle" font-size="18" font-family="Georgia, serif" fill="hsl(${hue} 60% 82%)">${esc(initial)}</text></svg><span class="d-pname">${esc(name)}</span>`;
}

const CPS = 40;   // F3.1 typewriter speed, characters per second (times Reading speed)

export class DialogueBox {
  readonly root: HTMLDivElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private choicesEl: HTMLElement;
  private hintEl: HTMLElement;
  private portraitEl: HTMLElement;
  /** B30: whose portrait shows, and the file shown (null = the placeholder). */
  who = '';
  portrait: string | null = null;
  private script: DialogueScript | null = null;
  private node: DialogueNode | null = null;
  private full = '';
  private shown = 0;
  private startedAt = 0;
  private timer = 0;
  /** The highlighted choice. */
  sel = 0;
  onAction: (action: string) => void = () => undefined;
  onEnd: () => void = () => undefined;
  onLine: () => void = () => undefined;   // A7 blip hook (Dialogue bus)

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'dialogue';
    this.root.className = 'hidden';
    this.root.innerHTML = '<div class="d-portrait" aria-hidden="true"></div><div class="d-name"></div><div class="d-text"></div><div class="d-choices"></div><div class="d-hint">Click, Space or E</div>';
    this.nameEl = this.root.querySelector('.d-name')!;
    this.textEl = this.root.querySelector('.d-text')!;
    this.choicesEl = this.root.querySelector('.d-choices')!;
    this.hintEl = this.root.querySelector('.d-hint')!;
    this.portraitEl = this.root.querySelector('.d-portrait')!;
    // Clicking or tapping anywhere on the box advances (touch has no Space/E).
    this.root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.advance(); });
    document.body.appendChild(this.root);
  }

  get open() { return this.script !== null; }
  get typing() { return this.shown < this.full.length; }
  get currentId() { return this.script ? Object.entries(this.script.nodes).find(([, n]) => n === this.node)?.[0] ?? null : null; }
  get text() { return this.full; }

  /** `who` is the id the game talks to them by (natalie, pedlar): their portrait is assets/portraits/<who>.png. */
  start(script: DialogueScript, who?: string) {
    this.script = script;
    this.who = slug(script.portrait ?? who ?? script.speaker);
    this.portrait = null; this.portraitEl.replaceChildren();   // drawn fresh on the first line
    this.nameEl.textContent = script.speaker;
    this.root.classList.add('has-portrait');
    this.root.classList.remove('hidden');
    this.goto(script.start);
  }

  private goto(id: string) {
    const n = this.script!.nodes[id];
    if (!n) { this.finish(); return; }
    this.node = n;
    this.showPortrait(n.mood);
    // §6.7 n5: "<random §6.3 prompt>" is filled from creation-prompts.json at runtime.
    this.full = n.text.includes('<random §6.3 prompt>') ? n.text.replace('<random §6.3 prompt>', 'Try this: ' + randomPrompt()) : n.text;
    this.shown = 0;
    this.startedAt = performance.now();
    this.textEl.textContent = '';
    this.choicesEl.replaceChildren();
    this.hintEl.classList.add('hidden');
    this.onLine();
    for (const a of n.actions ?? []) this.onAction(a);
    cancelAnimationFrame(this.timer);
    const tick = () => {
      this.shown = Math.min(this.full.length, Math.floor((performance.now() - this.startedAt) / 1000 * CPS * reading.speed));
      this.textEl.textContent = this.full.slice(0, this.shown);
      if (this.typing) this.timer = requestAnimationFrame(tick);
      else this.revealed();
    };
    this.timer = requestAnimationFrame(tick);
  }

  private showPortrait(mood?: string) {
    const f = portraitFile(this.who, mood);
    if (f === this.portrait && this.portraitEl.childElementCount) return;
    this.portrait = f;
    this.portraitEl.classList.toggle('placeholder', !f);
    this.portraitEl.innerHTML = f ? `<img src="portraits/${encodeURI(f)}" alt="">` : placeholder(this.script!.speaker);
  }

  private revealed() {
    this.textEl.textContent = this.full;
    const n = this.node!;
    if (n.choices?.length) {
      n.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'd-choice';
        b.innerHTML = '<kbd></kbd><span></span>';
        b.querySelector('kbd')!.textContent = String(i + 1);
        b.querySelector('span')!.textContent = c.text;
        b.addEventListener('click', () => this.choose(i));
        b.addEventListener('pointerenter', () => { this.sel = i; this.mark(); });
        this.choicesEl.appendChild(b);
      });
      this.sel = 0;
      this.mark();
    } else this.hintEl.classList.remove('hidden');
  }

  // F3.1: first press completes the line; the next one advances. Ignored while choices are up (F3.2).
  advance() {
    if (!this.node) return;
    if (this.typing) { this.shown = this.full.length; cancelAnimationFrame(this.timer); this.revealed(); return; }
    if (this.node.choices?.length) return;
    if (this.node.end || !this.node.next) this.finish();
    else this.goto(this.node.next);
  }

  private mark() { [...this.choicesEl.children].forEach((b, i) => b.classList.toggle('on', i === this.sel)); }
  /** v0.05: move the highlight up (-1) or down (+1), wrapping round. */
  move(d: number) {
    const n = this.node?.choices?.length ?? 0;
    if (!n || this.typing) return;
    this.sel = (this.sel + d + n) % n;
    this.mark();
  }
  /** Confirm (pad A, E, Enter): pick the highlighted choice, or advance. Space and clicks on the box only advance (F3.2). */
  press() {
    if (this.node?.choices?.length && !this.typing) this.choose(this.sel);
    else this.advance();
  }

  // F3.2: a choice picks the next node.
  choose(i: number) {
    const c = this.node?.choices?.[i];
    if (!c || this.typing) return;
    this.goto(c.next);
  }

  handleKey(code: string) {
    if (code === 'Space') this.advance();
    else if (code === 'KeyE' || code === 'Enter') this.press();
    else if (code === 'ArrowUp' || code === 'KeyW') this.move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.move(1);
    const m = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (m) this.choose(Number(m[2]) - 1);
  }

  private finish() {
    cancelAnimationFrame(this.timer);
    this.script = null; this.node = null;
    this.root.classList.add('hidden');
    this.onEnd();
  }
}
