import { escapeHtml, entryMarkdown, openSubmitSheet } from '../submit';
import { RECIPES, COOK_DISCLAIMER, HEAT_LABEL, HEAT_RATE, BUFFS, QUICK_MS, type Recipe, type Heat, type Buff } from './recipes';
import './cooking.css';

// B18 (Mike 2026-11-01): cook at the campfire. Pick a recipe, tap the prep steps in order, put it on the fire at the
// heat you choose and take it off when the doneness bar is in the gold band, then finish it. A good dish is eaten with
// the camp (a small buff, one meal at a time) and goes in the Recipe book (Journal) with the real recipe to cook at
// home. A kitchen-safety note comes first. Players can write their own recipe and submit it as lore.
const KEY = 'gametool.cooking';
export interface CookState { ack: boolean; learned: Partial<Record<Recipe['id'], number>>; meal: { buff: Buff; at: number } | null }
type Stage = 'prep' | 'fire' | 'finish' | 'done';

export function loadCooking(): CookState {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v) return { ack: !!v.ack, learned: v.learned && typeof v.learned === 'object' ? v.learned : {}, meal: v.meal ?? null }; } catch { /* blocked */ }
  return { ack: false, learned: {}, meal: null };
}

function shuffled(n: number): number[] {
  const a = [...Array(n).keys()];
  do { for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } } while (n > 1 && a.every((v, i) => v === i));
  return a;
}

export class CookPanel {
  readonly el: HTMLDivElement;
  st: CookState = loadCooking();
  recipe: Recipe | null = null;
  stage: Stage = 'prep';
  placed = 0; order: number[] = []; note = '';
  heat: Heat | null = null; done = 0; result: 'good' | 'raw' | 'burnt' | null = null; rightHeat = false;
  onLearn: (r: Recipe) => void = () => undefined;
  onEat: (b: Buff) => void = () => undefined;
  author: () => string = () => '';

