import type { FigureLook } from '../world/figure';

// A look that arrives from another phone is checked field by field before it builds a figure: only known keys,
// colours as #hex, styles from the known lists, numbers clamped. Anything else is dropped (the figure's defaults fill in).
const COLOUR = /^#[0-9a-fA-F]{3,8}$/;
const COLOURS = ['skin', 'hair', 'primary', 'secondary', 'boots', 'accent', 'eyes', 'gloves', 'scarf', 'legs', 'wings', 'headpiece', 'marks', 'feature'] as const;
const FLAGS = ['skirt', 'pack', 'dress', 'platform', 'horns'] as const;
const ONE_OF = {
  hairStyle: ['spiky', 'long', 'hood', 'short', 'bald', 'topknot', 'cap', 'flowing'],
  eyeStyle: ['round', 'slit', 'owl', 'sleepy'],
  species: ['human', 'elf', 'infernling', 'drakari', 'owlkin', 'emberkin', 'stonekin', 'cinderkin', 'titankin', 'corvani', 'lumari', 'goblin'],
} as const;
const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);

export interface NetLook { look: FigureLook; height: number }

/** The parts of a look worth sending (no palette atlas; the other phone builds its own). */
export function packLook(look: FigureLook, height: number): NetLook {
  const out: Record<string, unknown> = {};
  for (const k of COLOURS) if (look[k] !== undefined) out[k] = look[k];
  for (const k of FLAGS) if (look[k] !== undefined) out[k] = look[k];
  for (const k of Object.keys(ONE_OF) as (keyof typeof ONE_OF)[]) if (look[k] !== undefined) out[k] = look[k];
  if (look.art) out.art = look.art;
  if (look.build !== undefined) out.build = look.build;
  if (look.headScale !== undefined) out.headScale = look.headScale;
  if (look.strength !== undefined) out.strength = look.strength;
  if (look.endurance !== undefined) out.endurance = look.endurance;
  return { look: out as unknown as FigureLook, height };
}

export function cleanLook(raw: unknown): NetLook | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { look?: unknown; height?: unknown };
  if (!r.look || typeof r.look !== 'object') return null;
  const l = r.look as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of COLOURS) if (typeof l[k] === 'string' && (COLOUR.test(l[k] as string) || (k === 'marks' && l[k] === ''))) out[k] = l[k];
  for (const k of ['skin', 'hair', 'primary', 'secondary', 'boots']) if (!out[k]) return null;   // the five a figure needs
  for (const k of FLAGS) if (typeof l[k] === 'boolean') out[k] = l[k];
  for (const [k, list] of Object.entries(ONE_OF)) if ((list as readonly string[]).includes(l[k] as string)) out[k] = l[k];
  if (typeof l.art === 'string' && /^[a-z0-9-]{1,32}$/.test(l.art)) out.art = l.art;
  if (l.build !== undefined) out.build = clamp(l.build, 0.85, 1.25, 1);
  if (l.headScale !== undefined) out.headScale = clamp(l.headScale, 0.8, 1.4, 1);
  if (l.strength !== undefined) out.strength = Math.round(clamp(l.strength, 1, 20, 10));
  if (l.endurance !== undefined) out.endurance = Math.round(clamp(l.endurance, 1, 20, 10));
  return { look: out as unknown as FigureLook, height: clamp(r.height, 1.2, 2.4, 1.75) };
}
