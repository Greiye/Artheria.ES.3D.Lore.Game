// B5 weapon cosmetic forge (crossbow first): parts, materials, colours, an engraving, a name and a
// short legend. Cosmetic only: no stat changes. Saved on this device; "Submit" exports the legend as
// an art entry for review (curated submissions, Mike 2026-10-26).
import * as THREE from 'three';
import './forge.css';
import { pixelTexture, type TexName } from '../tex/pixel';
import { ConstraintDice, rollText, type DieKind, type Roll } from './dice';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';

export type StockStyle = 'hunter' | 'heavy' | 'slim';
export type LimbStyle = 'straight' | 'recurve' | 'wing';
export type Material = 'oak' | 'dark' | 'birch' | 'bone' | 'iron';
export interface WeaponCosmetic {
  stock: StockStyle; limbs: LimbStyle; stockMat: Material; limbMat: Material;
  fittings: string; string: string; tint: string;   // metal bands, bowstring, stock tint
  engraving: string; name: string; legend: string; roll?: Roll | null;
}
const KEY = 'gametool.forge.weapon';
export const defaultWeapon = (): WeaponCosmetic => ({
  stock: 'hunter', limbs: 'straight', stockMat: 'oak', limbMat: 'dark', fittings: '#A4A7A6', string: '#D9D8CC', tint: '#FFFFFF', engraving: '', name: '', legend: '', roll: null,
});
export function loadWeapon(): WeaponCosmetic {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...defaultWeapon(), ...JSON.parse(raw) } : defaultWeapon(); } catch { return defaultWeapon(); }
}
export function saveWeapon(c: WeaponCosmetic): void { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* quota */ } }

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

export class WeaponForge {
  readonly el: HTMLElement;
  private c = defaultWeapon();
  private dice: ConstraintDice;

