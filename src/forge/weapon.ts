// B5 weapon cosmetic forge (crossbow first): parts, materials, colours, an engraving, a name and a
// short legend. Cosmetic only: no stat changes. Saved on this device; "Submit" exports the legend as
// an art entry for review (curated submissions, Mike 2026-10-26).
import * as THREE from 'three';
import './forge.css';
import { pixelTexture, type TexName } from '../tex/pixel';
import { ConstraintDice, rollText, type DieKind, type Roll } from './dice';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';
import { storeSet } from '../store';

type StockStyle = 'hunter' | 'heavy' | 'slim';
type LimbStyle = 'straight' | 'recurve' | 'wing';
export type Material = 'oak' | 'dark' | 'birch' | 'bone' | 'iron';
export interface WeaponCosmetic {
  stock: StockStyle; limbs: LimbStyle; stockMat: Material; limbMat: Material;
  fittings: string; string: string; tint: string;   // metal bands, bowstring, stock tint
  engraving: string; name: string; legend: string; roll?: Roll | null;
}
const KEY = 'gametool.forge.weapon';
const defaultWeapon = (): WeaponCosmetic => ({
  stock: 'hunter', limbs: 'straight', stockMat: 'oak', limbMat: 'dark', fittings: '#A4A7A6', string: '#D9D8CC', tint: '#FFFFFF', engraving: '', name: '', legend: '', roll: null,
});
export function loadWeapon(): WeaponCosmetic {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...defaultWeapon(), ...JSON.parse(raw) } : defaultWeapon(); } catch { return defaultWeapon(); }
}
/** The crossbow and its legend as a lore file (Submit, and the B37 portfolio). */
export function weaponMarkdown(c: WeaponCosmetic, author: string): string {
  const body = `# ${c.name || 'Unnamed crossbow'}\n\n*A ${c.stock} crossbow, ${c.stockMat} stock and ${c.limbMat} ${c.limbs} limbs.${c.engraving ? ` Engraved: "${c.engraving}".` : ''}*\n\n${c.legend || '(No legend yet.)'}${c.roll ? `\n\n> Forged under the dice: ${rollText(c.roll)}.` : ''}\n`;
  return entryMarkdown({ title: c.name || 'Unnamed crossbow', author, type: 'art', tags: ['weapon', 'forge', 'crossbow'], body });
}
function saveWeapon(c: WeaponCosmetic): void { storeSet(KEY, JSON.stringify(c)); }

const MAT_TEX: Record<Material, [TexName | null, string]> = {
  oak: ['wood', '#FFFFFF'], dark: ['planks', '#FFFFFF'], birch: ['birch', '#FFFFFF'], bone: ['parchment', '#F4ECD8'], iron: ['stone', '#B8BCC0'],
};
function material(m: Material, tint = '#FFFFFF'): THREE.MeshLambertMaterial {
  const [tex, col] = MAT_TEX[m];
  return new THREE.MeshLambertMaterial({ map: tex ? pixelTexture(tex) : null, color: new THREE.Color(col).multiply(new THREE.Color(tint)) });
}

function engravingTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const g = c.getContext('2d')!;
  g.font = 'bold 12px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,230,160,0.9)'; g.fillText(text.slice(0, 24), 64, 9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

// The crossbow, about 0.45 m long, pointing down -Z. `loadedBolt` is the child named 'loadedBolt'.
export function buildCrossbowModel(c: WeaponCosmetic): THREE.Group {
  const g = new THREE.Group();
  const stockM = material(c.stockMat, c.tint), limbM = material(c.limbMat, c.tint);
  const metal = new THREE.MeshLambertMaterial({ color: c.fittings }), str = new THREE.MeshLambertMaterial({ color: c.string });
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0, rz = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.set(0, ry, rz); g.add(b); return b;
  };
  // Stock
  if (c.stock === 'heavy') { box(0.07, 0.08, 0.42, stockM); box(0.075, 0.1, 0.06, stockM, 0, -0.01, 0.2); }
  else if (c.stock === 'slim') { box(0.036, 0.046, 0.48, stockM, 0, 0, 0.02); box(0.03, 0.07, 0.04, stockM, 0, -0.04, 0.12); }
  else { box(0.05, 0.06, 0.42, stockM); box(0.045, 0.06, 0.05, stockM, 0, -0.04, 0.1); }
  box(0.058, 0.066, 0.02, metal, 0, 0, -0.19); box(0.058, 0.066, 0.02, metal, 0, 0, 0.05);   // bands
  // Limbs
  if (c.limbs === 'recurve') {
    for (const s of [-1, 1]) { box(0.17, 0.028, 0.04, limbM, s * 0.1, 0.02, -0.17, s * 0.12); box(0.07, 0.026, 0.035, limbM, s * 0.205, 0.02, -0.2, s * -0.5); }
  } else if (c.limbs === 'wing') {
    for (const s of [-1, 1]) { box(0.12, 0.05, 0.06, limbM, s * 0.08, 0.02, -0.17, s * 0.2); box(0.12, 0.035, 0.045, limbM, s * 0.19, 0.02, -0.14, s * 0.45); }
  } else box(0.44, 0.03, 0.04, limbM, 0, 0.02, -0.17);
  const span = c.limbs === 'straight' ? 0.42 : c.limbs === 'recurve' ? 0.44 : 0.4;
  box(span, 0.006, 0.006, str, 0, 0.02, -0.12);
  const bolt = box(0.012, 0.012, 0.3, metal, 0, 0.045, -0.08); bolt.name = 'loadedBolt';
  if (c.engraving.trim()) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.04), new THREE.MeshBasicMaterial({ map: engravingTexture(c.engraving), transparent: true, depthWrite: false }));
    const w = c.stock === 'heavy' ? 0.036 : c.stock === 'slim' ? 0.019 : 0.026;
    plate.position.set(w, 0, 0.02); plate.rotation.y = Math.PI / 2; plate.name = 'engraving';
    g.add(plate);
  }
  return g;
}

