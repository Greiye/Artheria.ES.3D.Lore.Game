// B21 (Mike 2026-10-31): the GitHub wiki, pulled at build time (scripts/pull-wiki.mjs → content/wiki/) and baked
// into the page; read at the reading room lectern in the Ruined Library or from Extras → Wiki. No network needed.
// Usage: node test/e2e-wiki.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

const pages = fs.readdirSync('content/wiki').filter((f) => f.endsWith('.md'));
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => { requests.push(r.request().url()); r.abort(); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);

// From the main menu: Extras → Wiki.
await page.click('#openExtras');
await page.click('#wikiBtn');
const idx = await G(page, () => ({ open: window.__gametool.wiki.isOpen, items: [...document.querySelectorAll('#wiki .wk-index [data-page]')].map((b) => b.dataset.page), src: document.querySelector('#wiki .wk-src a')?.href }));
check('Extras → Wiki lists every pulled page, Home first, and names the GitHub wiki as the source', idx.open && idx.items.length === pages.length && idx.items[0] === 'Home' && /github\.com\/Greiye\/Artheria\.ES\.3D\.Lore\.Game\/wiki/.test(idx.src ?? ''), JSON.stringify(idx));
await page.click('#wiki [data-page="Home"]');
const home = await G(page, () => ({ h: document.querySelector('#wiki h1').textContent, body: document.querySelector('#wiki .wk-body').textContent, out: [...document.querySelectorAll('#wiki .wk-body a')].map((a) => ({ href: a.href, target: a.target })) }));
const src = fs.readFileSync('content/wiki/Home.md', 'utf8');
check('A page renders from the baked-in markdown', home.h === 'Home' && home.body.includes(src.split('\n')[0].replace(/[*_#]/g, '').trim()), JSON.stringify(home).slice(0, 200));
check('Web links in a page open in a new tab', home.out.every((a) => !/^https?:/.test(a.href) || a.target === '_blank'), JSON.stringify(home.out));
await page.screenshot({ path: path.join(shots, 'b21-wiki-menu.png') });

// Images: a page that embeds pictures shows the copies shipped beside the build (dist/wiki-images/), not GitHub's.
const imgFiles = fs.existsSync('content/wiki/images') ? fs.readdirSync('content/wiki/images') : [];
const withImg = pages.find((f) => imgFiles.some((i) => fs.readFileSync(`content/wiki/${f}`, 'utf8').includes(i)));
if (withImg) {
  await page.click('#wkIndex');
  await page.click(`#wiki [data-page="${withImg.slice(0, -3)}"]`);
  await page.waitForFunction(() => [...document.querySelectorAll('#wiki .wk-body img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
  const im = await G(page, () => ({ imgs: [...document.querySelectorAll('#wiki .wk-body img')].map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth, shown: i.getBoundingClientRect().width })), missing: document.querySelectorAll('#wiki .wk-body .missing-img').length }));
  check(`Wiki images show from the build (${withImg})`, im.imgs.length > 0 && im.missing === 0 && im.imgs.every((i) => /^wiki-images\//.test(i.src) && i.w > 0 && i.shown > 0), JSON.stringify(im).slice(0, 300));
  await page.screenshot({ path: path.join(shots, 'b21-wiki-images.png') });
} else check('Wiki images show from the build (no page embeds one yet)', true);
check('Reading the wiki makes no network request (it is inside the build)', requests.filter((u) => /github|wiki/i.test(u)).length === 0, requests.join(' '));
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Esc goes back out of the wiki to Extras', await G(page, () => !window.__gametool.wiki.isOpen && window.__gametool.extras.isOpen));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// In the world: the reading room lectern in the Ruined Library.
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.waitForTimeout(300);
const lec = await G(page, () => { const i = window.__gametool.interactables.find((x) => x.obj.name === 'wiki-lectern'); const p = new window.__gametool.Vector3(); i?.obj.getWorldPosition(p); return i ? { verb: i.verb(), x: p.x, z: p.z } : null; });
check('A lectern inside the Ruined Library reads "Read the wiki"', !!lec && lec.verb === 'Read the wiki' && lec.z < -18.4 && lec.z > -41.6 && Math.abs(lec.x) < 12, JSON.stringify(lec));
await G(page, () => window.__gametool.openWiki());
await page.waitForTimeout(200);
check('Using it opens the wiki as the reading room', await G(page, () => window.__gametool.state === 'forge' && window.__gametool.wiki.isOpen && /Reading room/.test(document.querySelector('#wiki .eyebrow').textContent)));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc closes it and play resumes', await G(page, () => !window.__gametool.wiki.isOpen && window.__gametool.state !== 'forge'));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
