// Mike 2026-11-05: on the way down each floor's stairs, a hint of what's below, felt rather than told ("if there is
// more water on the level, the player feels a bit of moisture"). Always true: it reads the floor that was just built.
// Up to two lines, strongest first, plus how the stair shaft is dressed (particles, torch strength, fog) and a line
// for Natalie if she's following. Pure: no Three.js, no DOM, so it's easy to test.
import type { Flux } from './descent';
import type { Theme } from '../dungeon/gen';

export interface FloorInfo {
  floor: number;
  flux: Flux;
  theme: Theme;
  /** Pool tiles / all walkable tiles (most floors 0.02-0.07; "wet" from POOLY up, about one floor in four). */
  poolShare: number;
  guardian: string | null;
  camp: boolean;
  /** The goblin band, when this floor starts a new one (else -1). */
  newBand: number;
  /** A fallen hero's gear a goblin carries on this floor ("Grub's sword"), if any. */
  lostItem: string | null;
  hoard: boolean;
}
/** Particles in the stair shaft. */
export type ShaftFx = 'drip' | 'ember' | 'dust' | 'rise' | 'frost' | 'leaf' | 'spore' | 'gold' | 'smoke';
export interface FloorHint {
  lines: string[];
  fx: ShaftFx;
  /** Torch glow in the shaft, 0..1 (low on a dark floor). */
  torch: number;
  /** Fog colour for the shaft (null: the floor theme's). */
  fog: string | null;
  /** Low rumble under the footsteps (a guardian, the hoard). */
  rumble: boolean;
  natalie: string;
}
export const POOLY = 0.075;

const THEME_HINT: Record<Theme, [string, ShaftFx, string]> = {
  Ancient: ['Old dust, and older ink.', 'dust', 'Old ink. This floor was a reading room once.'],
  Frost: ['Your breath fogs. The steps are rimed with frost.', 'frost', 'Cold. Keep moving.'],
  Molten: ['The stone is warm to the touch. Sulphur on the air.', 'ember', "It's warm down there. Too warm."],
  Grim: ['Rot, and a faint green glow below.', 'spore', 'Ugh. Breathe through your sleeve.'],
  Verdant: ['Roots push through the steps. Wet leaves underfoot.', 'leaf', 'Roots, this deep? Something grows down there.'],
};
const FLUX_HINT: Record<Exclude<Flux, 'none'>, [string, ShaftFx, string]> = {
  flooded: ['Your boots go cold and damp. The stair walls sweat.', 'drip', 'Wet feet again. Watch your step down there.'],
  dark: ['Your torch gutters. The dark below feels thick.', 'smoke', "Torch up. I can't see my own hands."],
  burning: ['Heat on your face. Smoke curls up the stairs.', 'ember', "Smoke. Don't linger down there."],
  light: ['Your steps get lighter. The dust drifts up, not down.', 'rise', 'My stomach just turned over. Something is off with the air.'],
};
/** Goblin sign for the start of each band (see BAND_NOTE in descent.ts for what the band does). */
export const BAND_SIGN = [
  '',
  'Scratch marks at shoulder height. Lots of them, close together.',
  'Pebbles on the steps, and a dented pot lid.',
  'Something skitters across the shelves above.',
  'Chalk hexes daubed on the walls, still wet.',
  'Fresh prints pace the landing. Something has been watching the stairs.',
  '',
];

export function floorHint(i: FloorInfo): FloorHint {
  const found: [string, string][] = [];   // [line, Natalie's line], strongest first
  let fx: ShaftFx | null = null, torch = 1, fog: string | null = null, rumble = false;
  if (i.hoard) { found.push(['Gold-light on the steps. The smell of dragon.', 'Gold. And something guarding it.']); fx = 'gold'; fog = '#2A1E08'; rumble = true; }
  if (i.flux !== 'none') {
    const [line, f, nat] = FLUX_HINT[i.flux];
    found.push([line, nat]); fx ??= f;
    if (i.flux === 'dark') { torch = 0.25; fog = '#020203'; }
    if (i.flux === 'flooded') fog = '#16303A';
    if (i.flux === 'burning') fog = '#3A160A';
  }
  if (i.guardian) { found.push([`Something big breathes down there: ${i.guardian}.`, "That breathing. It's big. Ready yourself."]); rumble = true; }
  if (i.camp) found.push(['Woodsmoke, and a fire crackling below.', 'A fire. We can rest at the bottom.']);
  if (i.lostItem) found.push([`A glint you recognise: ${i.lostItem}?`, 'One of them has a fallen hero\'s gear. Win it back.']);
  if (i.newBand > 0 && BAND_SIGN[i.newBand]) found.push([BAND_SIGN[i.newBand], "Goblin sign. They're cleverer this deep."]);
  if (i.flux !== 'flooded' && i.poolShare >= POOLY) { found.push(['The air turns moist. Water somewhere below.', 'Smell that? Water. Mind the pools.']); fx ??= 'drip'; }
  const [tLine, tFx, tNat] = THEME_HINT[i.theme];
  found.push([tLine, tNat]); fx ??= tFx;
  return { lines: found.slice(0, 2).map((f) => f[0]), fx, torch, fog, rumble, natalie: found[0][1] };
}