// ---------- Mike 2026-11-05: the sword, customisable too (looks only, like the crossbow) ----------
type BladeStyle = 'arming' | 'broad' | 'curved' | 'slim';
type GuardStyle = 'cross' | 'swept' | 'disc';
type PommelStyle = 'round' | 'disc' | 'ring';
export interface SwordCosmetic {
  blade: BladeStyle; guard: GuardStyle; pommel: PommelStyle;
  steel: string; metal: string; grip: string;   // blade colour, guard & pommel metal, grip wrap
  engraving: string; name: string; legend: string; roll?: Roll | null;
}
const SWORD_KEY = 'gametool.forge.sword';
export const defaultSword = (): SwordCosmetic => ({ blade: 'arming', guard: 'cross', pommel: 'round', steel: '#C4C8CE', metal: '#B08A3E', grip: '#4A3222', engraving: '', name: '', legend: '', roll: null });
export function loadSword(): SwordCosmetic {
  try { const raw = localStorage.getItem(SWORD_KEY); return raw ? { ...defaultSword(), ...JSON.parse(raw) } : defaultSword(); } catch { return defaultSword(); }
}
function saveSword(c: SwordCosmetic): void { storeSet(SWORD_KEY, JSON.stringify(c)); }
/** The sword and its legend as a lore file (Submit, and the B37 portfolio). */
export function swordMarkdown(c: SwordCosmetic, author: string): string {
  const body = `# ${c.name || 'Unnamed sword'}\n\n*A ${c.blade} blade with a ${c.guard} guard and a ${c.pommel} pommel.${c.engraving ? ` Engraved: "${c.engraving}".` : ''}*\n\n${c.legend || '(No legend yet.)'}${c.roll ? `\n\n> Forged under the dice: ${rollText(c.roll)}.` : ''}\n`;
  return entryMarkdown({ title: c.name || 'Unnamed sword', author, type: 'art', tags: ['weapon', 'forge', 'sword'], body });
}
/** A low-poly sword, grip at the origin, blade along +Y. Blade materials carry userData.steel / .edge for wear (src/sword.ts). */
export function buildSwordModel(c: SwordCosmetic = defaultSword()): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: c.steel }), edge = new THREE.MeshLambertMaterial({ color: new THREE.Color(c.steel).lerp(new THREE.Color('#FFFFFF'), 0.55) });
  const grip = new THREE.MeshLambertMaterial({ color: c.grip }), metal = new THREE.MeshLambertMaterial({ color: c.metal });
  steel.userData.steel = true; edge.userData.edge = true;
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, name?: string) => {
    const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; o.raycast = () => {}; if (name) o.name = name; g.add(o); return o;
  };
  const B = { arming: { w: 0.055, l: 0.68 }, broad: { w: 0.08, l: 0.64 }, curved: { w: 0.05, l: 0.7 }, slim: { w: 0.032, l: 0.76 } }[c.blade];
  const blade = part(new THREE.BoxGeometry(B.w, B.l, 0.014), steel, 0.12 + B.l / 2, 'blade');
  const fuller = part(new THREE.BoxGeometry(B.w * 0.22, B.l, 0.018), edge, 0.12 + B.l / 2, 'edge');
  const tip = part(new THREE.ConeGeometry(B.w * 0.71, B.w * 2.2, 4), steel, 0.12 + B.l + B.w * 1.1); tip.scale.z = 0.36; tip.rotation.y = Math.PI / 4;
  if (c.blade === 'curved') for (const o of [blade, fuller, tip]) { o.rotation.z = -0.12; o.position.x = (o.position.y - 0.12) * 0.12; }
  if (c.guard === 'cross') part(new THREE.BoxGeometry(0.24, 0.035, 0.05), metal, 0.105);
  else if (c.guard === 'swept') { for (const sx of [-1, 1]) { const q = part(new THREE.BoxGeometry(0.13, 0.03, 0.045), metal, 0.115); q.position.x = sx * 0.06; q.rotation.z = sx * 0.45; } }
  else { const d = part(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 10), metal, 0.105); d.scale.z = 0.5; }
  part(new THREE.CylinderGeometry(0.019, 0.022, 0.17, 6), grip, 0.0);
  if (c.pommel === 'round') part(new THREE.SphereGeometry(0.03, 6, 4), metal, -0.1);
  else if (c.pommel === 'disc') { const d = part(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8), metal, -0.1); d.rotation.x = Math.PI / 2; }
  else { const r = part(new THREE.TorusGeometry(0.03, 0.009, 4, 10), metal, -0.115); r.rotation.y = Math.PI / 2; }
  if (c.engraving.trim()) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(B.l * 0.8, 0.03), new THREE.MeshBasicMaterial({ map: engravingTexture(c.engraving), transparent: true, depthWrite: false }));
    plate.position.set(0, 0.12 + B.l * 0.45, 0.0101); plate.rotation.z = Math.PI / 2; plate.name = 'engraving';
    g.add(plate);
  }
  return g;
}

export type ForgeKind = 'crossbow' | 'sword';

export class WeaponForge {
  readonly el: HTMLElement;
  private c = defaultWeapon();
  private s = defaultSword();
  /** Which weapon is on the anvil (Mike 2026-11-05: the sword too). */
  kind: ForgeKind = 'crossbow';
  private dice: ConstraintDice;

