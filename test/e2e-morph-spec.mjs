// B57 morphology, PR 1 (Mike 2026-11-06, option 1): the character spec. Defaults, validation (clamped, replaced, and
// what was wrong), the seeded random spec, and the catalog (every slot, placeholder ids).
// Usage: node test/e2e-morph-spec.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool?.morph, null, { timeout: 180000 });
const G = (fn, a) => page.evaluate(fn, a);

const cat = await G(() => { const m = window.__gametool.morph; return { slots: m.SLOTS, morphs: m.MORPHS, counts: Object.fromEntries(m.SLOTS.map((s) => [s, m.CATALOG[s].ids.length])) }; });
check('Catalog: all 11 slots, each with placeholder ids', cat.slots.length === 11 && Object.values(cat.counts).every((n) => n >= 4), JSON.stringify(cat.counts));
check('Morphs: height, build, limb length, head size, face shape', cat.morphs.join() === 'height,build,limbLength,headSize,faceShape');

const d = await G(() => { const m = window.__gametool.morph, s = m.defaultSpec(); return { s, v: m.validateSpec(s) }; });
check('The default spec is valid and average', d.v.problems.length === 0 && Object.values(d.s.morphs).every((n) => n === 0.5), JSON.stringify(d.v.problems));

const r = await G(() => { const m = window.__gametool.morph; return { a: JSON.stringify(m.randomCharacterSpec(42)), b: JSON.stringify(m.randomCharacterSpec(42)), c: JSON.stringify(m.randomCharacterSpec(43)) }; });
check('Random spec: the same seed gives the same character', r.a === r.b);
check('Random spec: another seed gives another', r.a !== r.c);

const many = await G(() => {
  const m = window.__gametool.morph, keys = new Set();
  let bad = 0, outOfRange = 0, bald = 0, hats = 0;
  for (let i = 1; i <= 300; i++) {
    const s = m.randomCharacterSpec(i * 7919);
    if (m.validateSpec(JSON.parse(JSON.stringify(s))).problems.length) bad++;
    if (Object.values(s.morphs).some((n) => n < 0 || n > 1)) outOfRange++;
    if (s.parts.hair.id === '') bald++;
    if (s.parts.hat.id) hats++;
    keys.add(m.specKey(s));
  }
  return { bad, outOfRange, bald, hats, distinct: keys.size };
});
check('300 random specs: all valid after a JSON round trip, morphs in 0..1', many.bad === 0 && many.outOfRange === 0, JSON.stringify(many));
check('300 random specs: all different, some bald, some in hats', many.distinct === 300 && many.bald > 0 && many.bald < 60 && many.hats > 40 && many.hats < 200, JSON.stringify(many));

const junk = await G(() => {
  const m = window.__gametool.morph;
  const out = (x) => m.validateSpec(x);
  const a = out(null), b = out('hello'), c = out({ v: 1, morphs: { height: 3, build: -1, limbLength: 'x' }, skin: 'red', parts: { hair: { id: '99', color: '#123456' }, beard: { id: '', color: '#ABCDEF' }, top: { id: '', color: '#000000' }, wings: { id: '01', color: '#FFFFFF' } } });
  return { a: a.problems, aOk: m.validateSpec(a.spec).problems.length, b: b.problems, c: c.problems, cs: c.spec, cOk: m.validateSpec(c.spec).problems.length };
});
check('Junk becomes the default spec, and says why', junk.a.includes('not an object') && junk.b.includes('not an object') && junk.aOk === 0, JSON.stringify(junk.a));
check('Bad fields are clamped or replaced, good ones kept', junk.cs.morphs.height === 1 && junk.cs.morphs.build === 0 && junk.cs.morphs.limbLength === 0.5
  && junk.cs.parts.hair.id === '01' && junk.cs.parts.hair.color === '#123456' && junk.cs.parts.beard.id === '' && junk.cs.parts.beard.color === '#ABCDEF'
  && junk.cs.parts.top.id === '01' && junk.cOk === 0, JSON.stringify({ morphs: junk.cs.morphs, hair: junk.cs.parts.hair, top: junk.cs.parts.top }));
check('Problems name what was wrong', ['morph height 3 clamped', 'morph build -1 clamped', 'skin colour', 'hair id "99"', 'top id ""', 'unknown slot wings'].every((p) => junk.c.includes(p)), JSON.stringify(junk.c));

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
