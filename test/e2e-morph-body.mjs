// B57 morphology, PR 3 (Mike 2026-11-06, option 1; LOD at 20 m): a character from a spec. The shared base body wears
// the cached parts; the morphs change height, limbs, build, head and face; feet stay on the ground; FigureAnim drives
// it; the small details hide past 20 m; disposing one frees only what was its own.
// Usage: node test/e2e-morph-body.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool?.morph?.assemble, null, { timeout: 180000 });
const G = (fn, a) => page.evaluate(fn, a);

const one = await G(() => {
  const m = window.__gametool.morph, c = m.assemble(m.defaultSpec()), rig = c.userData.rig;
  return { bones: Object.keys(rig.bones).length, skinned: !!rig.mesh.isSkinnedMesh, shared: rig.mesh.geometry === m.baseBody(), parts: c.userData.detail.length, morph: rig.mesh.morphTargetInfluences.length, h: c.userData.height };
});
check('A spec becomes a rigged figure on the shared base body', one.bones === 12 && one.skinned && one.shared && one.morph === 1 && Math.abs(one.h - 1.75) < 1e-6, JSON.stringify(one));

const size = await G(() => {
  const m = window.__gametool.morph, out = {};
  const at = (morphs) => {
    const s = m.defaultSpec(); Object.assign(s.morphs, morphs);
    const c = m.assemble(s), body = c.userData.rig.mesh;
    c.updateMatrixWorld(true); body.computeBoundingBox();
    const b = body.boundingBox, head = c.userData.rig.bones.head.getWorldPosition(new window.__gametool.Vector3());
    const v = new window.__gametool.Vector3();
    const wide = c.userData.rig.bones.spine.getWorldScale(v).x;
    return { minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3), w: +(b.max.x - b.min.x).toFixed(3), head: +head.y.toFixed(3), wide: +wide.toFixed(3), hand: +c.userData.rig.bones.foreN.getWorldPosition(new window.__gametool.Vector3()).y.toFixed(3) };
  };
  out.short = at({ height: 0 }); out.avg = at({}); out.tall = at({ height: 1 });
  out.longLegs = at({ limbLength: 1 }); out.shortLegs = at({ limbLength: 0 });
  out.slim = at({ build: 0 }); out.broad = at({ build: 1 }); out.bigHead = at({ headSize: 1 });
  return out;
});
check('Height: 1.55 m to 1.95 m, the body\'s top near that', Math.abs(size.short.maxY - 1.55) < 0.08 && Math.abs(size.tall.maxY - 1.95) < 0.1 && size.tall.head > size.avg.head && size.avg.head > size.short.head, JSON.stringify({ s: size.short.maxY, a: size.avg.maxY, t: size.tall.maxY }));
check('Feet stay on the ground at every height and leg length', ['short', 'avg', 'tall', 'longLegs', 'shortLegs', 'slim', 'broad'].every((k) => Math.abs(size[k].minY) < 0.03), JSON.stringify(Object.fromEntries(Object.entries(size).map(([k, v]) => [k, v.minY]))));
check('Limb length: longer legs carry the head higher', size.longLegs.head > size.avg.head + 0.03 && size.shortLegs.head < size.avg.head - 0.03, JSON.stringify([size.shortLegs.head, size.avg.head, size.longLegs.head]));
check('Build: broad is wider than slim', size.broad.wide > size.slim.wide * 1.25 && Math.abs(size.slim.wide - 0.86) < 0.01 && size.broad.w > size.slim.w, JSON.stringify([size.slim, size.broad]));
check('Head size: the head grows', size.bigHead.maxY > size.avg.maxY + 0.01, JSON.stringify([size.avg.maxY, size.bigHead.maxY]));

const face = await G(() => { const m = window.__gametool.morph, s = m.defaultSpec(); s.morphs.faceShape = 0; const a = m.assemble(s); s.morphs.faceShape = 1; const b = m.assemble(s); return [a.userData.rig.mesh.morphTargetInfluences[0], b.userData.rig.mesh.morphTargetInfluences[0]]; });
check('Face shape is the morph target (-1 narrow … +1 broad)', face[0] === -1 && face[1] === 1, JSON.stringify(face));

const share = await G(() => {
  const m = window.__gametool.morph, c = new m.PartCache();
  const a = m.assemble(m.randomCharacterSpec(5), c), b = m.assemble(m.randomCharacterSpec(5), c);
  const geos = (x) => { const g = []; x.traverse((o) => { if (o.isMesh && o.name.startsWith('part:')) g.push(o.geometry); }); return g; };
  const ga = geos(a), gb = geos(b);
  const r = { n: ga.length, same: ga.length > 0 && ga.every((g, i) => g === gb[i]), mat: a.userData.rig.mesh.material === b.userData.rig.mesh.material, stats: c.stats };
  c.dispose();
  return r;
});
check('Two people in the same clothes share every geometry and material', share.same && share.mat, JSON.stringify(share));

const anim = await G(() => {
  const g = window.__gametool, m = g.morph, c = m.assemble(m.randomCharacterSpec(9)), fa = new g.figureKit.FigureAnim(c.userData.rig);
  const t0 = c.userData.rig.bones.thighN.rotation.x, s0 = c.userData.rig.bones.thighN.scale.y;
  let moved = 0;
  for (let i = 0; i < 40; i++) { fa.update(1 / 30, { speed: 3 }); moved = Math.max(moved, Math.abs(c.userData.rig.bones.thighN.rotation.x - t0)); }
  c.updateMatrixWorld(true);
  return { moved, s0, scale: c.userData.rig.bones.thighN.scale.y };
});
check('FigureAnim walks an assembled character (and keeps its morphs)', anim.moved > 0.2 && anim.s0 !== 1 && anim.scale === anim.s0, JSON.stringify(anim));

const lod = await G(() => {
  const g = window.__gametool, m = g.morph, c = m.assemble(m.randomCharacterSpec(11)), V = g.Vector3;
  c.position.set(0, 0, 0); c.updateMatrixWorld(true);
  const vis = () => c.userData.detail.filter((o) => o.visible).length;
  const n = c.userData.detail.length;
  const far = m.updateLod(c, new V(0, 1.6, m.LOD_DIST + 5)), vFar = vis();
  const near = m.updateLod(c, new V(0, 1.6, 5)), vNear = vis();
  return { n, far, vFar, near, vNear, dist: m.LOD_DIST };
});
check('LOD at 20 m: the face details hide past it and come back nearer', lod.dist === 20 && lod.n > 0 && !lod.far && lod.vFar === 0 && lod.near && lod.vNear === lod.n, JSON.stringify(lod));

const gone = await G(() => {
  const g = window.__gametool, m = g.morph, scene = g.world.scene;
  const a = m.assemble(m.randomCharacterSpec(21)), b = m.assemble(m.randomCharacterSpec(21));
  scene.add(a); scene.add(b);
  const before = m.partCache.stats;
  m.disposeCharacter(a);
  const after = m.partCache.stats;
  g.renderer.render(scene, g.camera);   // b still draws with the shared parts
  const ok = !a.parent && !!b.parent && m.baseBody().attributes.position.count > 0;
  m.disposeCharacter(b);
  return { ok, before, after };
});
check('Disposing a character frees only its own things', gone.ok && gone.before.parts === gone.after.parts && gone.before.materials === gone.after.materials, JSON.stringify(gone));

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
