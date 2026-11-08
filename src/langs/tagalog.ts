import * as THREE from 'three';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import type { Talk } from '../spanish/talks';
import { buildFolk, type CaravanFolk, type LangPack } from '../spanish/caravan';

// B23 (Mike 2026-11-08, "Add more NPCs that speak in Tagalog"): a market corner south-east of the plaza, with four
// people (role names only) who speak only Tagalog, like the Spanish caravan: a fruit seller, a fisherman by his
// outrigger, a grandmother on her bench and a child with a sipa. Never translated.
export const PALENGKE = { x: 24, z: -15 };

export const TL_PACK: LangPack = {
  lang: 'tl', key: 'gametool.tagalog', panelId: 'palengke', voice: 'fil-PH', eyebrow: 'Palengke · Tagalog lang (Tagalog only)',
  placeholder: 'Sumulat sa Tagalog…', listen: '🔊 Ulit', bye: 'Paalam', stranger: 'Kaibigan',
  bookTitle: 'Tagalog · the market', where: 'The market corner is south-east of the plaza.',
  puzzled: [
    { es: 'Ha?', cue: '🤷', gesture: 'tilts their head and waits.' },
    { es: 'Hindi kita maintindihan.', cue: '😕', gesture: 'frowns kindly and shrugs.' },
    { es: 'Ano ulit? Pakiulit nga.', cue: '👂', gesture: 'cups a hand to their ear.' },
  ],
};