  constructor(private onPreview: (model: THREE.Group, kind: ForgeKind) => void, private onClose: (c: WeaponCosmetic, s: SwordCosmetic) => void, loreWords: string[], private author: () => string) {
    this.dice = new ConstraintDice(loreWords);
    this.el = document.createElement('div');
    this.el.id = 'weaponForge';
    this.el.className = 'forge hidden';
    this.el.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
    document.body.appendChild(this.el);
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open(c: WeaponCosmetic, s: SwordCosmetic = loadSword(), kind: ForgeKind = this.kind) { this.c = structuredClone(c); this.s = structuredClone(s); this.kind = kind; this.render(); this.el.classList.remove('hidden'); this.preview(); }
  close() {
    if (!this.isOpen) return;
    this.readText(); saveWeapon(this.c); saveSword(this.s);
    this.el.classList.add('hidden');
    this.onClose(this.c, this.s);
  }
  private get cur(): Record<string, unknown> { return (this.kind === 'sword' ? this.s : this.c) as unknown as Record<string, unknown>; }
  private preview() { this.onPreview(this.kind === 'sword' ? buildSwordModel(this.s) : buildCrossbowModel(this.c), this.kind); }
  set(k: string, v: unknown) { this.readText(); this.cur[k] = v; this.render(); this.preview(); }
  /** Switch between the crossbow and the sword. */
  setKind(kind: ForgeKind) { this.readText(); this.kind = kind; this.render(); this.preview(); }
  get sword() { return this.s; }

  private readText() {
    const q = (s: string) => this.el.querySelector(s) as HTMLInputElement | null;
    if (q('#wfName')) { const o = this.cur; o.name = q('#wfName')!.value.trim(); o.engraving = q('#wfEngrave')!.value; o.legend = (this.el.querySelector('#wfLegend') as HTMLTextAreaElement).value.trim(); }
  }

  private chips(k: string, vals: string[]): string {
    return `<div class="chips">${vals.map((v) => `<button class="chip${this.cur[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}">${v}</button>`).join('')}</div>`;
  }
  private swatches(k: string, cols: string[]): string {
    const cur = String(this.cur[k]);
    return `<div class="swatches">${cols.map((col) => `<button class="sw${col.toLowerCase() === cur.toLowerCase() ? ' on' : ''}" data-k="${k}" data-v="${col}" style="background:${col}"></button>`).join('')}<input type="color" data-k="${k}" value="${cur}"></div>`;
  }

  private render() {
    const sw = this.kind === 'sword', c = sw ? this.s : this.c, mats: Material[] = ['oak', 'dark', 'birch', 'bone', 'iron'];
    const parts = sw ? `
        <section><h4>Blade</h4>${this.chips('blade', ['arming', 'broad', 'curved', 'slim'])}<h5>Steel</h5>${this.swatches('steel', ['#C4C8CE', '#E8ECF0', '#6E7480', '#3A3C44', '#C8A070', '#B8D8E8'])}</section>
        <section><h4>Hilt</h4><h5>Guard</h5>${this.chips('guard', ['cross', 'swept', 'disc'])}<h5>Pommel</h5>${this.chips('pommel', ['round', 'disc', 'ring'])}<h5>Guard &amp; pommel</h5>${this.swatches('metal', ['#B08A3E', '#A4A7A6', '#B87333', '#3A3A44', '#E8E8F0'])}<h5>Grip wrap</h5>${this.swatches('grip', ['#4A3222', '#2A2A30', '#8A2A2A', '#2A4A6A', '#D9D8CC'])}</section>`
      : `
        <section><h4>Stock</h4>${this.chips('stock', ['hunter', 'heavy', 'slim'])}<h5>Material</h5>${this.chips('stockMat', mats)}<h5>Tint</h5>${this.swatches('tint', ['#FFFFFF', '#E8C8A0', '#C8A8E8', '#A8C8E8', '#E8A8A8', '#8A8A8A'])}</section>
        <section><h4>Limbs</h4>${this.chips('limbs', ['straight', 'recurve', 'wing'])}<h5>Material</h5>${this.chips('limbMat', mats)}</section>
        <section><h4>Fittings</h4><h5>Metal bands &amp; bolt</h5>${this.swatches('fittings', ['#A4A7A6', '#C9A040', '#B87333', '#3A3A44', '#E8E8F0'])}<h5>String</h5>${this.swatches('string', ['#D9D8CC', '#8A2A2A', '#2A2A30', '#3FE0E8', '#C9A040'])}</section>`;
    this.el.innerHTML = `
      <div class="forge-panel">
        <div class="eyebrow">Weapon forge · cosmetic only</div>
        <div class="chips wf-kind"><button class="chip${sw ? '' : ' on'}" data-kind="crossbow">Crossbow</button><button class="chip${sw ? ' on' : ''}" data-kind="sword">Sword</button></div>
        <h2>${escapeHtml(c.name || (sw ? 'Your sword' : 'Your crossbow'))}</h2>${parts}
        <section><h4>Story</h4>
          <label class="field">Name<input id="wfName" type="text" maxlength="40" value="${escapeHtml(c.name)}" placeholder="${sw ? 'e.g. Last Word' : 'e.g. Second Thoughts'}"></label>
          <label class="field">Engraving <span class="hint">${sw ? 'on the blade' : 'on the stock'}</span><input id="wfEngrave" type="text" maxlength="24" value="${escapeHtml(c.engraving)}" placeholder="${sw ? 'e.g. Not today' : 'e.g. Aim twice'}"></label>
          <label class="field">Legend<textarea id="wfLegend" rows="4" maxlength="1200" placeholder="Who made it, and why the name?">${escapeHtml(c.legend)}</textarea></label>
          <div class="dice-row"><button class="secondary" id="wfRoll">Roll constraint dice</button>
            ${c.roll ? `<div class="dice">${(['word', 'mood', 'rule'] as DieKind[]).map((k) => `<button class="die" data-die="${k}"><b>${k}</b>${escapeHtml(c.roll![k])}</button>`).join('')}</div><p class="fine">The legend has to use all three (${this.dice.rerolls} rerolls left).</p>` : ''}
          </div>
        </section>
        <div class="forge-actions"><button class="primary" id="wfDone">Done</button><button class="secondary" id="wfSubmit">Submit…</button></div>
        <p class="fine">Looks only: ${sw ? 'every sword cuts' : 'every crossbow shoots'} the same. Drag the ${sw ? 'sword' : 'crossbow'} to turn it.</p>
      </div>`;
    this.el.querySelectorAll<HTMLElement>('[data-kind]').forEach((b) => b.addEventListener('click', () => this.setKind(b.dataset.kind as ForgeKind)));
    this.el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => {
      const k = b.dataset.k!;
      if (b instanceof HTMLInputElement) b.addEventListener('input', () => this.set(k, b.value));
      else b.addEventListener('click', () => this.set(k, b.dataset.v));
    });
    const engrave = this.el.querySelector('#wfEngrave') as HTMLInputElement;
    engrave.addEventListener('change', () => this.set('engraving', engrave.value));
    this.el.querySelector('#wfRoll')!.addEventListener('click', () => this.set('roll', this.dice.roll()));
    this.el.querySelectorAll<HTMLElement>('[data-die]').forEach((d) => d.addEventListener('click', () => {
      const r = c.roll && this.dice.reroll(c.roll, d.dataset.die as DieKind);
      if (r) this.set('roll', r);
    }));
    this.el.querySelector('#wfDone')!.addEventListener('click', () => this.close());
    this.el.querySelector('#wfSubmit')!.addEventListener('click', () => {
      this.readText(); saveWeapon(this.c); saveSword(this.s);
      if (sw) openSubmitSheet({ kind: 'weapon legend', title: this.s.name || 'Unnamed sword', markdown: swordMarkdown(this.s, this.author()) });
      else openSubmitSheet({ kind: 'weapon legend', title: this.c.name || 'Unnamed crossbow', markdown: weaponMarkdown(this.c, this.author()) });
    });
  }
}
