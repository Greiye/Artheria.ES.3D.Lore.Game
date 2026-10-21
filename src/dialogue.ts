// F3.1–F3.3: Ren'Py-style dialogue box. Bottom panel, name tag, typewriter at 40 ch/s.
// LMB / Space / E skip the typewriter, then advance. Choices are buttons (or keys 1–9).
// Scripts are content/dialogue/*.json (§6.7); actions are handed back to the game (F3.4).
import { randomPrompt } from './prompts';

export interface DialogueNode { text: string; next?: string; choices?: { text: string; next: string }[]; actions?: string[]; end?: boolean }
export interface DialogueScript { speaker: string; start: string; nodes: Record<string, DialogueNode> }

const CPS = 40;   // F3.1 typewriter speed, characters per second

export class DialogueBox {
  readonly root: HTMLDivElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private choicesEl: HTMLElement;
  private hintEl: HTMLElement;
  private script: DialogueScript | null = null;
  private node: DialogueNode | null = null;
  private full = '';
  private shown = 0;
  private startedAt = 0;
  private timer = 0;
  onAction: (action: string) => void = () => undefined;
  onEnd: () => void = () => undefined;
  onLine: () => void = () => undefined;   // A7 blip hook (Dialogue bus)

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'dialogue';
    this.root.className = 'hidden';
    this.root.innerHTML = '<div class="d-name"></div><div class="d-text"></div><div class="d-choices"></div><div class="d-hint">Click, Space or E</div>';
    this.nameEl = this.root.querySelector('.d-name')!;
    this.textEl = this.root.querySelector('.d-text')!;
    this.choicesEl = this.root.querySelector('.d-choices')!;
    this.hintEl = this.root.querySelector('.d-hint')!;
    // Clicking or tapping anywhere on the box advances (touch has no Space/E).
    this.root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.advance(); });
    document.body.appendChild(this.root);
  }

  get open() { return this.script !== null; }
  get typing() { return this.shown < this.full.length; }
  get currentId() { return this.script ? Object.entries(this.script.nodes).find(([, n]) => n === this.node)?.[0] ?? null : null; }
  get text() { return this.full; }

  start(script: DialogueScript) {
    this.script = script;
    this.nameEl.textContent = script.speaker;
    this.root.classList.remove('hidden');
    this.goto(script.start);
  }

  private goto(id: string) {
    const n = this.script!.nodes[id];
    if (!n) { this.finish(); return; }
    this.node = n;
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
      this.shown = Math.min(this.full.length, Math.floor((performance.now() - this.startedAt) / 1000 * CPS));
      this.textEl.textContent = this.full.slice(0, this.shown);
      if (this.typing) this.timer = requestAnimationFrame(tick);
      else this.revealed();
    };
    this.timer = requestAnimationFrame(tick);
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
        this.choicesEl.appendChild(b);
      });
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

  // F3.2: a choice picks the next node.
  choose(i: number) {
    const c = this.node?.choices?.[i];
    if (!c || this.typing) return;
    this.goto(c.next);
  }

  handleKey(code: string) {
    if (code === 'Space' || code === 'KeyE' || code === 'Enter') this.advance();
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
