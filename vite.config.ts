// D4: Vite + TypeScript after M2. `npm run build` emits ONE self-contained dist/index.html
// (three.js, lore and placeholder images inlined) so it runs offline / without CDNs.
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Dev only: re-run `npm run lore` whenever a lore file changes, so saving a .md updates the book.
function loreWatch(): Plugin {
  const run = () => {
    try { execFileSync(process.execPath, ['scripts/build-lore.mjs'], { stdio: 'inherit' }); }
    catch { /* the script already printed which file is wrong; keep serving the last good index */ }
  };
  return {
    name: 'lore-watch',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add('content/lore');
      const onFile = (f: string) => { if (/content[\\/]lore[\\/][^\\/]+\.md$/.test(f)) run(); };
      server.watcher.on('change', onFile);
      server.watcher.on('add', onFile);
      server.watcher.on('unlink', onFile);
    },
  };
}

// Installed-app freshness: every build gets an id, baked into the page and written to dist/build.json.
// The running game polls build.json (no-cache) and offers a reload when the live site is newer.
const BUILD_ID = process.env.GITHUB_SHA?.slice(0, 12) || String(Date.now());
function buildStamp(): Plugin {
  return {
    name: 'build-stamp',
    apply: 'build',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ build: BUILD_ID }) }); },
  };
}

// v0.04 cinema: short clips by Mike and friends live in assets/cinema/ (name.webm preferred, name.gif fallback,
// optional clips.json for titles and credits). They are too big to inline, so they ship as separate files under
// dist/cinema/ (served from assets/cinema/ in dev), and the list of clips is baked into the page.
const CINEMA_DIR = 'assets/cinema';
const CINEMA_EXT = /\.(webm|mp4|gif)$/i;
function cinemaClips() {
  if (!fs.existsSync(CINEMA_DIR)) return [];
  const files = fs.readdirSync(CINEMA_DIR).filter((f) => CINEMA_EXT.test(f));
  let meta: Record<string, { title?: string; credit?: string; sound?: boolean }> = {};
  try { meta = JSON.parse(fs.readFileSync(`${CINEMA_DIR}/clips.json`, 'utf8')); } catch { /* optional */ }
  const ids = [...new Set(files.map((f) => f.replace(CINEMA_EXT, '')))].sort();
  return ids.map((id) => {
    const has = (ext: string) => files.find((f) => f.toLowerCase() === `${id}.${ext}`.toLowerCase());
    const src = (ext: string) => (has(ext) ? `cinema/${has(ext)}` : undefined);
    return { id, title: meta[id]?.title ?? id.replace(/[-_]+/g, ' '), credit: meta[id]?.credit ?? '', sound: meta[id]?.sound ?? true, webm: src('webm'), mp4: src('mp4'), gif: src('gif') };
  });
}
function cinema(): Plugin {
  return {
    name: 'cinema',
    generateBundle() {
      if (!fs.existsSync(CINEMA_DIR)) return;
      for (const f of fs.readdirSync(CINEMA_DIR).filter((f) => CINEMA_EXT.test(f))) this.emitFile({ type: 'asset', fileName: `cinema/${f}`, source: fs.readFileSync(`${CINEMA_DIR}/${f}`) });
    },
    configureServer(server) {
      server.middlewares.use('/cinema', (req, res, next) => {
        const f = `${CINEMA_DIR}/${decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')}`;
        if (!CINEMA_EXT.test(f) || f.includes('..') || !fs.existsSync(f)) return next();
        res.setHeader('Content-Type', f.endsWith('.gif') ? 'image/gif' : f.endsWith('.mp4') ? 'video/mp4' : 'video/webm');
        fs.createReadStream(f).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), loreWatch(), buildStamp(), cinema()],
  server: { host: true }, // also reachable from a phone on the same Wi-Fi for testing
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
  // .glb slots that actually exist in public/models (so the game never requests a missing file).
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __CINEMA__: JSON.stringify(cinemaClips()),
    __MODEL_IDS__: JSON.stringify(fs.existsSync('public/models') ? fs.readdirSync('public/models').filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)) : []),
  },
});
