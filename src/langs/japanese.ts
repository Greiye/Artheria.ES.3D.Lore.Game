import * as THREE from 'three';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import type { Talk } from '../spanish/talks';
import { buildFolk, type CaravanFolk, type LangPack } from '../spanish/caravan';

// B23 (Mike 2026-11-08, "Add NPCs that speak in Japanese"): a tea house south-east of the plaza, with three people (role
// names only) who speak only Japanese, like the Spanish caravan. Each line shows the Japanese and its romaji (a reading
// in Latin letters), never a translation; you reply by picking or by writing in kana, kanji or romaji.
export const TEAHOUSE = { x: 16, z: -25 };

export const JA_PACK: LangPack = {
  lang: 'ja', key: 'gametool.japanese', panelId: 'teahouse', voice: 'ja-JP', eyebrow: 'お茶屋 · 日本語だけ (Japanese only)',
  placeholder: '日本語で… (kana or romaji)', listen: '🔊 もう一度', bye: 'さようなら', stranger: '旅人', strangerRomaji: 'Tabibito', unspaced: true,
  bookTitle: 'Japanese · the tea house', where: 'The tea house stands south-east of the plaza.',
  puzzled: [
    { es: 'えっ？', romaji: 'E?', cue: '🤷', gesture: 'tilts their head and waits.' },
    { es: 'すみません、わかりません。', romaji: 'Sumimasen, wakarimasen.', cue: '😕', gesture: 'bows a little, puzzled.' },
    { es: 'もう一度お願いします。', romaji: 'Mō ichido onegai shimasu.', cue: '👂', gesture: 'leans in and cups a hand to their ear.' },
  ],
};

