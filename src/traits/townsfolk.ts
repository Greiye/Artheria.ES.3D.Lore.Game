import FOLK from '../data/traits/townsfolk.json';
import { roll, num, type Archetype, type Variant } from './roll';
import type { FigureLook } from '../world/figure';
import type { Pose } from '../anim/procedural';

// Townsfolk crowds from the same roll engine (docs/trait-roll-tables.md §4). Key NPCs (Natalie, the Pedlar, the
// shopkeeper) stay hand-made; only the placeholder crowd rolls.
const FOLK_ARCH = FOLK as unknown as Archetype;
interface FolkRoll { v: Variant; look: FigureLook; height: number; speed: number; wait: number; idlePose: Pose | null }

/** 1–20 from a seed: the mean of three d20-ish draws, so most folk sit near 10. */
function att(seed: number, k: number): number {
  let h = (seed * 2654435761 + k * 40503) >>> 0, sum = 0;
  for (let i = 0; i < 3; i++) { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; sum += 1 + (h % 20); }
  return Math.round(sum / 3);
}

export function rollTownsfolk(seed: number): FolkRoll {
  const v = roll(FOLK_ARCH, seed), m = v.mods;
  const look: FigureLook = {
    skin: String(m.skin), hair: String(m.hair), primary: String(m.primary), secondary: String(m.secondary), accent: String(m.accent),
    boots: '#3A2A1E', hairStyle: m.hairStyle as FigureLook['hairStyle'], skirt: !!m.skirt, build: num(v, 'width', 1),
    // B46: townsfolk get their own strength and endurance from the same seed (mostly near average, a few frail or burly).
    strength: att(seed, 1), endurance: att(seed, 2),
  };
  return { v, look, height: FOLK_ARCH.base.height * num(v, 'scale', 1), speed: FOLK_ARCH.base.speed * (1 + num(v, 'speed')), wait: num(v, 'wait'), idlePose: (m.idlePose as Pose) ?? null };
}
