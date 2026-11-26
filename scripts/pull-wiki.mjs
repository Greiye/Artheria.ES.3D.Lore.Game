// B21 (Mike 2026-10-31): pull the GitHub wiki (a git repo of markdown pages) into content/wiki/ at build time, so
// the game ships the wiki inside dist/ and reads it offline. The pulled pages are committed as a snapshot: with no
// network (or no wiki yet) the build keeps the last snapshot and says so. The deploy workflow also runs on wiki
// edits (the "gollum" event), so changing a wiki page republishes the game.
// Rule (backlog B21): only public lore (Parts I–II) belongs on the wiki. A page that contains <!-- private --> or
// whose name starts with "DM" or "_" (sidebar, footer) is never pulled.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = process.env.WIKI_URL || 'https://github.com/Greiye/Artheria.ES.3D.Lore.Game.wiki.git';
const OUT = 'content/wiki';
const IMG_OUT = `${OUT}/images`;
const IMG_EXT = /\.(webp|png|jpe?g|gif)$/i;
// Only pictures hosted under the project's own GitHub account are fetched (e.g. the lore repo's raw files).
const IMG_HOST = /^https:\/\/(raw\.githubusercontent\.com\/Greiye\/|github\.com\/Greiye\/[^/]+\/raw\/)/;
const IMG_MAX = 15 * 1024 * 1024;

// Images the pages embed are saved into content/wiki/images/ (committed with the snapshot, shipped as
// dist/wiki-images/). A failed download keeps the last copy; images no page uses any more are removed.
async function pullImages(mds) {
  fs.mkdirSync(IMG_OUT, { recursive: true });
  const want = new Map();
  for (const md of mds) for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const src = m[1];
    const file = decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() ?? '');
    if (!IMG_EXT.test(file) || file.includes('..')) continue;
    if (IMG_HOST.test(src)) want.set(file, src);
    else if (!/^[a-z]+:/i.test(src) && fs.existsSync(path.join(tmp, src))) want.set(file, path.join(tmp, src));
  }
  let got = 0, kept = 0;
  for (const [file, src] of want) {
    const dest = path.join(IMG_OUT, file);
    try {
      if (!/^https:/.test(src)) { fs.copyFileSync(src, dest); got++; continue; }
      const res = await fetch(src, { signal: AbortSignal.timeout(30000) });
      const type = res.headers.get('content-type') ?? '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok || !/^image\//.test(type) || buf.length > IMG_MAX) throw new Error(`${res.status} ${type} ${buf.length} bytes`);
      fs.writeFileSync(dest, buf); got++;
    } catch (e) {
      if (fs.existsSync(dest)) kept++;
      console.log(`wiki: image ${file} not fetched (${String(e.message ?? e).split('\n')[0]})${fs.existsSync(dest) ? '; keeping the last copy' : ''}`);
    }
  }
  let gone = 0;
  for (const f of fs.readdirSync(IMG_OUT)) if (!want.has(f)) { fs.rmSync(path.join(IMG_OUT, f)); gone++; }
  console.log(`wiki: ${got} image(s) saved${kept ? `, ${kept} kept from the last pull` : ''}${gone ? `, ${gone} unused removed` : ''}`);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-'));
try {
  execFileSync('git', ['clone', '--depth', '1', '--quiet', URL, tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 45000 });
  const pages = fs.readdirSync(tmp).filter((f) => /\.md$/i.test(f) && !/^(_|dm)/i.test(f));
  const keep = pages.filter((f) => !/<!--\s*private\s*-->/i.test(fs.readFileSync(path.join(tmp, f), 'utf8')));
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.md')) fs.rmSync(path.join(OUT, f));  // pages only; images/ is handled below
  for (const f of keep) fs.copyFileSync(path.join(tmp, f), path.join(OUT, f));
  console.log(`wiki: ${keep.length} page(s) pulled${pages.length > keep.length ? `, ${pages.length - keep.length} private left out` : ''}`);
  await pullImages(keep.map((f) => fs.readFileSync(path.join(OUT, f), 'utf8')));
} catch (e) {
  console.log(`wiki: could not pull (${String(e.message ?? e).split('\n')[0]}); keeping the snapshot in ${OUT}/`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
