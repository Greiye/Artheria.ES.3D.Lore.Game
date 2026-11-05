// Mike 2026-11-05: the load screen between maps. It fades in over the frame, names where you're going with a line
// under it and a filling bar, makes the move while covered (`mid`), then lifts (`done`). About 1.6 s in all.
export class LoadScreen {
  readonly el: HTMLDivElement;
  active = false;
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'loadScreen';
    this.el.className = 'hidden';
    this.el.innerHTML = '<div class="ls-card"><div class="ls-eyebrow">Travelling</div><div class="ls-name"></div><div class="ls-line"></div><div class="ls-bar"><div class="ls-fill"></div></div></div>';
    document.body.appendChild(this.el);
  }
  show(name: string, line: string, mid: () => void, done: () => void) {
    this.active = true;
    this.el.querySelector('.ls-name')!.textContent = name;
    this.el.querySelector('.ls-line')!.textContent = line;
    const fill = this.el.querySelector<HTMLElement>('.ls-fill')!;
    fill.style.transition = 'none'; fill.style.width = '0%';
    this.el.classList.remove('hidden', 'out');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    fill.style.transition = 'width 1.3s ease-out'; fill.style.width = '100%';
    // Move once the screen is covered; lift when the bar is full.
    window.setTimeout(() => { try { mid(); } catch (e) { console.error(e); } }, 320);
    window.setTimeout(() => {
      this.el.classList.remove('in'); this.el.classList.add('out');
      window.setTimeout(() => { this.el.classList.add('hidden'); this.el.classList.remove('out'); this.active = false; done(); }, 350);
    }, 1450);
  }
}
