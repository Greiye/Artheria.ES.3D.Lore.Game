// B57 morphology, PR 1 (Mike 2026-11-06, option 1: procedural placeholders for every slot, LOD at 20 m).
// A character is a small JSON spec: body morphs (0..1, 0.5 = average) on one shared skeleton, a skin colour, and one
// part per slot (hair, face pieces, clothes, extras), each an id from the catalog plus a colour. Later PRs turn a spec
// into a figure (cached parts, morph targets, LOD); real .glb parts later drop into the same ids
// (public/models/parts/<slot>_<id>.glb). This file is data only: no Three.js, so it is cheap to check and to send.
import { mulberry32 } from '../dungeon/gen';

export const SPEC_V = 1;

/** Body morphs on the shared skeleton. 0.5 is average; 0 and 1 are the ends of each range. */
export const MORPHS = ['height', 'build', 'limbLength', 'headSize', 'faceShape'] as const;
export type Morph = (typeof MORPHS)[number];

/** Part slots, drawn in this order. */
export const SLOTS = ['hair', 'brows', 'eyes', 'nose', 'mouth', 'beard', 'top', 'bottom', 'shoes', 'hat', 'accessory'] as const;
export type Slot = (typeof SLOTS)[number];

/** Placeholder ids per slot ('01'…), and whether the slot can be empty (id ''). */
export const CATALOG: Record<Slot, { ids: string[]; optional: boolean }> = {
  hair: { ids: ids(8), optional: true },        // empty = bald
  brows: { ids: ids(4), optional: false },
  eyes: { ids: ids(4), optional: false },
  nose: { ids: ids(4), optional: false },
  mouth: { ids: ids(4), optional: false },
  beard: { ids: ids(4), optional: true },
  top: { ids: ids(6), optional: false },
  bottom: { ids: ids(4), optional: false },
  shoes: { ids: ids(4), optional: false },
  hat: { ids: ids(4), optional: true },
  accessory: { ids: ids(4), optional: true },
};
function ids(n: number): string[] { return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0')); }

/** Colours the random spec picks from (any #rrggbb is valid in a spec). */
export const SKIN = ['#F2D3B8', '#E8BE9A', '#D9A57E', '#C48A62', '#A26B47', '#7E4F33', '#5C3A26', '#B7C9A8', '#9FB4D6'];
export const HAIR = ['#1E1712', '#3A2A1E', '#5E4128', '#8A5A32', '#B98A4E', '#D9C08A', '#EDE6D8', '#7A2E22', '#3D4A6B'];
export const CLOTH = ['#6B3B2E', '#8E5B3A', '#C49A5A', '#4E6B3A', '#2F4E5E', '#3B3F6B', '#6B2F4E', '#D8CFBE', '#2B2622', '#9A3B2A'];
const EYES = ['#3B2A1E', '#4E6B3A', '#2F4E7A', '#6B5A3A', '#5A5E66'];

export interface PartRef { id: string; color: string }
export interface CharacterSpec {
  v: typeof SPEC_V;
  morphs: Record<Morph, number>;
  skin: string;
  parts: Record<Slot, PartRef>;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** An average, plainly dressed character: what anything missing or broken in a spec falls back to. */
export function defaultSpec(): CharacterSpec {
  const parts = {} as Record<Slot, PartRef>;
  for (const s of SLOTS) {
    const opt = CATALOG[s].optional && s !== 'hair';
    parts[s] = { id: opt ? '' : CATALOG[s].ids[0], color: s === 'hair' || s === 'brows' || s === 'beard' ? HAIR[2] : s === 'eyes' ? EYES[0] : CLOTH[1] };
  }
  return { v: SPEC_V, morphs: Object.fromEntries(MORPHS.map((m) => [m, 0.5])) as Record<Morph, number>, skin: SKIN[2], parts };
}

/** Check a spec from anywhere (a save, a friend, a file): every field is clamped or replaced by the default, and
 *  `problems` says what was wrong. The result is always a complete, valid spec. */
export function validateSpec(raw: unknown): { spec: CharacterSpec; problems: string[] } {
  const d = defaultSpec(), problems: string[] = [];
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!o) return { spec: d, problems: ['not an object'] };
  if (o.v !== SPEC_V) problems.push(`version ${String(o.v)} (expected ${SPEC_V})`);
  const m = o.morphs && typeof o.morphs === 'object' ? o.morphs as Record<string, unknown> : {};
  if (!o.morphs) problems.push('morphs missing');
  for (const k of MORPHS) {
    const n = m[k];
    if (typeof n !== 'number' || !Number.isFinite(n)) { if (o.morphs) problems.push(`morph ${k} missing`); continue; }
    if (n < 0 || n > 1) problems.push(`morph ${k} ${n} clamped`);
    d.morphs[k] = Math.min(1, Math.max(0, n));
  }
  if (typeof o.skin === 'string' && HEX.test(o.skin)) d.skin = o.skin.toUpperCase();
  else problems.push('skin colour');
  const p = o.parts && typeof o.parts === 'object' ? o.parts as Record<string, unknown> : {};
  if (!o.parts) problems.push('parts missing');
  for (const s of SLOTS) {
    const r = p[s] && typeof p[s] === 'object' ? p[s] as Record<string, unknown> : null;
    if (!r) { if (o.parts) problems.push(`${s} missing`); continue; }
    const id = typeof r.id === 'string' ? r.id : null;
    if (id !== null && (CATALOG[s].ids.includes(id) || (id === '' && CATALOG[s].optional))) d.parts[s].id = id;
    else problems.push(`${s} id ${JSON.stringify(r.id)}`);
    if (typeof r.color === 'string' && HEX.test(r.color)) d.parts[s].color = r.color.toUpperCase();
    else problems.push(`${s} colour`);
  }
  for (const k of Object.keys(p)) if (!(SLOTS as readonly string[]).includes(k)) problems.push(`unknown slot ${k}`);
  return { spec: d, problems };
}

/** A random but plausible character from a seed: the same seed always gives the same spec. Morphs cluster round
 *  average (most people are ordinary), hair and brows share a colour, clothes pick two colours that differ. */
export function randomCharacterSpec(seed: number): CharacterSpec {
  const R = mulberry32(seed >>> 0 || 1);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)];
  const spec = defaultSpec();
  for (const k of MORPHS) spec.morphs[k] = Math.round(((R() + R() + R()) / 3) * 1000) / 1000;
  spec.skin = pick(SKIN);
  const hair = pick(HAIR), main = pick(CLOTH);
  let second = pick(CLOTH);
  if (second === main) second = CLOTH[(CLOTH.indexOf(main) + 3) % CLOTH.length];
  const empty: Partial<Record<Slot, number>> = { hair: 0.08, beard: 0.6, hat: 0.65, accessory: 0.6 };
  for (const s of SLOTS) {
    const id = CATALOG[s].optional && R() < (empty[s] ?? 0) ? '' : pick(CATALOG[s].ids);
    const color = s === 'hair' || s === 'brows' || s === 'beard' ? hair : s === 'eyes' ? pick(EYES) : s === 'top' || s === 'hat' ? main
      : s === 'bottom' ? second : s === 'shoes' ? pick(['#2B2622', '#4A3424', '#6B4A2E']) : pick(CLOTH);
    spec.parts[s] = { id, color };
  }
  return spec;
}

