// D4: Vite + TypeScript after M2. `npm run build` emits ONE self-contained dist/index.html
// (three.js, lore and placeholder images inlined) so it runs offline / without CDNs.
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execFileSync } from 'node:child_process';

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

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), loreWatch()],
  server: { host: true }, // also reachable from a phone on the same Wi-Fi for testing
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
});
