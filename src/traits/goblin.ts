import * as THREE from 'three';
import GOBLIN from '../data/traits/goblin.json';
import { roll, has, num, pickOf, rollDie, type Archetype, type Variant } from './roll';
import { mulberry32 } from '../dungeon/gen';
import { buildFigure, type FigureLook, type PropKit } from '../world/figure';
import type { PaintKind, Tile } from '../tex/paintedAtlas';

// The goblin archetype (docs/trait-roll-tables.md §3). Lore (public): three feet tall, green, nimble, creative with
// what they use as weapons, clever with traps; some learned the bow by watching adventurers; the Daemonic Goblin
// Disease leaves growths, blackened horns and red eyes. A variant is rebuilt from { archetype, seed } alone.
export const GOBLIN_ARCH = GOBLIN as unknown as Archetype;
export const rollGoblin = (seed: number, budget?: number) => roll(GOBLIN_ARCH, seed, { budget });

export interface GoblinStats {
  hp: number; speed: number; armour: number; height: number; width: number;
  damage: string; reach: number; range: number; cooldown: number; shot: number; fuse: number; blast: number; trap: string | null;
  aim: number; crowns: number; bolts: number; behaviour: string; weapon: string; leader: boolean; slowOnHit: number; block: boolean; light: boolean;
}

export function goblinStats(v: Variant): GoblinStats {
  const b = GOBLIN_ARCH.base, R = mulberry32(v.seed ^ 0xB0D7);
  const jitter = () => 1 + (R() - 0.5) * 0.08;   // two "Average" goblins still differ (±4%)
  return {
    hp: Math.max(2, b.hp + num(v, 'hp')), speed: b.speed * (1 + num(v, 'speed')), armour: num(v, 'armour'),
    height: b.height * num(v, 'scale', 1) * jitter(), width: num(v, 'width', 1) * jitter(),
    damage: String(v.mods.damage ?? '1'), reach: num(v, 'reach', 1.2), range: num(v, 'range'), cooldown: num(v, 'cooldown', 1.2),
    shot: num(v, 'shot', 12), fuse: num(v, 'fuse'), blast: num(v, 'blast'), trap: typeof v.mods.trap === 'string' ? v.mods.trap : null,
    aim: num(v, 'aim'), crowns: 1 + (v.seed % 3) + num(v, 'crowns'), bolts: num(v, 'bolts'),
    behaviour: pickOf(v, 'behaviour')!.id, weapon: pickOf(v, 'weapon')!.id, leader: !!num(v, 'leader'),
    slowOnHit: num(v, 'slowOnHit'), block: !!num(v, 'block'), light: !!num(v, 'light'),
  };
}

export const damageRoll = (die: string, R: () => number = Math.random) => Math.max(1, rollDie(die, R));

/** "a big, sick goblin in a cooking pot, swinging a greatclub" (the narration; no dice). */
export function describeGoblin(v: Variant): string {
  const adj = ['size', 'skin', 'behaviour'].map((t) => pickOf(v, t)?.label).filter(Boolean);
  const head = pickOf(v, 'headgear')?.label, weapon = pickOf(v, 'weapon')!;
  const verb = weapon.tags?.includes('ranged') ? 'carrying' : weapon.tags?.includes('trap') ? 'dragging' : weapon.id === 'bomb' ? 'clutching' : 'swinging';
  const acc = v.picks.filter((p) => p.table === 'accessory' && p.row.id !== 'none').map((p) => p.sub?.label ?? p.row.label).filter(Boolean);
  return `${adj.length ? adj.join(', ') + ' ' : ''}goblin${head ? ' ' + head : ''}, ${verb} ${weapon.label}${acc.length ? `, with ${acc.join(' and ')}` : ''}`;
}

export const RARITY_COLOUR: Record<Variant['rarity'], string> = { common: '#E8E0D0', uncommon: '#7AD07A', rare: '#6AB4FF', legendary: '#FFB040' };

const SKIN_DARK = (c: string, k: number) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

/** The goblin's figure: a small realistic body with a big head, rags, and its rolled props merged into the body. */
// Mona method (references review): every goblin paints from one shared 256² swatch atlas. Rolls only pick
// rows from it (skin, rags, kit), so a nest of six costs one texture.
const SKINS = [...new Set(['#6E8B3D', ...GOBLIN.tables.skin.rows.map((r) => r.mods.skin)])];
const RAGS = ['#5A4632', '#4A3A2A', '#6A5038', '#54402E', '#3E3A2C'];
const KIT: [string, PaintKind][] = [['#2A2A1E', 'hair'], ['#26261b', 'hair'], ['#3A2E22', 'metal'], ['#C9A23A', 'metal'], ['#8A8E92', 'metal'], ['#141218', 'leather'],
  ['#8A7A5A', 'cloth'], ['#6A3A2A', 'cloth'], ['#6A4A2A', 'cloth'], ['#2E2A26', 'cloth'], ['#7A6A4A', 'cloth'], ['#7A4A8A', 'cloth'], ['#6A5A40', 'cloth'],
  ['#8A1E1E', 'cloth'], ['#2A2024', 'cloth'], ['#C8B898', 'cloth'], ['#3A5A3A', 'cloth'], ['#C83A2A', 'cloth'], ['#1A1418', 'cloth'], ['#1A1614', 'cloth'],
  ['#9A8A74', 'cloth'], ['#A8322A', 'cloth'], ['#D9D8CC', 'cloth'], ['#E8E0C8', 'cloth'], ['#E8E0D0', 'cloth'],
  ['#6AB4FF', 'cloth'], ['#7AD07A', 'cloth'], ['#E8F0F8', 'cloth'], ['#FFB040', 'cloth'], ['#FFD27A', 'cloth'], ['#E0302A', 'cloth'], ['#E8C83A', 'cloth']];