export const JA_TALKS: Talk[] = [
  {
    id: 'tea', role: 'お茶屋さん', roleRomaji: 'Ochaya-san', pronoun: 'The tea seller', verb: 'Talk to the tea seller (Japanese)', reward: 4,
    look: { primary: '#3E6E5A', secondary: '#E8DCC0', accent: '#B8432F', skirt: true },
    lines: [
      { es: 'こんにちは！お名前は？', romaji: 'Konnichiwa! O-namae wa?', cue: '👋', gesture: 'bows, then opens a hand toward you.',
        answers: [{ es: '{name}です。', romaji: '{name} desu.', ok: true }, { es: 'さようなら。', romaji: 'Sayōnara.', ok: false }, { es: 'お茶です。', romaji: 'Ocha desu.', ok: false }],
        typed: ['です', 'desu', 'namae', 'なまえ', '名前', 'watashi', 'わたし', '私'], wrongTyped: ['sayonara', 'さようなら', 'ocha desu', 'おちゃです', 'お茶です'] },
      { es: 'お茶はいかがですか？', romaji: 'Ocha wa ikaga desu ka?', cue: '🍵', gesture: 'lifts a small cup of green tea toward you.',
        answers: [{ es: 'はい、お願いします。', romaji: 'Hai, onegai shimasu.', ok: true }, { es: '私は猫です。', romaji: 'Watashi wa neko desu.', ok: false }, { es: 'いいえ、けっこうです。', romaji: 'Iie, kekkō desu.', ok: true }],
        typed: ['hai', 'はい', 'onegai', 'おねがい', 'お願い', 'iie', 'いいえ', 'kekko', 'けっこう', 'kudasai', 'ください'] },
      { es: 'どうぞ。熱いですよ。', romaji: 'Dōzo. Atsui desu yo.', cue: '♨️', gesture: 'hands you the cup with both hands, then blows on her fingers.',
        answers: [{ es: 'ありがとうございます。', romaji: 'Arigatō gozaimasu.', ok: true }, { es: '寒いです。', romaji: 'Samui desu.', ok: false }, { es: 'いただきます。', romaji: 'Itadakimasu.', ok: true }],
        typed: ['arigato', 'ありがとう', 'itadakimasu', 'いただきます', 'domo', 'どうも'] },
      { es: 'おいしいですか？', romaji: 'Oishii desu ka?', cue: '😊', gesture: 'watches you take a sip.',
        answers: [{ es: '青いです。', romaji: 'Aoi desu.', ok: false }, { es: 'はい、とてもおいしいです。', romaji: 'Hai, totemo oishii desu.', ok: true }],
        typed: ['oishii', 'おいしい', '美味しい', 'umai', 'うまい', 'hai', 'はい'] },
    ],
    farewell: { es: 'またね、{name}さん！', romaji: 'Mata ne, {name}-san!', cue: '🍵', gesture: 'bows and goes back to her kettle.' },
  },
  {
    id: 'potter', role: '陶芸家', roleRomaji: 'Tōgeika', pronoun: 'The potter', verb: 'Talk to the potter (Japanese)', reward: 4,
    look: { primary: '#6A5A8A', secondary: '#D8C8A0', accent: '#2F5F86' },
    lines: [
      { es: 'いらっしゃいませ。', romaji: 'Irasshaimase.', cue: '🏺', gesture: 'bows from behind a table of bowls.',
        answers: [{ es: 'こんにちは。', romaji: 'Konnichiwa.', ok: true }, { es: 'おやすみなさい。', romaji: 'Oyasuminasai.', ok: false }, { es: 'すみません、見てもいいですか？', romaji: 'Sumimasen, mite mo ii desu ka?', ok: true }],
        typed: ['konnichiwa', 'こんにちは', 'sumimasen', 'すみません', 'domo', 'どうも', 'hai', 'はい'], wrongTyped: ['oyasumi', 'おやすみ'] },
      { es: 'これは何色ですか？', romaji: 'Kore wa nani iro desu ka?', cue: '🟦', gesture: 'holds up a blue bowl and turns it in the light.',
        answers: [{ es: '三つです。', romaji: 'Mittsu desu.', ok: false }, { es: '青です。', romaji: 'Ao desu.', ok: true }, { es: '赤です。', romaji: 'Aka desu.', ok: false }],
        typed: ['ao', 'あお', '青'], wrongTyped: ['aka', 'あか', '赤'] },
      { es: 'いくつ欲しいですか？', romaji: 'Ikutsu hoshii desu ka?', cue: '🥣 ✋', gesture: 'holds up a stack of bowls and raises her eyebrows.',
        answers: [{ es: '一つください。', romaji: 'Hitotsu kudasai.', ok: true }, { es: '私は先生です。', romaji: 'Watashi wa sensei desu.', ok: false }, { es: '二つください。', romaji: 'Futatsu kudasai.', ok: true }],
        typed: ['hitotsu', 'ひとつ', '一つ', 'futatsu', 'ふたつ', '二つ', 'mittsu', 'みっつ', '三つ', 'kudasai', 'ください'] },
      { es: 'ありがとうございました！', romaji: 'Arigatō gozaimashita!', cue: '🙇', gesture: 'wraps the bowl in cloth and bows deeply.',
        answers: [{ es: 'ありがとう！', romaji: 'Arigatō!', ok: true }, { es: '熱いです。', romaji: 'Atsui desu.', ok: false }],
        typed: ['arigato', 'ありがとう', 'kochira koso', 'こちらこそ', 'domo', 'どうも'] },
    ],
    farewell: { es: 'また来てくださいね。', romaji: 'Mata kite kudasai ne.', cue: '🏺', gesture: 'is already shaping clay again.' },
  },
  {
    id: 'fisher', role: '漁師', roleRomaji: 'Ryōshi', pronoun: 'The fisher', verb: 'Talk to the fisher (Japanese)', reward: 5,
    look: { primary: '#2F4F6E', secondary: '#C8B890', accent: '#D99A2B' },
    lines: [
      { es: 'おはよう！どこから来ましたか？', romaji: 'Ohayō! Doko kara kimashita ka?', cue: '🧭', gesture: 'points along the road, then at you.',
        answers: [{ es: '町から来ました。', romaji: 'Machi kara kimashita.', ok: true }, { es: '魚が好きです。', romaji: 'Sakana ga suki desu.', ok: false }, { es: '森から来ました。', romaji: 'Mori kara kimashita.', ok: true }],
        typed: ['machi', 'まち', '町', 'mori', 'もり', '森', 'kara', 'から'] },
      { es: '魚が好きですか？', romaji: 'Sakana ga suki desu ka?', cue: '🐟', gesture: 'lifts a silver fish by the tail.',
        answers: [{ es: 'はい、大好きです。', romaji: 'Hai, daisuki desu.', ok: true }, { es: '町から来ました。', romaji: 'Machi kara kimashita.', ok: false }, { es: 'いいえ、あまり。', romaji: 'Iie, amari.', ok: true }],
        typed: ['suki', 'すき', '好き', 'hai', 'はい', 'iie', 'いいえ', 'amari', 'あまり'] },
      { es: '網を手伝ってくれますか？', romaji: 'Ami o tetsudatte kuremasu ka?', cue: '🕸️', gesture: 'holds out one end of a wet net.',
        answers: [{ es: 'はい、もちろん。', romaji: 'Hai, mochiron.', ok: true }, { es: 'おやすみなさい。', romaji: 'Oyasuminasai.', ok: false }, { es: 'すみません、できません。', romaji: 'Sumimasen, dekimasen.', ok: true }],
        typed: ['mochiron', 'もちろん', 'hai', 'はい', 'dekimasen', 'できません', 'sumimasen', 'すみません', 'iiyo', 'いいよ'] },
      { es: '本当にありがとう！', romaji: 'Hontō ni arigatō!', cue: '🤝', gesture: 'claps you on the shoulder. They smell of the sea.',
        answers: [{ es: 'どういたしまして。', romaji: 'Dō itashimashite.', ok: true }, { es: '青です。', romaji: 'Ao desu.', ok: false }],
        typed: ['douitashimashite', 'doitashimashite', 'どういたしまして', 'iie', 'いいえ', 'tondemonai', 'とんでもない'] },
    ],
    farewell: { es: '気をつけてね！', romaji: 'Ki o tsukete ne!', cue: '🎣', gesture: 'waves a fish at you: goodbye.' },
  },
];

