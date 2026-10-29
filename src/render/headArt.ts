import * as THREE from 'three';
import type { FigureLook } from '../world/figure';

// Faces (realistic figures, 2026-10-29): every figure has a low-poly 3D head; its face is drawn, on two quads over the
// skull's front (src/world/figure.ts, src/render/sprites.ts): an eye strip and a mouth strip, each swapped on its own
// (the DokiBird method from the references review, 2026-10-29), so blinking and talking combine with any expression.
// An expression change only moves the quads' UVs, like Mega Man Legends' face textures.
// Expressions (6, from the Echoes sheet): neutral, happy, angry, surprised, sad, wink. Eye rows: open, blink, happy,
// angry, surprised, sad, wink, half. Mouth rows: neutral, smile, frown, open, grit, talk-a, talk-b.
// Hand-drawn art goes in src/art/heads/ (see README.md there): eye and mouth strip sheets (<id>-eyes.png,
// <id>-mouth.png), or a whole-face sheet (<id>-face.png, rows neutral / blink / talk-a / talk-b) whose cells are cut
// into the two strips. A look with `art: '<id>'` uses them, inlined into the build. Every other look gets strips drawn
// here in code, in "head units" (1 u = one head diameter = U_PX pixels).

const U_PX = 40;
export const SHEET = { w: 2.4, h: 2.6, top: 1.0 };   // frame size in head units; head centre 1.0 u below the top
// Realistic figures' face quad: the part of a face cell it shows (head units), centred FACE.drop u below the head's
// centre. The cell is 2.4 × 2.6 u, so this is its middle 1.2 × 1.2 u: eyes, brows, nose line and mouth.
// `split` is where the eye strip ends and the mouth strip starts, as a fraction of the face from its top.
export const FACE = { w: 1.2, h: 1.2, drop: 0.15, split: 0.65 };
const FW = Math.round(SHEET.w * U_PX), FH = Math.round(SHEET.h * U_PX);   // 96 × 104 px cells
const EXPRESSIONS = ['neutral', 'blink', 'talk-a', 'talk-b'];   // whole-face rows when a sheet has no JSON
export const EYES = ['open', 'blink', 'happy', 'angry', 'surprised', 'sad', 'wink', 'half'] as const;
export const MOUTHS = ['neutral', 'smile', 'frown', 'open', 'grit', 'talk-a', 'talk-b'] as const;
/** The six expressions, as an eye row and a mouth row. Talking swaps the mouth and blinking the eyes on top. */
export const EXPRESSION: Record<string, { eyes: string; mouth: string }> = {
  neutral: { eyes: 'open', mouth: 'neutral' }, happy: { eyes: 'happy', mouth: 'smile' }, angry: { eyes: 'angry', mouth: 'grit' },
  surprised: { eyes: 'surprised', mouth: 'open' }, sad: { eyes: 'sad', mouth: 'frown' }, wink: { eyes: 'wink', mouth: 'smile' },
};
// The face quad's window on a cell, in cell pixels, and its two strips.
const CROP = { x: Math.round((SHEET.w - FACE.w) / 2 * U_PX), y: Math.round((SHEET.top + FACE.drop - FACE.h / 2) * U_PX), w: Math.round(FACE.w * U_PX), h: Math.round(FACE.h * U_PX) };
const EYE_H = Math.round(CROP.h * FACE.split), MOUTH_H = CROP.h - EYE_H;   // 31 and 17 px

/** A frame in UV space, ready for the billboard: uv * (sx, sy) + (ox, oy). */
export type Frame = [number, number, number, number];
export interface HeadArt {
  face: THREE.Texture | null;
  eyes: Map<string, Frame>;                  // eye row → its strip
  mouths: Map<string, Frame>;                // mouth row → its strip
}

interface AseFrame { frame: { x: number; y: number; w: number; h: number } }
interface AseSheet { frames: Record<string, AseFrame> | AseFrame[]; meta: { size: { w: number; h: number }; frameTags?: { name: string; from: number; to: number }[] } }

