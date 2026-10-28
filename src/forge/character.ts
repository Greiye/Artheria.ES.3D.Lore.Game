// B4 character forge: species, body, face, hair, outfit, colours, name and a backstory blurb.
import './forge.css';
// The camera frames the player's own figure while the panel is open, so every change shows live
// on the real in-game character. Saved on this device only; "Submit" exports a character entry
// for review (curated submissions, Mike 2026-10-26).
import type { FigureLook, Species } from '../world/figure';
import { FEATURE, GOTHIC_LOOK } from '../world/figure';
import { ConstraintDice, rollText, type DieKind, type Roll } from './dice';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';

export interface ForgeCharacter { look: FigureLook; height: number; name: string; backstory: string; roll?: Roll | null }

const KEY = 'gametool.forge.character';

interface SpeciesPreset { id: Species; label: string; blurb: string; skins: string[]; height: number; look?: Partial<FigureLook> }
export const SPECIES: SpeciesPreset[] = [
  { id: 'human', label: 'Human', blurb: 'Stubborn, short-lived, everywhere.', skins: ['#F0C8A0', '#E0A882', '#C08860', '#8A5A3A', '#5A3A28'], height: 1.75 },
  { id: 'elf', label: 'Elf', blurb: 'Long memories, longer grudges.', skins: ['#F2D6B8', '#E8C0A0', '#C9A080', '#9A7A68'], height: 1.82 },
  { id: 'infernling', label: 'Infernling', blurb: 'Horned heirs of the Patron\'s fire.', skins: ['#B0403A', '#8A3A5A', '#6A3A7A', '#C06048'], height: 1.75 },
  { id: 'drakari', label: 'Drakari', blurb: 'Scaled, proud, dragon-blooded.', skins: ['#4A8A6A', '#3A6A8A', '#A0603A', '#8A8A9A'], height: 1.9 },
  { id: 'owlkin', label: 'Owlkin', blurb: 'Feathered scholars of Caspa.', skins: ['#C9A070', '#8A6A4A', '#E8D8B8', '#6A5A4A'], height: 1.6, look: { hairStyle: 'short' } },
  { id: 'emberkin', label: 'Emberkin', blurb: 'Elementkin of living fire.', skins: ['#E08A50', '#C86A3A', '#F0A070'], height: 1.75, look: { hairStyle: 'bald' } },
  { id: 'stonekin', label: 'Stonekin', blurb: 'Elementkin of the deep earth.', skins: ['#9A948A', '#7A7468', '#B0A898'], height: 1.85, look: { build: 1.15 } },
  { id: 'cinderkin', label: 'Cinderkin', blurb: 'Elementkin of the lava rivers.', skins: ['#4A3A3A', '#5A403A', '#3A2E2E'], height: 1.75, look: { hairStyle: 'bald' } },
  { id: 'titankin', label: 'Titankin', blurb: 'Giant-blooded and gentle (mostly).', skins: ['#C8A080', '#A0806A', '#8A7A6A'], height: 2.1, look: { build: 1.2 } },
  { id: 'corvani', label: 'Corvani', blurb: 'Raven-folk who trade in secrets.', skins: ['#3A3A44', '#2A2A30', '#4A4A5A'], height: 1.7, look: { hairStyle: 'short', hair: '#1A1A22' } },
  { id: 'lumari', label: 'Lumari', blurb: 'Touched by light from somewhere else.', skins: ['#F8E0C8', '#E8D0F0', '#D8E8F0'], height: 1.78 },
];
const HAIR_STYLES: NonNullable<FigureLook['hairStyle']>[] = ['flowing', 'cap', 'spiky', 'short', 'long', 'topknot', 'hood', 'bald'];
const EYE_STYLES: NonNullable<FigureLook['eyeStyle']>[] = ['round', 'sleepy', 'slit', 'owl'];
// Restyle S2: the board palette (navy, slate, rust, brick, cream, leathers, tan, moss, forest, plus two accents).
const PALETTE = ['#26222C', '#3C3644', '#34406A', '#5A6A8A', '#A8523A', '#8A3A30', '#E8DCC0', '#6B4428', '#4A2E1E', '#C9A06B', '#6A7A3A', '#3A5A3A', '#5A4A8A', '#C98A30'];
const HAIR = ['#D2C6B6', '#5A3420', '#2A1A12', '#C9A050', '#E8E0D0', '#A83A2A', '#3A3A44', '#6A9A4A', '#4A6AA8'];
const EYES = ['#C8463A', '#3E7A4A', '#3A5A9A', '#6A4A2A', '#5A3A7A', '#E0A020', '#A82A2A'];