  constructor(private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'cook';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* blocked */ } }
  open() { this.st = loadCooking(); this.recipe = null; this.note = ''; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.recipe = null; this.heat = null; this.onClose(); }

  /** The meal buff still in effect (quick wears off after 3 minutes; the others wait for the next delve). */
  get buff(): Buff | null {
    const m = this.st.meal;
    if (!m) return null;
    if (m.buff === 'quick' && Date.now() - m.at > QUICK_MS) return null;
    return m.buff;
  }
  /** A delve uses up hearty / sturdy. */
  consume(b: Buff): boolean { if (this.buff !== b) return false; this.st.meal = null; this.save(); return true; }

  start(id: string) {
    this.recipe = RECIPES.find((r) => r.id === id) ?? null;
    this.stage = 'prep'; this.placed = 0; this.note = ''; this.heat = null; this.done = 0; this.result = null;
    if (this.recipe) this.order = shuffled(this.recipe.prep.length);
    this.render();
  }
  tapStep(i: number): boolean {
    const r = this.recipe;
    if (!r || this.stage !== 'prep') return false;
    if (i === this.placed) { this.placed++; this.note = ''; if (this.placed >= r.prep.length) this.stage = 'fire'; this.render(); return true; }
    this.note = this.placed === 0 ? 'Not first. What do you do before anything else?' : `Not yet. What comes right after "${r.prep[this.placed - 1]}"`;
    this.render();
    return false;
  }
  setHeat(h: Heat) { if (this.stage !== 'fire' || this.result) return; this.heat = h; this.render(); }
  /** Each frame: the dish cooks at the chosen heat; left too long it burns. */
  update(dt: number) {
    if (!this.isOpen || this.stage !== 'fire' || !this.heat || this.result) return;
    this.done = Math.min(100, this.done + HEAT_RATE[this.heat] * dt);
    if (this.done >= 100) { this.result = 'burnt'; this.render(); return; }
    this.paintBar();
  }
  takeOff() {
    const r = this.recipe;
    if (!r || this.stage !== 'fire' || !this.heat || this.result) return;
    this.rightHeat = this.heat === r.heat;
    this.result = this.done < r.band[0] ? 'raw' : this.done > r.band[1] ? 'burnt' : 'good';
    if (this.result === 'good') this.stage = 'finish';
    this.render();
  }
  retry() { if (!this.recipe) return; this.heat = null; this.done = 0; this.result = null; this.stage = 'fire'; this.render(); }
  finish() {
    const r = this.recipe;
    if (!r || this.stage !== 'finish') return;
    const first = !this.st.learned[r.id];
    this.st.learned[r.id] = this.st.learned[r.id] ?? Date.now();
    this.st.meal = { buff: r.buff, at: Date.now() };
    this.save();
    this.stage = 'done';
    this.render();
    if (first) this.onLearn(r);
    this.onEat(r.buff);
  }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if (b.id === 'ckAck') { this.st.ack = true; this.save(); this.render(); }
    else if (d.recipe) this.start(d.recipe);
    else if (d.step !== undefined) this.tapStep(Number(d.step));
    else if (d.heat) this.setHeat(d.heat as Heat);
    else if (b.id === 'ckOff') this.takeOff();
    else if (b.id === 'ckRetry') this.retry();
    else if (b.id === 'ckFinish') this.finish();
    else if (b.id === 'ckBack') { this.recipe = null; this.note = ''; this.render(); }
    else if (b.id === 'ckClose') this.close();
  }

  private paintBar() {
    const f = this.el.querySelector<HTMLElement>('.ck-fill'); if (f) f.style.width = `${this.done}%`;
    const t = this.el.querySelector('#ckDone'); if (t) t.textContent = `${Math.round(this.done)}%`;
    this.el.querySelector('.ck-bar')?.classList.toggle('in', !!this.recipe && this.done >= this.recipe.band[0] && this.done <= this.recipe.band[1]);
  }

  render() {
    const r = this.recipe, st = this.st;
    let body: string;
    if (!st.ack) body = `
      <h4>Before you cook</h4>
      <p class="dj-disclaimer">${escapeHtml(COOK_DISCLAIMER)}</p>
      <div class="forge-actions"><button class="primary" id="ckAck">I understand</button></div>`;
    else if (!r) {
      const buff = this.buff;
      body = `
      <p class="fine">Natalie hands you the camp's pot and pan. Cook something real: every recipe here works at home too, with an adult.</p>
      ${buff ? `<p class="ck-buff">🍽 ${escapeHtml(BUFFS[buff].name)}: ${escapeHtml(BUFFS[buff].text)}</p>` : ''}
      <div class="sk-list">${RECIPES.map((x) => `<button class="secondary sk-pick" data-recipe="${x.id}"><span class="sk-icon">${x.icon}</span><b>${escapeHtml(x.name)}</b>${st.learned[x.id] ? ' <span class="sk-got">in your book ✓</span>' : ''}<span class="fine">${escapeHtml(x.blurb)} Eat it: ${escapeHtml(BUFFS[x.buff].name.toLowerCase())}.</span></button>`).join('')}</div>`;
    } else {
      const head = `<h4>${r.icon} ${escapeHtml(r.name)}</h4><p class="fine">${escapeHtml(r.from)}</p>`;
      let play = '';
      if (this.stage === 'prep') play = `
        <h5>Prep · tap the steps in order</h5>
        <ol class="sk-done">${r.prep.slice(0, this.placed).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ol>
        <div class="sk-steps">${this.order.filter((i) => i >= this.placed).map((i) => `<button class="secondary" data-step="${i}">${escapeHtml(r.prep[i])}</button>`).join('')}</div>`;
      else if (this.stage === 'fire') play = `
        <h5>On the fire</h5>
        <p class="fine">${escapeHtml(r.cookText)} Pick the heat, then take it off when the bar is in the gold band.</p>
        <div class="chips">${(['low', 'medium', 'high'] as Heat[]).map((h) => `<button class="chip${this.heat === h ? ' on' : ''}" data-heat="${h}"${this.result ? ' disabled' : ''}>${HEAT_LABEL[h]}</button>`).join('')}</div>
        <div class="ck-bar" style="--lo:${r.band[0]}%;--hi:${r.band[1]}%"><div class="ck-band"></div><div class="ck-fill" style="width:${this.done}%"></div><span id="ckDone">${Math.round(this.done)}%</span></div>
        ${this.result ? `<p class="sk-note" role="status">${this.result === 'burnt' ? 'It caught on the bottom and burnt.' : 'Too soon: it isn\'t cooked through.'} ${this.heat !== r.heat ? escapeHtml(r.heatWhy) : 'Watch the bar and take it off in the gold.'}</p>
          <div class="forge-actions"><button class="primary" id="ckRetry">Try again</button></div>`
          : `<div class="forge-actions"><button class="primary" id="ckOff"${this.heat ? '' : ' disabled'}>Take it off the fire</button></div>`}`;
      else if (this.stage === 'finish') play = `
        <p class="ck-good">${this.rightHeat ? 'Cooked just right.' : 'Cooked, though the heat was a struggle.'} ${this.rightHeat ? '' : escapeHtml(r.heatWhy)}</p>
        <h5>To finish</h5><p>${escapeHtml(r.finish)}</p>
        <div class="forge-actions"><button class="primary" id="ckFinish">Finish and eat with the camp</button></div>`;
      else play = `
        <p class="ck-good">You share it round the fire. Natalie has seconds.</p>
        <p class="ck-buff">🍽 ${escapeHtml(BUFFS[r.buff].name)}: ${escapeHtml(BUFFS[r.buff].text)}</p>
        <p class="fine">The full recipe is in your Recipe book (Journal), to cook for real.</p>`;
      body = `${head}${play}${this.note ? `<p class="sk-note" role="status">${escapeHtml(this.note)}</p>` : ''}
        <p class="dj-safety">⚠ ${escapeHtml(r.safety)}</p>
        <div class="forge-actions"><button class="secondary" id="ckBack">Other recipes</button></div>`;
    }
    this.el.innerHTML = `
      <div class="forge-panel skills-panel cook-panel">
        <div class="eyebrow">Campfire · the camp kitchen</div>
        <h2>Cook</h2>
        ${body}
        <div class="forge-actions"><button class="secondary" id="ckClose">Back to the fire</button></div>
      </div>`;
    this.paintBar();
  }
}