export const GOBLIN_PALETTE: { tiles: Tile[]; size: number } = { size: 256, tiles: [
  ...SKINS.flatMap((c) => [{ color: c, kind: 'skin' as const }, { color: SKIN_DARK(c, 0.7), kind: 'leather' as const }, { color: SKIN_DARK(c, 0.85), kind: 'leather' as const }]),
  ...RAGS.map((c) => ({ color: c, kind: 'cloth' as const })),
  ...KIT.map(([color, kind]) => ({ color, kind })),
] };

export function buildGoblin(v: Variant): THREE.Group {
  const st = goblinStats(v), R = mulberry32(v.seed ^ 0x6B1);
  const skin = String(v.mods.skin ?? '#6E8B3D'), diseased = v.tags.has('diseased');
  const rags = RAGS;
  const look: FigureLook = {
    species: 'goblin', skin, hair: '#2A2A1E', primary: rags[Math.floor(R() * rags.length)], secondary: '#8A7A5A', boots: SKIN_DARK(skin, 0.7),
    legs: rags[Math.floor(R() * rags.length)], accent: '#3A2E22', scarf: '#6A3A2A', pack: false, gloves: SKIN_DARK(skin, 0.85),
    eyes: diseased ? '#E0302A' : '#E8C83A', eyeStyle: 'slit', marks: '', hairStyle: has(v, 'headgear', 'none') && R() < 0.4 ? 'spiky' : 'bald',
    build: st.width, headScale: 1.5, horns: diseased, feature: '#1A1418', palette: GOBLIN_PALETTE,
  };
  const fig = buildFigure(look, st.height, (k) => props(k, v, diseased));
  fig.userData.variant = v;
  return fig;
}