export function defaultForge(name = ''): ForgeCharacter {
  return {
    name, backstory: '', height: 1.8, roll: null,
    look: { species: 'human', ...GOTHIC_LOOK, art: undefined, eyeStyle: 'round', marks: '' },   // forged looks draw their own head
  };
}

export function loadForge(name = ''): ForgeCharacter {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultForge(name);
    const c = JSON.parse(raw) as Partial<ForgeCharacter>;
    const d = defaultForge(name);
    return { ...d, ...c, look: { ...d.look, ...(c.look ?? {}) }, height: typeof c.height === 'number' ? c.height : d.height };
  } catch { return defaultForge(name); }
}
export function saveForge(c: ForgeCharacter): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode / quota */ }
}

// "key=value; key=value" so the lore file stays readable and the frontmatter parser needs no JSON.
export function encodeLook(c: ForgeCharacter): string {
  const l = c.look;
  return [`species=${l.species}`, `height=${c.height.toFixed(2)}`, `build=${(l.build ?? 1).toFixed(2)}`, `skin=${l.skin}`, `hair=${l.hair}`, `hairStyle=${l.hairStyle}`,
    `eyes=${l.eyes}`, `eyeStyle=${l.eyeStyle}`, `primary=${l.primary}`, `secondary=${l.secondary}`, `boots=${l.boots}`, `accent=${l.accent}`,
    `skirt=${l.skirt ? 1 : 0}`, `marks=${l.marks ?? ''}`, `feature=${l.feature ?? ''}`].join('; ');
}
export function decodeLook(s: string): { look: FigureLook; height: number } | null {
  const kv = Object.fromEntries(s.split(';').map((p) => p.trim().split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  if (!kv.skin) return null;
  const look: FigureLook = {
    species: (kv.species || 'human') as Species, skin: kv.skin, hair: kv.hair || '#5A3420', primary: kv.primary || '#4F7A3A', secondary: kv.secondary || '#C9B48A',
    boots: kv.boots || '#5A3A22', accent: kv.accent || undefined, hairStyle: (kv.hairStyle || 'spiky') as FigureLook['hairStyle'], eyes: kv.eyes || undefined,
    eyeStyle: (kv.eyeStyle || undefined) as FigureLook['eyeStyle'], build: Number(kv.build) || 1, skirt: kv.skirt === '1', marks: kv.marks || '', feature: kv.feature || undefined,
  };
  return { look, height: THREE_clamp(Number(kv.height) || 1.75, 1.4, 2.3) };
}
const THREE_clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function forgeMarkdown(c: ForgeCharacter, author: string): string {
  const sp = SPECIES.find((s) => s.id === c.look.species)?.label ?? 'Human';
  const body = `# ${c.name || 'Unnamed hero'}\n\n*${sp}.*\n\n${c.backstory.trim() || '(No backstory yet.)'}${c.roll ? `\n\n> Forged under the dice: ${rollText(c.roll)}.` : ''}\n`;
  return entryMarkdown({ title: c.name || 'Unnamed hero', author, type: 'character', tags: ['character', 'forge', c.look.species ?? 'human'], body, extra: { color: c.look.primary, look: encodeLook(c) } });
}

type Field = keyof FigureLook;

export class CharacterForge {
  readonly el: HTMLElement;
  private c: ForgeCharacter = defaultForge();
  private dice: ConstraintDice;

  constructor(private onPreview: (c: ForgeCharacter) => void, private onClose: (c: ForgeCharacter) => void, loreWords: string[], private author: () => string) {
    this.dice = new ConstraintDice(loreWords);
    this.el = document.createElement('div');
    this.el.id = 'forge';
    this.el.className = 'forge hidden';
    // Keys typed in the panel must not move the player or open menus (Esc still closes it).
    this.el.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
    document.body.appendChild(this.el);
  }

  get isOpen() { return !this.el.classList.contains('hidden'); }

  open(c: ForgeCharacter) {
    this.c = structuredClone(c);
    this.render();
    this.el.classList.remove('hidden');
    this.onPreview(this.c);
  }

  close() {
    if (!this.isOpen) return;
    this.c.name = (this.el.querySelector('#fgName') as HTMLInputElement).value.trim();
    this.c.backstory = (this.el.querySelector('#fgStory') as HTMLTextAreaElement).value.trim();
    saveForge(this.c);
    this.el.classList.add('hidden');
    this.onClose(this.c);
  }

  // Test / tool hook: apply a change as if picked in the panel.
  set(field: Field | 'height', value: unknown) {
    if (field === 'height') this.c.height = Number(value);
    else (this.c.look as unknown as Record<string, unknown>)[field] = value;
    if (field === 'species') this.applySpecies(value as Species);
    this.render();
    this.onPreview(this.c);
  }

  private applySpecies(id: Species) {
    const p = SPECIES.find((s) => s.id === id)!;
    const eyeStyle = id === 'owlkin' || id === 'corvani' ? 'owl' : id === 'drakari' ? 'slit' : 'round';
    this.c.look = { ...this.c.look, species: id, skin: p.skins[0], feature: FEATURE[id], build: 1, eyeStyle, ...(p.look ?? {}) };
    this.c.height = p.height;
  }

  private swatches(field: Field, colors: string[]): string {
    const cur = String(this.c.look[field] ?? '');
    return `<div class="swatches">${colors.map((col) => `<button class="sw${col.toLowerCase() === cur.toLowerCase() ? ' on' : ''}" data-f="${field}" data-v="${col}" style="background:${col}" aria-label="${field} ${col}"></button>`).join('')}
      <input type="color" data-f="${field}" value="${cur || '#888888'}" aria-label="${field} custom colour"></div>`;
  }
  private chips(field: Field, values: string[], labels?: string[]): string {
    const cur = String(this.c.look[field] ?? '');
    return `<div class="chips">${values.map((v, i) => `<button class="chip${v === cur ? ' on' : ''}" data-f="${field}" data-v="${v}">${labels?.[i] ?? v}</button>`).join('')}</div>`;
  }

  private render() {
    const c = this.c, l = c.look, sp = SPECIES.find((s) => s.id === l.species) ?? SPECIES[0];
    const name = (this.el.querySelector('#fgName') as HTMLInputElement | null)?.value ?? c.name;
    const story = (this.el.querySelector('#fgStory') as HTMLTextAreaElement | null)?.value ?? c.backstory;
    this.el.innerHTML = `
      <div class="forge-panel">
        <div class="eyebrow">Character forge</div>
        <h2>${escapeHtml(name || 'Your hero')}</h2>
        <section><h4>Species</h4>${this.chips('species', SPECIES.map((s) => s.id), SPECIES.map((s) => s.label))}<p class="fine">${sp.blurb}</p></section>
        <section><h4>Body</h4>
          <label class="slider">Height <input type="range" id="fgHeight" min="1.45" max="2.25" step="0.01" value="${c.height}"><span>${c.height.toFixed(2)} m</span></label>
          <label class="slider">Build <input type="range" id="fgBuild" min="0.85" max="1.25" step="0.01" value="${l.build ?? 1}"><span>${(l.build ?? 1) < 0.95 ? 'slim' : (l.build ?? 1) > 1.1 ? 'broad' : 'average'}</span></label>
          <h5>Skin</h5>${this.swatches('skin', sp.skins)}
        </section>
        <section><h4>Face</h4>${this.chips('eyeStyle', EYE_STYLES)}<h5>Eyes</h5>${this.swatches('eyes', EYES)}
          <h5>Marks</h5>${this.chips('marks', ['', '#A0603A', '#2A2A30', '#C83A3A', '#3A8AC8'], ['none', 'freckles', 'ink', 'war paint', 'woad'])}</section>
        <section><h4>Hair</h4>${this.chips('hairStyle', HAIR_STYLES)}${this.swatches('hair', HAIR)}</section>
        <section><h4>Outfit</h4><h5>Dress / vest, cap &amp; trousers</h5>${this.swatches('primary', PALETTE)}<h5>Shirt</h5>${this.swatches('secondary', PALETTE)}
          <h5>Boots</h5>${this.swatches('boots', ['#6B4428', '#4A2E1E', '#2B2A24', '#8A5A32', '#3A4A5A'])}<h5>Belt &amp; trim</h5>${this.swatches('accent', PALETTE)}
          <label class="check"><input type="checkbox" id="fgSkirt"${l.skirt ? ' checked' : ''}> Coat tails / robe</label>
          <label class="check"><input type="checkbox" id="fgDress"${l.dress ? ' checked' : ''}> Bell dress</label>
          <label class="check"><input type="checkbox" id="fgPlatform"${l.platform ? ' checked' : ''}> Platform boots</label>
          <h5>Wings</h5>${this.chips('wings', ['', '#1E1A24', '#E8E0D8', '#8A3A4A'], ['none', 'black', 'white', 'crimson'])}
          <h5>Headpiece</h5>${this.chips('headpiece', ['', '#2A2430', '#B8935A', '#E8E0D8'], ['none', 'black', 'gold', 'white'])}</section>
        <section><h4>Story</h4>
          <label class="field">Name<input id="fgName" type="text" maxlength="40" value="${escapeHtml(name)}" placeholder="e.g. Kazka of the Ash Road"></label>
          <label class="field">Backstory <span class="hint">a few lines</span><textarea id="fgStory" rows="4" maxlength="1200" placeholder="Where they came from, and what they want.">${escapeHtml(story)}</textarea></label>
          <div class="dice-row">
            <button class="secondary" id="fgRoll">Roll constraint dice</button>
            ${c.roll ? `<div class="dice">${(['word', 'mood', 'rule'] as DieKind[]).map((k) => `<button class="die" data-die="${k}" title="Reroll (${this.dice.rerolls} left)"><b>${k}</b>${escapeHtml(c.roll![k])}</button>`).join('')}</div><p class="fine">Work all three into the backstory. Tap a die to reroll it (${this.dice.rerolls} left).</p>` : '<p class="fine">Stuck? Roll three constraints to work into the story.</p>'}
          </div>
        </section>
        <div class="forge-actions">
          <button class="primary" id="fgDone">Done</button>
          <button class="secondary" id="fgSubmit">Submit…</button>
        </div>
        <p class="fine">Saved on this device. Drag on the scene to turn your hero.</p>
      </div>`;
    this.wire();
  }

  private wire() {
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    this.el.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => {
      const f = b.dataset.f as Field;
      if (b instanceof HTMLInputElement) b.addEventListener('input', () => this.set(f, b.value));
      else b.addEventListener('click', () => this.set(f, b.dataset.v));
    });
    q<HTMLInputElement>('#fgHeight').addEventListener('change', (e) => this.set('height', (e.target as HTMLInputElement).value));
    q<HTMLInputElement>('#fgBuild').addEventListener('change', (e) => this.set('build', Number((e.target as HTMLInputElement).value)));
    q<HTMLInputElement>('#fgSkirt').addEventListener('change', (e) => this.set('skirt', (e.target as HTMLInputElement).checked));
    q<HTMLInputElement>('#fgDress').addEventListener('change', (e) => this.set('dress', (e.target as HTMLInputElement).checked));
    q<HTMLInputElement>('#fgPlatform').addEventListener('change', (e) => this.set('platform', (e.target as HTMLInputElement).checked));
    q('#fgRoll').addEventListener('click', () => { this.c.roll = this.dice.roll(); this.render(); });
    this.el.querySelectorAll<HTMLElement>('[data-die]').forEach((d) => d.addEventListener('click', () => {
      const r = this.c.roll && this.dice.reroll(this.c.roll, d.dataset.die as DieKind);
      if (r) { this.c.roll = r; this.render(); }
    }));
    q('#fgDone').addEventListener('click', () => this.close());
    q('#fgSubmit').addEventListener('click', () => {
      this.c.name = q<HTMLInputElement>('#fgName').value.trim();
      this.c.backstory = q<HTMLTextAreaElement>('#fgStory').value.trim();
      saveForge(this.c);
      openSubmitSheet({ kind: 'character', title: this.c.name || 'Unnamed hero', markdown: forgeMarkdown(this.c, this.author()) });
    });
  }
}