/** The tea house: a raised wooden deck under a red parasol, a counter with a kettle, the potter's table and the
 *  fisher's drying rack, and a stone lantern. */
export function buildTeahouse(scene: THREE.Scene, colliders: Collider[], heightAt: (x: number, z: number) => number): CaravanFolk[] {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const { x, z } = TEAHOUSE, y = heightAt(x, z);
  const B = new Batch();
  const wood = new THREE.MeshLambertMaterial({ map: pixelTexture('wood') }), planks = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') });
  const red = new THREE.MeshLambertMaterial({ color: 0xC0392B, side: THREE.DoubleSide }), tatami = new THREE.MeshLambertMaterial({ color: 0xC8C080 });
  const stone = new THREE.MeshLambertMaterial({ color: 0x9A968C }), indigo = new THREE.MeshLambertMaterial({ color: 0x2F3F6E, side: THREE.DoubleSide });
  const iron = new THREE.MeshLambertMaterial({ color: 0x2E2A28 }), clay = new THREE.MeshLambertMaterial({ color: 0x2F5F86 }), clay2 = new THREE.MeshLambertMaterial({ color: 0xB0784A });
  const fish = new THREE.MeshLambertMaterial({ color: 0xB8C4CC });
  // The deck with tatami on it, and a bench in front.
  B.box(planks, V(x, y + 0.2, z), 3.2, 0.4, 2.2); B.box(tatami, V(x, y + 0.41, z), 2.9, 0.02, 1.9);
  B.box(wood, V(x, y + 0.25, z + 1.6), 2.4, 0.1, 0.45); for (const dx of [-1, 1]) B.box(wood, V(x + dx, y + 0.1, z + 1.6), 0.1, 0.2, 0.4);
  // The parasol: a pole and a shallow red cone with spokes.
  B.add(wood, new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), V(x + 1.1, y + 1.3, z + 0.9));
  B.add(red, new THREE.ConeGeometry(1.5, 0.45, 16, 1, true), V(x + 1.1, y + 2.55, z + 0.9));
  // A noren curtain on a frame at the back of the deck.
  B.box(wood, V(x - 1.5, y + 1.3, z - 1.0), 0.08, 2.2, 0.08); B.box(wood, V(x + 1.5, y + 1.3, z - 1.0), 0.08, 2.2, 0.08); B.box(wood, V(x, y + 2.35, z - 1.0), 3.1, 0.08, 0.08);
  for (const dx of [-1.0, 0, 1.0]) B.box(indigo, V(x + dx, y + 1.95, z - 1.0), 0.9, 0.7, 0.02);
  // The tea counter with a kettle on a brazier.
  const tx = x - 0.9, tz = z - 0.3;
  B.box(wood, V(tx, y + 0.65, tz), 0.9, 0.5, 0.5); B.add(iron, new THREE.SphereGeometry(0.16, 10, 8), V(tx, y + 1.02, tz), new THREE.Vector3(1, 0.8, 1));
  B.add(iron, new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5), V(tx + 0.17, y + 1.05, tz), undefined, 0, 0, 0.8);
  // The potter's table east of the deck, with blue and brown bowls.
  const px = x + 3.0, pz = z - 0.6;
  B.box(wood, V(px, y + 0.7, pz), 1.4, 0.08, 0.7); for (const dx of [-0.6, 0.6]) for (const dz of [-0.28, 0.28]) B.box(wood, V(px + dx, y + 0.35, pz + dz), 0.07, 0.7, 0.07);
  for (let i = 0; i < 5; i++) B.add(i % 2 ? clay2 : clay, new THREE.CylinderGeometry(0.13, 0.08, 0.1, 10), V(px - 0.5 + i * 0.25, y + 0.79, pz + (i % 2 ? 0.12 : -0.1)));
  // The fisher's drying rack west of the deck, with fish hanging.
  const fx = x - 3.0, fz = z + 0.2;
  B.box(wood, V(fx - 0.7, y + 0.8, fz), 0.07, 1.6, 0.07); B.box(wood, V(fx + 0.7, y + 0.8, fz), 0.07, 1.6, 0.07); B.box(wood, V(fx, y + 1.55, fz), 1.6, 0.05, 0.05);
  for (let i = 0; i < 4; i++) B.box(fish, V(fx - 0.5 + i * 0.33, y + 1.3, fz), 0.06, 0.4, 0.14);
  // A stone lantern by the bench.
  const lx = x - 1.9, lz = z + 2.0;
  B.box(stone, V(lx, y + 0.2, lz), 0.5, 0.4, 0.5); B.box(stone, V(lx, y + 0.65, lz), 0.18, 0.5, 0.18); B.box(stone, V(lx, y + 1.0, lz), 0.4, 0.25, 0.4);
  B.add(stone, new THREE.ConeGeometry(0.4, 0.3, 4), V(lx, y + 1.27, lz), undefined, Math.PI / 4);
  const meshes = B.flush(scene, 'teahouse');
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; m.raycast = () => {}; });
  colliders.push(
    { kind: 'box', minX: x - 1.6, maxX: x + 1.6, minZ: z - 1.1, maxZ: z + 1.1, top: y + 0.42 },
    { kind: 'circle', x: px, z: pz, r: 0.7 }, { kind: 'circle', x: fx - 0.7, z: fz, r: 0.1 }, { kind: 'circle', x: fx + 0.7, z: fz, r: 0.1 },
    { kind: 'circle', x: lx, z: lz, r: 0.3 },
  );
  const spots: Record<string, [number, number, number]> = { tea: [x - 0.3, z + 1.25, 0], potter: [px, pz + 0.75, 0], fisher: [fx, fz + 0.75, 0.2] };
  return buildFolk(scene, colliders, heightAt, JA_TALKS, spots, 9300, 'teahouse');
}