const PNG = import.meta.glob('../art/heads/*-{face,eyes,mouth}.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const JSONS = import.meta.glob('../art/heads/*-{face,eyes,mouth}.json', { eager: true, import: 'default' }) as Record<string, AseSheet>;
const fileOf = (name: string) => `../art/heads/${name}`;
/** Ids that have hand-drawn face art in src/art/heads/ (strips, or a whole-face sheet). */
const drawnFaces = [...new Set(Object.keys(PNG).map((k) => k.split('/').pop()!.replace(/-(face|eyes|mouth)\.png$/, '')))];

const EYE: Record<string, string[]> = {
  round:  ['kkkkkk.', 'kkkkkkk', 'kwhhiik', 'kwhddik', 'kwiddik', 'kwiddik', 'kwlddik', 'kwllilk', '.kllll.', '..kkk..'],
  sleepy: ['......', '......', '......', 'kkkkkk', 'kiddik', 'kliilk', '.kkkk.', '......'],
  slit:   ['.kkkk.', 'kkkkkk', 'khiiik', 'kiidik', 'kiidik', 'kiidik', 'kliilk', '.kllk.'],
  owl:    ['.wwww.', 'wiiiiw', 'iikkii', 'iikkhi', 'iikkii', 'iikkii', 'wiiiiw', '.wwww.'],
};

const hex = (c: THREE.Color) => '#' + c.getHexString();
const tone = (col: string, k: number) => hex(new THREE.Color(col).multiplyScalar(k));

const pixelTex = <T extends THREE.Texture>(t: T): T => {
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
};
// A pixel rect on a W × H sheet as a UV frame (textures are flipped, so v runs up from the bottom).
const uvFrame = (x: number, y: number, w: number, h: number, W: number, H: number): Frame => [w / W, h / H, x / W, 1 - (y + h) / H];
type Px = [number, number, number, number];
const cell = (f: Px, W: number, H: number) => uvFrame(f[0], f[1], f[2], f[3], W, H);

function aseFrames(j: AseSheet): Px[] {
  const list = Array.isArray(j.frames) ? j.frames : Object.values(j.frames);
  return list.map(({ frame: f }) => [f.x, f.y, f.w, f.h]);
}
function grid(W: number, row: number): Px[] {
  return Array.from({ length: Math.max(1, Math.floor(W / FW)) }, (_, i) => [i * FW, row * FH, FW, FH]);
}

const cache = new Map<string, HeadArt>();

/** The face art for a look: its hand-drawn sheet when `look.art` names one, otherwise drawn here. */
export function headArt(look: FigureLook): HeadArt {
  const key = look.art && drawnFaces.includes(look.art) ? 'art:' + look.art : JSON.stringify(look);
  let art = cache.get(key);
  if (!art) { art = key.startsWith('art:') ? loadArt(look.art!, generated(look)) : generated(look); cache.set(key, art); }
  return art;
}

// Hand-drawn sheets load asynchronously (inlined data URLs, so it's near-instant); the drawn face shows until then.
// Strip sheets (eyes + mouth) win over a whole-face sheet; either way the result is one texture.
function loadArt(id: string, fallback: HeadArt): HeadArt {
  const art: HeadArt = { ...fallback, eyes: new Map(fallback.eyes), mouths: new Map(fallback.mouths) };
  const eyesUrl = PNG[fileOf(id + '-eyes.png')], mouthUrl = PNG[fileOf(id + '-mouth.png')], faceUrl = PNG[fileOf(id + '-face.png')];
  const load = (url: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  if (eyesUrl && mouthUrl) {
    Promise.all([load(eyesUrl), load(mouthUrl)]).then(([e, m]) => {
      // Side by side on one canvas, so a figure still draws its face with one texture.
      const c = document.createElement('canvas'); c.width = e.width + m.width; c.height = Math.max(e.height, m.height);
      const g = c.getContext('2d')!; g.drawImage(e, 0, 0); g.drawImage(m, e.width, 0);
      art.eyes = strips(e, 0, EYE_H, EYES, JSONS[fileOf(id + '-eyes.json')], c.width, c.height);
      art.mouths = strips(m, e.width, MOUTH_H, MOUTHS, JSONS[fileOf(id + '-mouth.json')], c.width, c.height);
      art.face = pixelTex(new THREE.CanvasTexture(c));
    }).catch(() => undefined);
  } else if (faceUrl) {
    new THREE.TextureLoader().load(faceUrl, (t) => {
      const { width: W, height: H } = t.image as HTMLImageElement, j = JSONS[fileOf(id + '-face.json')];
      const cells = new Map<string, Px>();
      if (j?.meta.frameTags?.length) { const all = aseFrames(j); for (const tag of j.meta.frameTags) cells.set(tag.name, all[tag.from]); }
      else for (let row = 0; row * FH < H; row++) cells.set(EXPRESSIONS[row] ?? `row${row}`, grid(W, row)[0]);
      // A whole-face sheet is cut into strips: its blink row gives the blink eyes, its talk rows the talk mouths,
      // and the expression rows it has (happy, angry, …, by Aseprite tag) give theirs.
      const eyes = new Map<string, Frame>(), mouths = new Map<string, Frame>(), n = cells.get('neutral') ?? [...cells.values()][0];
      for (const e of EYES) { const c = cells.get(e === 'open' ? 'neutral' : e) ?? n; eyes.set(e, eyeOf(c, W, H)); }
      for (const m of MOUTHS) { const ex = Object.entries(EXPRESSION).find(([, v]) => v.mouth === m)?.[0]; const c = cells.get(m) ?? (ex ? cells.get(ex) : undefined) ?? n; mouths.set(m, mouthOf(c, W, H)); }
      art.eyes = eyes; art.mouths = mouths;
      art.face = pixelTex(t);
    });
  }
  return art;
}
const eyeOf = (c: Px, W: number, H: number) => cell([c[0] + CROP.x, c[1] + CROP.y, CROP.w, EYE_H], W, H);
const mouthOf = (c: Px, W: number, H: number) => cell([c[0] + CROP.x, c[1] + CROP.y + EYE_H, CROP.w, MOUTH_H], W, H);
// Strip sheets: one row per state (in the order of EYES / MOUTHS), cells as wide as the image, or Aseprite tags.
function strips(img: HTMLImageElement, x0: number, h: number, names: readonly string[], j: AseSheet | undefined, W: number, H: number) {
  const out = new Map<string, Frame>();
  if (j?.meta.frameTags?.length) { const all = aseFrames(j); for (const t of j.meta.frameTags) { const f = all[t.from]; out.set(t.name, cell([x0 + f[0], f[1], f[2], f[3]], W, H)); } }
  else { const rh = Math.round(img.width * h / CROP.w); for (let r = 0; (r + 1) * rh <= img.height; r++) out.set(names[r] ?? `row${r}`, cell([x0, r * rh, img.width, rh], W, H)); }
  for (const n of names) if (!out.has(n)) out.set(n, out.get(names[0])!);
  return out;
}

// The drawn fallback: two columns of cells, eyes on the left (a row per eye state) and the mouth on the right.
function generated(look: FigureLook): HeadArt {
  const rows = Math.max(EYES.length, MOUTHS.length);
  const fc = document.createElement('canvas'); fc.width = FW * 2; fc.height = FH * rows;
  const fg = fc.getContext('2d')!;
  const eyes = new Map<string, Frame>(), mouths = new Map<string, Frame>();
  EYES.forEach((e, row) => { drawFace(fg, 0, row * FH, look, e, null); eyes.set(e, eyeOf([0, row * FH, FW, FH], fc.width, fc.height)); });
  MOUTHS.forEach((m, row) => { drawFace(fg, FW, row * FH, look, null, m); mouths.set(m, mouthOf([FW, row * FH, FW, FH], fc.width, fc.height)); });
  return { face: pixelTex(new THREE.CanvasTexture(fc)), eyes, mouths };
}

// The front face cell: pixel eyes stamped at whole-pixel positions with brows (eye cells), or blush, freckles and
// the mouth (mouth cells), plus species details.
function drawFace(g: CanvasRenderingContext2D, x0: number, y0: number, L: FigureLook, eye: string | null, mouth: string | null) {
  const u = U_PX, r = u / 2, cx = x0 + FW / 2, cy = y0 + SHEET.top * u, sp = L.species ?? 'human';
  const rect = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const es = L.eyeStyle ?? (sp === 'owlkin' || sp === 'corvani' ? 'owl' : sp === 'drakari' ? 'slit' : 'round');
  const base = new THREE.Color(L.eyes ?? (es === 'owl' ? '#E0A020' : '#4A6A8A'));
  const pal: Record<string, string> = { k: '#2A2026', w: '#FFF8EC', h: '#FFFFFF', i: hex(base), d: hex(base.clone().multiplyScalar(0.5)), l: hex(base.clone().lerp(new THREE.Color('#FFFFFF'), 0.45)) };
  const stamp = EYE[es] ?? EYE.round, sw = stamp[0].length, sh = stamp.length, k = Math.max(1, Math.round(u / 20));
  const eyeY = Math.round(cy + r * 0.2), brow = tone(L.hair, 0.55);
  if (eye) for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * r * 0.4 - (sw * k) / 2), top = eyeY - (sh * k) / 2;
    const closed = eye === 'blink' || (eye === 'wink' && s > 0);
    if (closed) rect(ex, eyeY + k, sw * k, k, pal.k);                                          // a lash line
    else if (eye === 'happy') { rect(ex, eyeY, k, k, pal.k); rect(ex + k, eyeY - k, (sw - 2) * k, k, pal.k); rect(ex + (sw - 1) * k, eyeY, k, k, pal.k); }   // ^ ^
    else {
      const cut = eye === 'half' ? Math.floor(sh / 2) : eye === 'sad' ? 2 : 0;                  // lids drop over the top
      stamp.forEach((row, y) => { if (y < cut) return; [...row].forEach((ch, x) => {
        if (ch !== '.') rect(ex + (s < 0 ? x : sw - 1 - x) * k, top + y * k, k, k, pal[ch]);
      }); });
      if (cut) rect(ex, top + cut * k, sw * k, k, pal.k);
    }
    if (es === 'owl') continue;
    // Brows: a thin stroke, tilted for angry (down to the nose) and sad (up to the nose), raised when surprised.
    const bx = ex + (s < 0 ? 0 : k), bw = (sw - 2) * k, by = top - 3 * k - (eye === 'surprised' ? 2 * k : 0);
    if (eye === 'angry' || eye === 'sad') {
      const steps = 3, inner = s < 0 ? 1 : 0;
      for (let i = 0; i < steps; i++) {
        const t = inner ? i / (steps - 1) : 1 - i / (steps - 1), dy = Math.round((eye === 'angry' ? t : 1 - t) * 2 * k);
        rect(bx + i * bw / steps, by + dy, Math.ceil(bw / steps), k, brow);
      }
    } else rect(bx, by, bw, 1, brow);
  }
  if (eye && L.marks) for (const [dx, dy] of [[-0.55, 0.5], [-0.45, 0.58], [0.45, 0.5], [0.55, 0.58]]) rect(cx + dx * r, cy + dy * r, k, k, L.marks);   // freckles sit in the eye strip
  if (!mouth) return;
  const bl = 'rgba(240,140,140,0.55)';
  rect(cx - r * 0.6 - 2 * k, eyeY + 6 * k, 3 * k, k, bl); rect(cx + r * 0.6 - k, eyeY + 6 * k, 3 * k, k, bl);
  const lip = sp === 'infernling' || sp === 'drakari' ? '#3A1A1A' : '#8A3A34', dark = '#4A1E24', y = eyeY + 8 * k;
  if (mouth === 'talk-a') rect(cx - k, eyeY + 7 * k, 2 * k, 2 * k, dark);
  else if (mouth === 'talk-b') { rect(cx - k - 1, eyeY + 7 * k, 2 * k + 2, 3 * k, dark); rect(cx - k + 1, eyeY + 9 * k, 2 * k - 2, k, '#C8606A'); }
  else if (mouth === 'smile') { rect(cx - 2 * k, y - k, k, k, lip); rect(cx - k, y, 2 * k, k, lip); rect(cx + k, y - k, k, k, lip); }
  else if (mouth === 'frown') { rect(cx - 2 * k, y + k, k, k, lip); rect(cx - k, y, 2 * k, k, lip); rect(cx + k, y + k, k, k, lip); }
  else if (mouth === 'open') { rect(cx - k, y - k, 2 * k, 3 * k, dark); }
  else if (mouth === 'grit') { rect(cx - 2 * k, y - k, 4 * k, 2 * k, '#F2EEE6'); rect(cx - 2 * k, y - k, 4 * k, 1, dark); rect(cx - 2 * k, y + k - 1, 4 * k, 1, dark); }
  else rect(cx - k, y, 2 * k, k, lip);
}