/** A stable key for a spec (cache and compare). */
export const specKey = (s: CharacterSpec): string =>
  [s.v, ...MORPHS.map((k) => s.morphs[k].toFixed(3)), s.skin, ...SLOTS.map((k) => `${s.parts[k].id}${s.parts[k].color}`)].join('|');

/** B57 PR 4: a townsperson's spec from their trait roll, so the crowd keeps its rolled heights, builds and colours:
 *  the seed picks the parts, the roll sets height, build, skin, hair, clothes and boots; a rolled skirt is a skirt,
 *  bald is bald, a cap or a hood is that hat. */
export function specFromRoll(seed: number, look: { skin: string; hair: string; primary: string; secondary: string; accent?: string; boots: string; hairStyle?: string; skirt?: boolean; build?: number; legs?: string }, height: number): CharacterSpec {
  const s = randomCharacterSpec(seed), hex = (c: string | undefined) => (c && HEX.test(c) ? c.toUpperCase() : null);
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  s.morphs.height = clamp01((height - 1.55) / 0.4);
  if (look.build) s.morphs.build = clamp01((look.build - 0.86) / (1.18 - 0.86));
  s.skin = hex(look.skin) ?? s.skin;
  const hair = hex(look.hair);
  if (hair) for (const k of ['hair', 'brows', 'beard'] as const) s.parts[k].color = hair;
  s.parts.top.color = hex(look.primary) ?? s.parts.top.color;
  s.parts.bottom.color = hex(look.legs) ?? hex(look.secondary) ?? s.parts.bottom.color;
  s.parts.shoes.color = hex(look.boots) ?? s.parts.shoes.color;
  if (hex(look.accent)) s.parts.accessory.color = hex(look.accent)!;
  if (look.skirt) s.parts.bottom.id = '03';
  if (look.hairStyle === 'bald') s.parts.hair.id = '';
  if (look.hairStyle === 'cap') { s.parts.hat.id = '01'; s.parts.hat.color = s.parts.top.color; }
  if (look.hairStyle === 'hood') { s.parts.hat.id = '04'; s.parts.hat.color = hex(look.secondary) ?? s.parts.top.color; }
  if (look.hairStyle === 'long' || look.hairStyle === 'flowing') s.parts.hair.id = look.hairStyle === 'long' ? '02' : '05';
  if (look.hairStyle === 'spiky') s.parts.hair.id = '03';
  if (look.hairStyle === 'topknot') s.parts.hair.id = '04';
  return s;
}