export const TL_TALKS: Talk[] = [
  {
    id: 'tindera', role: 'Ang tindera', pronoun: 'The fruit seller', verb: 'Talk to the fruit seller (Tagalog)', reward: 4,
    look: { primary: '#D99A2B', secondary: '#F0E6C8', accent: '#3E8E4A', skirt: true },
    lines: [
      { es: 'Magandang umaga! Ano ang pangalan mo?', cue: '👋', gesture: 'waves a banana, then points it at you.',
        answers: [{ es: 'Ako si {name}.', ok: true }, { es: 'Ang init!', ok: false }, { es: 'Paalam.', ok: false }],
        typed: ['ako si', 'pangalan ko', 'ako'], wrongTyped: ['paalam'] },
      { es: 'Gusto mo ba ng mangga?', cue: '🥭', gesture: 'holds up a ripe yellow mango.',
        answers: [{ es: 'Oo, salamat.', ok: true }, { es: 'Ako si Mangga.', ok: false }, { es: 'Hindi, salamat.', ok: true }],
        typed: ['oo', 'opo', 'hindi', 'salamat', 'gusto', 'ayoko'] },
      { es: 'Limang korona ito.', cue: '🥭 🖐️', gesture: 'holds up the mango, then five fingers.',
        answers: [{ es: 'Ang mahal!', ok: true }, { es: 'Saan ka galing?', ok: false }, { es: 'Sige, heto.', ok: true }],
        typed: ['mahal', 'sige', 'heto', 'eto', 'tawad', 'okay'] },
      { es: 'Sige na nga, tatlo na lang para sa iyo.', cue: '🤝', gesture: 'laughs and folds two fingers away.',
        answers: [{ es: 'Ako si Tatlo.', ok: false }, { es: 'Salamat po!', ok: true }],
        typed: ['salamat', 'sige', 'ayos'] },
    ],
    farewell: { es: 'Balik ka ulit, {name}!', cue: '🍌', gesture: 'is already calling to the next customer.' },
  },
  {
    id: 'mangingisda', role: 'Ang mangingisda', pronoun: 'The fisherman', verb: 'Talk to the fisherman (Tagalog)', reward: 4,
    look: { primary: '#2F7F86', secondary: '#E0D2B0', accent: '#C0392B' },
    lines: [
      { es: 'Kumusta ka?', cue: '🙂', gesture: 'nods at you over the hull of his boat.',
        answers: [{ es: 'Mabuti naman, salamat.', ok: true }, { es: 'Isda ako.', ok: false }, { es: 'Mabuti. Ikaw?', ok: true }],
        typed: ['mabuti', 'ayos', 'ok lang', 'okay lang', 'salamat', 'masaya'] },
      { es: 'Saan ka galing?', cue: '🧭', gesture: 'points along the road, then at you.',
        answers: [{ es: 'Gusto ko ng mangga.', ok: false }, { es: 'Galing ako sa bayan.', ok: true }, { es: 'Galing ako sa gubat.', ok: true }],
        typed: ['galing', 'bayan', 'gubat', 'taga'] },
      { es: 'Tulungan mo ako sa lambat?', cue: '🕸️', gesture: 'holds out one end of a wet net.',
        answers: [{ es: 'Sige, tutulong ako.', ok: true }, { es: 'Magandang gabi.', ok: false }, { es: 'Pasensya na, hindi ko kaya.', ok: true }],
        typed: ['sige', 'oo', 'opo', 'tutulong', 'tulong', 'hindi', 'pasensya'] },
      { es: 'Maraming salamat, kaibigan!', cue: '🤝', gesture: 'shakes your hand hard. His hand smells of salt.',
        answers: [{ es: 'Walang anuman.', ok: true }, { es: 'Ang mahal!', ok: false }],
        typed: ['walang anuman', 'wala yun', 'walang problema', 'walang anoman'] },
    ],
    farewell: { es: 'Ingat ka!', cue: '🎣', gesture: 'waves you off and pushes the boat out a little.' },
  },
  {
    id: 'lola', role: 'Si Lola', pronoun: 'Lola (the grandmother)', verb: 'Talk to Lola, the grandmother (Tagalog)', reward: 5,
    look: { primary: '#8A3A5A', secondary: '#F0E0D0', accent: '#E8C860', skirt: true },
    lines: [
      { es: 'Halika, apo. Upo ka.', cue: '🪑', gesture: 'pats the bench beside her.',
        answers: [{ es: 'Salamat po, Lola.', ok: true }, { es: 'Ayoko ng isda.', ok: false }],
        typed: ['salamat', 'opo', 'sige', 'oo'] },
      { es: 'Gutom ka na ba?', cue: '🍚', gesture: 'lifts the lid off a pot of rice.',
        answers: [{ es: 'Opo, gutom na ako.', ok: true }, { es: 'Ang mahal!', ok: false }, { es: 'Hindi pa po.', ok: true }],
        typed: ['opo', 'oo', 'gutom', 'hindi', 'busog'] },
      { es: 'Kain na! Masarap ba?', cue: '🍲', gesture: 'spoons adobo onto your rice and watches you eat.',
        answers: [{ es: 'Asul po.', ok: false }, { es: 'Opo, masarap po!', ok: true }, { es: 'Medyo maalat po.', ok: true }],
        typed: ['masarap', 'sarap', 'opo', 'oo', 'salamat', 'maalat'] },
      { es: 'Mabait kang bata.', cue: '🥰', gesture: 'pinches your cheek.',
        answers: [{ es: 'Salamat po, Lola.', ok: true }, { es: 'Galing ako sa bayan.', ok: false }],
        typed: ['salamat', 'opo', 'mahal kita'] },
    ],
    farewell: { es: 'Mag-ingat ka, apo.', cue: '🌺', gesture: 'goes back to fanning herself.' },
  },
  {
    id: 'bata', role: 'Ang bata', pronoun: 'The child', verb: 'Talk to the child (Tagalog)', reward: 4,
    look: { primary: '#C0392B', secondary: '#F4E8C8', accent: '#3E6EB8' },
    lines: [
      { es: 'Uy! Laro tayo?', cue: '🪶', gesture: 'bounces a feathered sipa on one foot.',
        answers: [{ es: 'Sige, laro tayo!', ok: true }, { es: 'Masarap po.', ok: false }, { es: 'Mamaya na lang.', ok: true }],
        typed: ['sige', 'laro', 'oo', 'mamaya', 'ayoko', 'tara'] },
      { es: 'Ikaw muna!', cue: '🦶', gesture: 'kicks the sipa to you. You kick it back.',
        answers: [{ es: 'Ikaw naman!', ok: true }, { es: 'Gutom na ako.', ok: false }],
        typed: ['ikaw', 'naman', 'sige', 'heto'] },
      { es: 'Ang galing mo!', cue: '👏', gesture: 'claps when the sipa comes back to him.',
        answers: [{ es: 'Ingat ka.', ok: false }, { es: 'Salamat! Ikaw rin!', ok: true }],
        typed: ['salamat', 'ikaw rin', 'ikaw din'] },
      { es: 'Bukas ulit, ha?', cue: '🌅', gesture: 'points at the sun, then over the hills.',
        answers: [{ es: 'Oo, bukas!', ok: true }, { es: 'Kumusta ka?', ok: false }],
        typed: ['oo', 'sige', 'bukas', 'opo'] },
    ],
    farewell: { es: 'Babay, {name}!', cue: '👋', gesture: 'runs off after the sipa.' },
  },
];

/** The market corner: a bamboo stall under a thatched roof with fruit, an outrigger boat on blocks, Lola's bench and
 *  rice pot. */
