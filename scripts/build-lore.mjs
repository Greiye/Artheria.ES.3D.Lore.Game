#!/usr/bin/env node
// M2 / D5 / F4: `npm run lore` — parse content/lore/*.md frontmatter and write content/lore/index.json.
// Browsers cannot list folders, so this index is how the game finds entries.
// Files starting with "_" (the template) are skipped. Missing fields fail with the file name (F4.2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'content', 'lore');
const REQUIRED = ['title', 'contributor', 'created', 'tags'];

function parseFrontmatter(src, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Error(`${file}: missing frontmatter block (--- ... ---)`);
  const data = {};
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { data[listKey].push(unquote(item[1])); continue; }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`${file}: cannot parse frontmatter line "${raw}"`);
    const [, key, val] = kv;
    listKey = null;
    if (val === '') { data[key] = []; listKey = key; }
    else if (/^\[.*\]$/.test(val)) data[key] = val.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    else data[key] = unquote(val.trim());
  }
  return { data, body: m[2] };
}
const unquote = (s) => s.replace(/^(['"])(.*)\1$/, '$2');

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
const errors = [];
const warnings = [];
const entries = [];
for (const f of files) {
  try {
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    const missing = REQUIRED.filter((k) => data[k] === undefined || data[k] === '' || (k !== 'tags' && Array.isArray(data[k])));
    if (missing.length) throw new Error(`${f}: missing frontmatter field(s): ${missing.join(', ')}`);
    if (!/^\d{4}-\d{2}-\d{2}/.test(data.created)) throw new Error(`${f}: "created" must be an ISO date like 2026-10-16`);
    if (!Array.isArray(data.tags)) data.tags = [String(data.tags)];
    // §6.2 migration (v0.04 K20): missing credit_as / type default with a warning, not an error, until 0.12.
    if (!data.credit_as) warnings.push(`${f}: missing "credit_as" — using "${data.contributor}"; add the name you want shown on the book's first page.`);
    if (!data.type) warnings.push(`${f}: missing "type" — using "lore"; add \`type: lore\` to the frontmatter.`);
    entries.push({
      id: f.replace(/\.md$/, ''),
      title: String(data.title),
      contributor: String(data.contributor),
      // D9: the public credit line, shown exactly as written.
      credit_as: String(data.credit_as || data.contributor),
      type: String(data.type || 'lore'),
      created: String(data.created),
      tags: data.tags.map(String),
      body: body.trim(),
    });
  } catch (e) {
    errors.push(e.message);
  }
}
if (warnings.length) console.warn('Lore warnings:\n  ' + warnings.join('\n  '));
if (errors.length) {
  console.error('Lore index NOT written:\n  ' + errors.join('\n  '));
  process.exit(1);
}
entries.sort((a, b) => a.created.localeCompare(b.created) || a.title.localeCompare(b.title));
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ schemaVersion: 1, entries }, null, 2) + '\n');
console.log(`Lore index written: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} -> content/lore/index.json`);