export function recipeHtml(r: Recipe): string {
  return `<div class="sk-card ck-card"><div class="sk-card-head"><span>${r.icon}</span><b>${escapeHtml(r.name)}</b></div>
    <p class="fine">Serves ${escapeHtml(r.serves)} · ${escapeHtml(r.time)}. ${escapeHtml(r.from)}</p>
    <h5>You need</h5><ul>${r.ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
    <h5>Method</h5><ol>${[...r.prep, `${HEAT_LABEL[r.heat]}: ${r.heatWhy} ${r.cookText}`, r.finish].map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    <p class="dj-safety">⚠ ${escapeHtml(r.safety)}</p></div>`;
}

/** The Journal's Recipe book: every recipe cooked so far, written out in full, and a page for your own. */
export class RecipeBook {
  readonly el: HTMLDivElement;
  writing = false;
  constructor(private cook: CookPanel, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'recipeBook';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#rbClose')) this.close();
      else if (t.closest('#rbWrite')) { this.writing = true; this.render(); }
      else if (t.closest('#rbCancel')) { this.writing = false; this.render(); }
      else if (t.closest('#rbSubmit')) this.submit();
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.cook.st = loadCooking(); this.writing = false; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  /** Your own recipe, as a lore file to submit (it stays on this device until you send it). */
  submit(): HTMLElement | null {
    const v = (id: string) => (this.el.querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)?.value ?? '').trim();
    const title = v('rbTitle'), ing = v('rbIng'), method = v('rbMethod'), safety = v('rbSafety');
    const msg = this.el.querySelector('#rbMsg');
    if (title.length < 3 || ing.length < 3 || method.length < 10) { if (msg) msg.textContent = 'Give it a name, what you need, and how to make it.'; return null; }
    const body = `## You need\n\n${ing.split('\n').filter(Boolean).map((l) => `- ${l.replace(/^[-*]\s*/, '')}`).join('\n')}\n\n## Method\n\n${method}\n${safety ? `\n## Safety\n\n${safety}\n` : ''}`;
    return openSubmitSheet({ kind: 'recipe', title, markdown: entryMarkdown({ title, author: this.cook.author(), type: 'lore', tags: ['recipe', 'cooking'], body }) });
  }
  render() {
    const st = this.cook.st, n = Object.keys(st.learned).length;
    this.el.innerHTML = `
      <div class="forge-panel skills-panel cook-panel">
        <div class="eyebrow">Journal · Recipe book</div>
        <h2>Recipe book</h2>
        ${this.writing ? `
          <h4>Your own recipe</h4>
          <p class="fine">Something you cook at home, or a dish from your own Artheria. It stays on this device until you submit it, and then Mike reads it before it goes in the game.</p>
          <label class="field">Name<input id="rbTitle" type="text" maxlength="60" placeholder="Grandma's oat cakes"></label>
          <label class="field">You need (one per line)<textarea id="rbIng" rows="4" maxlength="800"></textarea></label>
          <label class="field">Method<textarea id="rbMethod" rows="5" maxlength="1500"></textarea></label>
          <label class="field">Safety tip (optional)<input id="rbSafety" type="text" maxlength="200" placeholder="Hot pan: use a glove."></label>
          <p class="fine" id="rbMsg" role="status"></p>
          <div class="forge-actions"><button class="primary" id="rbSubmit">Submit…</button><button class="secondary" id="rbCancel">Cancel</button></div>`
        : `
          <p class="fine">${n} of ${RECIPES.length} recipes cooked.${n < RECIPES.length ? ' Cook at the campfire to add the rest.' : ''}</p>
          ${RECIPES.map((r) => st.learned[r.id] ? recipeHtml(r) : `<div class="sk-card locked"><div class="sk-card-head"><span>${r.icon}</span><b>${escapeHtml(r.name)}</b></div><p class="fine">Not cooked yet. Sit by the campfire and pick Cook.</p></div>`).join('')}
          <div class="forge-actions"><button class="secondary" id="rbWrite">✒ Write your own recipe</button></div>`}
        <div class="forge-actions"><button class="secondary" id="rbClose">Close</button></div>
      </div>`;
  }
}