export function buildPalengke(scene: THREE.Scene, colliders: Collider[], heightAt: (x: number, z: number) => number): CaravanFolk[] {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const { x, z } = PALENGKE, y = heightAt(x, z);
  const B = new Batch();
  const wood = new THREE.MeshLambertMaterial({ map: pixelTexture('wood') }), planks = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') });
  const bamboo = new THREE.MeshLambertMaterial({ color: 0xC8B060 }), thatch = new THREE.MeshLambertMaterial({ color: 0x9A7A3A });
  const mango = new THREE.MeshLambertMaterial({ color: 0xF2B830 }), banana = new THREE.MeshLambertMaterial({ color: 0xF0D850 }), green = new THREE.MeshLambertMaterial({ color: 0x5A9A3A });
  const hull = new THREE.MeshLambertMaterial({ color: 0x2F7FA6 }), white = new THREE.MeshLambertMaterial({ color: 0xF0ECE0 }), iron = new THREE.MeshLambertMaterial({ color: 0x2E2A28 });
  // The stall: four bamboo posts, a sloped thatch roof, a counter with crates of fruit.
  for (const dx of [-1.2, 1.2]) for (const dz of [-0.6, 0.6]) B.add(bamboo, new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6), V(x + dx, y + 1.15, z + dz));
  B.box(thatch, V(x, y + 2.35, z), 2.9, 0.14, 1.8); B.box(thatch, V(x, y + 2.25, z + 0.95), 2.9, 0.1, 0.3, 0);
  B.box(planks, V(x, y + 0.8, z + 0.3), 2.4, 0.08, 0.7); B.box(bamboo, V(x, y + 0.4, z + 0.62), 2.4, 0.8, 0.05);
  for (let i = 0; i < 3; i++) {
    const cx = x - 0.8 + i * 0.8;
    B.box(wood, V(cx, y + 0.95, z + 0.3), 0.6, 0.22, 0.5);
    for (let k = 0; k < 4; k++) B.add(i === 1 ? banana : i === 0 ? mango : green, i === 1 ? new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5) : new THREE.SphereGeometry(0.09, 7, 5), V(cx - 0.18 + (k % 2) * 0.36, y + 1.12, z + 0.18 + Math.floor(k / 2) * 0.22), undefined, 0, 0, i === 1 ? Math.PI / 2 : 0);
  }
  // The outrigger (bangka) on blocks, to the east: a narrow hull, two bamboo arms and floats.
  const bx = x + 3.6, bz = z + 0.4;
  B.add(hull, new THREE.CylinderGeometry(0.32, 0.22, 3.4, 8), V(bx, y + 0.55, bz), new THREE.Vector3(1, 1, 0.75), 0, 0, Math.PI / 2);
  B.box(white, V(bx, y + 0.82, bz), 3.0, 0.05, 0.42);
  for (const dx of [-0.8, 0.8]) { B.add(bamboo, new THREE.CylinderGeometry(0.03, 0.03, 2.6, 5), V(bx + dx, y + 0.8, bz), undefined, 0, Math.PI / 2, 0); }
  for (const dz of [-1.3, 1.3]) B.add(bamboo, new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), V(bx, y + 0.6, bz + dz), undefined, 0, 0, Math.PI / 2);
  for (const dx of [-1, 1]) B.box(wood, V(bx + dx, y + 0.15, bz), 0.3, 0.3, 0.5);
  // Lola's bench and a rice pot on a little stove, to the west.
  const lx = x - 3.0, lz = z + 0.6;
  B.box(wood, V(lx, y + 0.42, lz), 1.6, 0.08, 0.45); for (const dx of [-0.65, 0.65]) B.box(wood, V(lx + dx, y + 0.2, lz), 0.08, 0.4, 0.4);
  B.add(iron, new THREE.CylinderGeometry(0.22, 0.18, 0.3, 10), V(lx + 1.25, y + 0.45, lz + 0.5)); B.box(planks, V(lx + 1.25, y + 0.15, lz + 0.5), 0.45, 0.3, 0.45);
  const meshes = B.flush(scene, 'palengke');
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; m.raycast = () => {}; });
  colliders.push(
    { kind: 'box', minX: x - 1.3, maxX: x + 1.3, minZ: z - 0.7, maxZ: z + 0.7 },
    { kind: 'box', minX: bx - 1.7, maxX: bx + 1.7, minZ: bz - 1.4, maxZ: bz + 1.4, top: y + 0.9 },
    { kind: 'circle', x: lx, z: lz, r: 0.6 }, { kind: 'circle', x: lx + 1.25, z: lz + 0.5, r: 0.3 },
  );
  const spots: Record<string, [number, number, number]> = {
    tindera: [x, z + 1.15, 0], mangingisda: [bx - 0.4, bz + 1.85, 0], lola: [lx - 0.2, lz + 0.65, 0], bata: [x + 1.6, z + 2.6, -0.4],
  };
  return buildFolk(scene, colliders, heightAt, TL_TALKS, spots, 9500, 'palengke');
}
