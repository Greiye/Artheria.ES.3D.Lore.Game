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
check('A page renders from the baked-in markdown', home.h === 'Home' && home.body.includes(src.split('\n')[0].trim().replace(/[*_#]/g, '')), JSON.stringify(home).slice(0, 200));
check('Web links in a page open in a new tab', home.out.every((a) => !/^https?:/.test(a.href) || a.target === '_blank'), JSON.stringify(home.out));
check('Reading the wiki makes no network request (it is inside the build)', requests.filter((u) => /github|wiki/i.test(u)).length === 0, requests.join(' '));
await page.screenshot({ path: path.join(shots, 'b21-wiki-menu.png') });
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
