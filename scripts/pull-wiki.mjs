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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-'));
try {
  execFileSync('git', ['clone', '--depth', '1', '--quiet', URL, tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 45000 });
  const pages = fs.readdirSync(tmp).filter((f) => /\.md$/i.test(f) && !/^(_|dm)/i.test(f));
  const keep = pages.filter((f) => !/<!--\s*private\s*-->/i.test(fs.readFileSync(path.join(tmp, f), 'utf8')));
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.md')) fs.rmSync(path.join(OUT, f));
  for (const f of keep) fs.copyFileSync(path.join(tmp, f), path.join(OUT, f));
  console.log(`wiki: ${keep.length} page(s) pulled${pages.length > keep.length ? `, ${pages.length - keep.length} private left out` : ''}`);
} catch (e) {
  console.log(`wiki: could not pull (${String(e.message ?? e).split('\n')[0]}); keeping the snapshot in ${OUT}/`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