// Props, in figure metres for a 1.75 m body (they scale with it). Hands: N is the figure's right (-X).
function props(k: PropKit, v: Variant, diseased: boolean) {
  const iron = '#8A8E92', wood = '#6A4A2A', dark = '#2E2A26', cloth = '#7A6A4A';
  if (diseased) for (const [x, y, z, r] of [[0.12, 1.55, 0.12, 0.05], [-0.15, 1.38, 0.05, 0.04]] as const) k.shell(r, r, r, x, y, z, '#7A4A8A', 1);
  if (diseased) k.ball('spine', 0.045, 0.1, 1.33, 0.09, '#7A4A8A');
  switch (pickOf(v, 'headgear')!.id) {
    case 'hood': k.shell(0.24, 0.24, 0.235, 0, 1.42, -0.02, '#6A5A40', 0.72, 0, 0.85); break;
    case 'pot': k.shell(0.23, 0.2, 0.23, 0, 1.5, 0, dark, 0.5); k.lock([[-0.24, 1.6, 0], [-0.32, 1.6, 0]], 0.025, 0.025, dark); break;
    case 'scholar': k.shell(0.215, 0.12, 0.215, 0, 1.55, 0, '#8A1E1E', 0.5); k.hbox(0.36, 0.03, 0.36, 0, 1.68, 0, '#2A2024'); k.lock([[0.15, 1.69, 0.15], [0.2, 1.55, 0.2]], 0.012, 0.012, '#C9A23A'); break;
    case 'antlers': for (const s of [-1, 1]) { k.lock([[s * 0.1, 1.58, 0], [s * 0.22, 1.78, -0.02], [s * 0.3, 1.9, 0.02]], 0.03, 0.012, '#C8B898'); k.lock([[s * 0.2, 1.74, -0.02], [s * 0.12, 1.88, 0.02]], 0.02, 0.01, '#C8B898'); } break;
    case 'helmet': k.shell(0.23, 0.22, 0.23, 0, 1.47, 0, iron, 0.52); k.hbox(0.04, 0.16, 0.04, 0, 1.44, 0.22, iron); break;
    case 'feathered': k.shell(0.215, 0.14, 0.215, 0, 1.56, 0, '#3A5A3A', 0.5); k.shell(0.36, 0.03, 0.36, 0, 1.58, 0, '#3A5A3A', 0.5); k.lock([[0.12, 1.66, -0.05], [0.25, 1.85, -0.2], [0.3, 1.95, -0.38]], 0.035, 0.008, '#C83A2A'); break;
  }
  const H = [-0.24, 0.84, 0] as const;   // the right hand
  switch (pickOf(v, 'weapon')!.id) {
    case 'ladle': k.rod('foreN', [H[0], H[1] + 0.05, 0.02], [H[0], H[1] - 0.3, 0.12], 0.012, 0.012, iron); k.ball('foreN', 0.05, H[0], H[1] - 0.32, 0.13, iron, 1, 0.5, 1); break;
    case 'sword': k.box('foreN', 0.04, 0.06, 0.04, H[0], H[1], 0.03, wood); k.box('foreN', 0.12, 0.02, 0.03, H[0], H[1] - 0.04, 0.03, dark); k.rod('foreN', [H[0], H[1] - 0.05, 0.03], [H[0], H[1] - 0.45, 0.2], 0.022, 0.008, '#9A8A74', 4); break;
    case 'spear': k.rod('foreN', [H[0], H[1] + 0.5, -0.2], [H[0], H[1] - 0.5, 0.4], 0.015, 0.015, wood); k.rod('foreN', [H[0], H[1] - 0.5, 0.4], [H[0], H[1] - 0.6, 0.46], 0.012, 0.002, iron, 4); break;
    case 'sling': k.rod('foreN', [H[0], H[1], 0], [H[0], H[1] - 0.3, 0.02], 0.006, 0.006, cloth, 4); k.ball('foreN', 0.03, H[0], H[1] - 0.31, 0.02, cloth); break;
    case 'bow': k.rod('foreP', [0.24, 1.15, 0.05], [0.24, 0.84, 0.12], 0.012, 0.012, wood); k.rod('foreP', [0.24, 0.84, 0.12], [0.24, 0.53, 0.05], 0.012, 0.012, wood); k.rod('foreP', [0.24, 1.15, 0.05], [0.24, 0.53, 0.05], 0.003, 0.003, '#E8E0D0', 3); break;
    case 'bomb': k.ball('foreN', 0.08, H[0], H[1] - 0.06, 0.04, dark); k.rod('foreN', [H[0], H[1] + 0.02, 0.04], [H[0], H[1] + 0.1, 0.06], 0.006, 0.006, '#C8B898', 3); break;
    case 'greatclub': k.rod('foreN', [H[0], H[1] + 0.05, 0], [H[0], H[1] - 0.6, 0.25], 0.025, 0.06, wood); k.ball('foreN', 0.07, H[0], H[1] - 0.6, 0.25, wood); break;
    case 'trapkit': k.ball('hips', 0.09, 0.16, 0.86, -0.06, cloth, 1, 1.1, 0.8); k.rod('hips', [0.16, 0.78, -0.02], [0.2, 0.7, 0.02], 0.01, 0.01, iron, 4); break;
  }
  for (const p of v.picks.filter((x) => x.table === 'accessory')) switch (p.row.id) {
    case 'teeth': for (let i = -2; i <= 2; i++) k.box('spine', 0.015, 0.03, 0.015, i * 0.035, 1.43 - Math.abs(i) * 0.012, 0.1, '#E8E0C8', 0, 0, 0.004); break;
    case 'spoons': for (let i = 0; i < 4; i++) k.rod('hips', [-0.1 + i * 0.06, 1.0, 0.13], [-0.1 + i * 0.06, 0.88, 0.14], 0.006, 0.012, iron, 4); break;
    case 'eyepatch': k.hbox(0.11, 0.08, 0.02, 0.07, 1.42, 0.19, '#1A1614'); k.hbox(0.38, 0.015, 0.36, 0, 1.47, 0, '#1A1614', 0.25); break;
    case 'lantern': k.rod('spine', [0.12, 1.0, -0.14], [0.2, 1.75, -0.2], 0.01, 0.01, wood); k.box('spine', 0.08, 0.1, 0.08, 0.2, 1.7, -0.2, '#FFD27A', 0, 0, 0.01); break;
    case 'sack': k.ball('spine', 0.12, 0.02, 1.2, -0.16, '#8A7A5A', 1, 1.15, 0.8); break;
    case 'bandolier': k.box('spine', 0.04, 0.5, 0.012, 0, 1.22, 0.11, '#4A3A2A', -0.62, 0, 0.004); for (let i = 0; i < 4; i++) k.box('spine', 0.012, 0.07, 0.015, -0.08 + i * 0.05, 1.32 - i * 0.05, 0.12, '#D9D8CC'); break;
    case 'potlid': k.box('foreP', 0.03, 0.22, 0.22, 0.28, 0.93, 0.02, iron, 0, 0, 0.1); break;
    case 'trinket': k.ball('hips', 0.03, -0.17, 0.88, 0.06, p.sub?.id === 'bell' ? '#C9A23A' : p.sub?.id === 'glasseye' ? '#E8F0F8' : '#A8322A'); break;
  }
}
