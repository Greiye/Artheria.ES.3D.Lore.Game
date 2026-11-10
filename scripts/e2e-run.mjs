// Runs the e2e suites listed in test/suites.json against dist/index.html, one after another, and prints a summary.
// Usage: node scripts/e2e-run.mjs [--shard i/n] [--only name,name]
//   --shard 2/4   runs every 4th suite starting with the 2nd (CI splits the ~45-minute set across parallel jobs)
//   --only a,b    runs just those suites (file names without test/ and .mjs; the e2e- prefix is optional)
// E2E_SLOW=<factor> stretches every wait and timeout in the suites (for slow CI machines; see test/slow.mjs).
// Exit code 1 if any suite fails or times out. Each suite gets SUITE_TIMEOUT_MS (default 15 min).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const all = JSON.parse(fs.readFileSync('test/suites.json', 'utf8')).suites;
let suites = all;
const only = opt('--only');
if (only) suites = only.split(',').map((s) => s.trim()).map((n) => (all.includes(n) || n.startsWith('e2e') ? n : `e2e-${n}`));
const shard = opt('--shard');
if (shard) { const [i, n] = shard.split('/').map(Number); suites = suites.filter((_, k) => k % n === i - 1); }
const page = opt('--page') ?? 'dist/index.html';
const LIMIT = Number(process.env.SUITE_TIMEOUT_MS ?? 15 * 60 * 1000);

const results = [];
for (const name of suites) {
  const file = `test/${name}.mjs`;
  if (!fs.existsSync(file)) { results.push({ name, ok: false, line: 'missing file' }); console.log(`\n== ${name}: MISSING`); continue; }
  console.log(`\n== ${name}`);
  const t0 = Date.now();
  const out = await new Promise((resolve) => {
    // E2E_SLOW=2.5 stretches the suites' waits and timeouts for a slow machine (test/slow.mjs).
    const p = spawn(process.execPath, [...(process.env.E2E_SLOW ? ['--import', './test/slow.mjs'] : []), file, page], { stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const keep = (d) => { process.stdout.write(d); text += d; };
    p.stdout.on('data', keep); p.stderr.on('data', keep);
    const kill = setTimeout(() => { text += '\n[timed out]'; p.kill('SIGKILL'); }, LIMIT);
    p.on('close', (code) => { clearTimeout(kill); resolve({ code, text }); });
  });
  const line = /(\d+\/\d+ checks passed)/.exec(out.text)?.[1] ?? (out.text.includes('[timed out]') ? 'timed out' : 'no summary');
  // What failed, for the summary: the FAIL lines, or the last error lines when the suite died before its own summary.
  const plain = out.text.replace(/\x1b\[[0-9;]*m/g, '');
  let why = plain.split('\n').filter((l) => /^FAIL\b/.test(l)).map((l) => l.slice(0, 400));
  if (out.code !== 0 && !why.length) why = plain.split('\n').filter((l) => /Error|Timeout|timed out|at .*test\//.test(l)).slice(-4).map((l) => l.trim().slice(0, 300));
  results.push({ name, ok: out.code === 0, line, why, s: ((Date.now() - t0) / 1000).toFixed(0) });
}
console.log('\n== Summary');
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}  ${r.line}${r.s ? `  (${r.s} s)` : ''}`);
const bad = results.filter((r) => !r.ok);
if (bad.length) { console.log('\n== Failures'); for (const r of bad) { console.log(r.name); for (const w of r.why ?? []) console.log('    ' + w); } }
console.log(`${results.length - bad.length}/${results.length} suites passed`);
process.exit(bad.length ? 1 : 0);