  constructor(private onPreview: (c: WeaponCosmetic) => void, private onClose: (c: WeaponCosmetic) => void, loreWords: string[], private author: () => string) {
    this.dice = new ConstraintDice(loreWords);
    this.el = document.createElement('div');
    this.el.id = 'weaponForge';
    this.el.className = 'forge hidden';
    this.el.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
    document.body.appendChild(this.el);
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open(c: WeaponCosmetic) { this.c = structuredClone(c); this.render(); this.el.classList.remove('hidden'); this.onPreview(this.c); }
  close() {
    if (!this.isOpen) return;
    this.readText(); saveWeapon(this.c);
    this.el.classList.add('hidden');
    this.onClose(this.c);
  }
  set<K extends keyof WeaponCosmetic>(k: K, v: WeaponCosmetic[K]) { this.readText(); this.c[k] = v; this.render(); this.onPreview(this.c); }

  private readText() {
    const q = (s: string) => this.el.querySelector(s) as HTMLInputElement | null;
    if (q('#wfName')) { this.c.name = q('#wfName')!.value.trim(); this.c.engraving = q('#wfEngrave')!.value; this.c.legend = (this.el.querySelector('#wfLegend') as HTMLTextAreaElement).value.trim(); }
  }

  private chips<K extends keyof WeaponCosmetic>(k: K, vals: string[]): string {
    return `<div class="chips">${vals.map((v) => `<button class="chip${this.c[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}">${v}</button>`).join('')}</div>`;
  }
  private swatches<K extends keyof WeaponCosmetic>(k: K, cols: string[]): string {
    const cur = String(this.c[k]);
    return `<div class="swatches">${cols.map((col) => `<button class="sw${col.toLowerCase() === cur.toLowerCase() ? ' on' : ''}" data-k="${k}" data-v="${col}" style="background:${col}"></button>`).join('')}<input type="color" data-k="${k}" value="${cur}"></div>`;
  }

  private render() {
    const c = this.c, mats: Material[] = ['oak', 'dark', 'birch', 'bone', 'iron'];
    this.el.innerHTML = `
      <div class="forge-panel">
        <div class="eyebrow">Weapon forge · cosmetic only</div>
        <h2>${escapeHtml(c.name || 'Your crossbow')}</h2>
        <section><h4>Stock</h4>${this.chips('stock', ['hunter', 'heavy', 'slim'])}<h5>Material</h5>${this.chips('stockMat', mats)}<h5>Tint</h5>${this.swatches('tint', ['#FFFFFF', '#E8C8A0', '#C8A8E8', '#A8C8E8', '#E8A8A8', '#8A8A8A'])}</section>
        <section><h4>Limbs</h4>${this.chips('limbs', ['straight', 'recurve', 'wing'])}<h5>Material</h5>${this.chips('limbMat', mats)}</section>
        <section><h4>Fittings</h4><h5>Metal bands &amp; bolt</h5>${this.swatches('fittings', ['#A4A7A6', '#C9A040', '#B87333', '#3A3A44', '#E8E8F0'])}<h5>String</h5>${this.swatches('string', ['#D9D8CC', '#8A2A2A', '#2A2A30', '#3FE0E8', '#C9A040'])}</section>
        <section><h4>Story</h4>
          <label class="field">Name<input id="wfName" type="text" maxlength="40" value="${escapeHtml(c.name)}" placeholder="e.g. Second Thoughts"></label>
          <label class="field">Engraving <span class="hint">on the stock</span><input id="wfEngrave" type="text" maxlength="24" value="${escapeHtml(c.engraving)}" placeholder="e.g. Aim twice"></label>
          <label class="field">Legend<textarea id="wfLegend" rows="4" maxlength="1200" placeholder="Who made it, and why the name?">${escapeHtml(c.legend)}</textarea></label>
          <div class="dice-row"><button class="secondary" id="wfRoll">Roll constraint dice</button>
            ${c.roll ? `<div class="dice">${(['word', 'mood', 'rule'] as DieKind[]).map((k) => `<button class="die" data-die="${k}"><b>${k}</b>${escapeHtml(c.roll![k])}</button>`).join('')}</div><p class="fine">The legend has to use all three (${this.dice.rerolls} rerolls left).</p>` : ''}
          </div>
        </section>
        <div class="forge-actions"><button class="primary" id="wfDone">Done</button><button class="secondary" id="wfSubmit">Submit…</button></div>
        <p class="fine">Looks only: every crossbow shoots the same.</p>
      </div>`;
    this.el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => {
      const k = b.dataset.k as keyof WeaponCosmetic;
      if (b instanceof HTMLInputElement) b.addEventListener('input', () => this.set(k, b.value as never));
      else b.addEventListener('click', () => this.set(k, b.dataset.v as never));
    });
    const engrave = this.el.querySelector('#wfEngrave') as HTMLInputElement;
    engrave.addEventListener('change', () => this.set('engraving', engrave.value));
    this.el.querySelector('#wfRoll')!.addEventListener('click', () => this.set('roll', this.dice.roll()));
    this.el.querySelectorAll<HTMLElement>('[data-die]').forEach((d) => d.addEventListener('click', () => {
      const r = this.c.roll && this.dice.reroll(this.c.roll, d.dataset.die as DieKind);
      if (r) this.set('roll', r);
    }));
    this.el.querySelector('#wfDone')!.addEventListener('click', () => this.close());
    this.el.querySelector('#wfSubmit')!.addEventListener('click', () => {
      this.readText(); saveWeapon(this.c);
      const body = `# ${c.name || 'Unnamed crossbow'}\n\n*A ${c.stock} crossbow, ${c.stockMat} stock and ${c.limbMat} ${c.limbs} limbs.${c.engraving ? ` Engraved: "${c.engraving}".` : ''}*\n\n${c.legend || '(No legend yet.)'}${c.roll ? `\n\n> Forged under the dice: ${rollText(c.roll)}.` : ''}\n`;
      openSubmitSheet({ kind: 'weapon legend', title: c.name || 'Unnamed crossbow', markdown: entryMarkdown({ title: c.name || 'Unnamed crossbow', author: this.author(), type: 'art', tags: ['weapon', 'forge', 'crossbow'], body }) });
    });
  }
}
