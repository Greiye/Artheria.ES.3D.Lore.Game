import FOLK from '../data/traits/townsfolk.json';
import { roll, num, type Archetype, type Variant } from './roll';
import type { FigureLook } from '../world/figure';
import type { Pose } from '../anim/procedural';

// Townsfolk crowds from the same roll engine (docs/trait-roll-tables.md §4). Key NPCs (Natalie, the Pedlar, the
// shopkeeper) stay hand-made; only the placeholder crowd rolls.
export const FOLK_ARCH = FOLK as unknown as Archetype;
export interface FolkRoll { v: Variant; look: FigureLook; height: number; speed: number; wait: number; idlePose: Pose | null }

export function rollTownsfolk(seed: number): FolkRoll {
  const v = roll(FOLK_ARCH, seed), m = v.mods;
  const look: FigureLook = {
    skin: String(m.skin), hair: String(m.hair), primary: String(m.primary), secondary: String(m.secondary), accent: String(m.accent),
    boots: '#3A2A1E', hairStyle: m.hairStyle as FigureLook['hairStyle'], skirt: !!m.skirt, build: num(v, 'width', 1),
  };
  return { v, look, height: FOLK_ARCH.base.height * num(v, 'scale', 1), speed: FOLK_ARCH.base.speed * (1 + num(v, 'speed')), wait: num(v, 'wait'), idlePose: (m.idlePose as Pose) ?? null };
}
