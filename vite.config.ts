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

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), loreWatch(), buildStamp()],
  server: { host: true }, // also reachable from a phone on the same Wi-Fi for testing
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
  // .glb slots that actually exist in public/models (so the game never requests a missing file).
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __MODEL_IDS__: JSON.stringify(fs.existsSync('public/models') ? fs.readdirSync('public/models').filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)) : []),
  },
});
