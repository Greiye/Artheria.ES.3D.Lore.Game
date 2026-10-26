#!/usr/bin/env node
// §6.2 / F5.2 / H6: `npm run lore` — read every contribution and write content/lore/index.json, the one
// index the game loads (browsers cannot list folders). One loader for all §6.1 types:
//   content/lore/*.md       type: lore (red books)
//   content/artifacts/*.md  type: character | song | food | art
// Files starting with "_" are skipped. Errors are plain language, one line each: the file, the field, the fix.
// Any error → nothing is written and the exit code is non-zero, so the live site keeps its last good build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// LORE_ROOT lets the validation test run against a scratch copy of content/.
const root = process.env.LORE_ROOT ? path.resolve(process.env.LORE_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LORE = path.join(root, 'content', 'lore');
const ARTIFACTS = path.join(root, 'content', 'artifacts');
const SHELVES = path.join(root, 'content', 'shelves.json');
const TYPES = ['lore', 'character', 'song', 'food', 'art'];
const TIERS = ['fragment', 'note', 'work'];
// §6.2: what to tell a contributor when a required field is missing.
const FIX = {
  title: 'add the title you want on the spine, like  title: "My Title"',
  contributor: 'add your name or nickname, like  contributor: "your-name"',
  credit_as: "add the name you want shown on the book's first page, like  credit_as: \"Your Name\"",
  created: 'add the date you wrote it, like  created: 2026-10-21',
  type: 'add what kind of work it is, like  type: lore  (or character, song, food, art)',
};

class Plain extends Error {}
const unquote = (s) => s.replace(/^(['"])(.*)\1$/, '$2');

function parseFrontmatter(src, file) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Plain(`${file}: the top block is missing — start the file with a line "---", the fields, then another "---" (copy a template from content/templates/).`);
  const data = {};
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { data[listKey].push(unquote(item[1].trim())); continue; }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) throw new Plain(`${file}: this line in the top block can't be read: "${raw.trim()}" — write it as  name: value`);
    const [, key, val] = kv;
    listKey = null;
    if (val === '') { data[key] = []; listKey = key; }
    else if (/^\[.*\]$/.test(val)) data[key] = val.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    else data[key] = unquote(val.trim());
  }
  return { data, body: m[2] };
}

const wordCount = (s) => (s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
const derivedTier = (n) => (n < 200 ? 'fragment' : n <= 800 ? 'note' : 'work');

function read(dir, file, warnings) {
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'), file);
  const blank = (k) => data[k] === undefined || data[k] === '' || Array.isArray(data[k]);
  // §6.2 migration (v0.04 K20): a file with neither credit_as nor type is an old one: default both, warn.
  const legacy = blank('credit_as') && blank('type');
  for (const k of ['title', 'contributor', 'credit_as', 'created', 'type']) {
    if (!blank(k)) continue;
    if (legacy && (k === 'credit_as' || k === 'type')) continue;
    throw new Plain(`${file}: missing "${k}" — ${FIX[k]}.`);
  }
  if (legacy) warnings.push(`${file}: no "credit_as" or "type" yet — showing "${data.contributor}" and treating it as lore. Add both before v0.12.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.created))) throw new Plain(`${file}: "created" should be a date like 2026-10-21 (year-month-day), not "${data.created}".`);
  const type = String(data.type || 'lore');
  if (!TYPES.includes(type)) throw new Plain(`${file}: "type: ${type}" isn't a kind the library knows — use one of: ${TYPES.join(', ')}.`);
  const inLore = dir === LORE;
  if (inLore && type !== 'lore') throw new Plain(`${file}: it says "type: ${type}" but it's in content/lore — move it to content/artifacts, or change it to  type: lore.`);
  if (!inLore && type === 'lore') throw new Plain(`${file}: it says "type: lore" but it's in content/artifacts — move it to content/lore.`);
  // §6.2 / C5: tier from word count; a contributor may set it lower, never higher.
  const words = wordCount(body);
  const derived = derivedTier(words);
  let tier = derived;
  if (data.tier !== undefined && data.tier !== '') {
    if (!TIERS.includes(data.tier)) throw new Plain(`${file}: "tier: ${data.tier}" — use fragment, note or work (or leave it out).`);
    if (TIERS.indexOf(data.tier) > TIERS.indexOf(derived)) warnings.push(`${file}: "tier: ${data.tier}" is higher than its length allows (${words} words) — showing it as "${derived}".`);
    else tier = data.tier;
  }
  const list = (v) => (v === undefined || v === '' ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
  const id = file.replace(/\.md$/, '');
  // §6.4: links are the frontmatter list plus every [[slug]] in the body.
  const inline = [...body.matchAll(/\[\[([a-z0-9][a-z0-9-]*)\]\]/gi)].map((m) => m[1].toLowerCase());
  return {
    id, type, tier, words,
    title: String(data.title),
    contributor: String(data.contributor),
    credit_as: String(data.credit_as || data.contributor),   // D9: shown exactly as written
    created: String(data.created),
    tags: list(data.tags),
    replyTo: list(data.links),                                 // §6.4 reply book
    links_out: [...new Set([...list(data.links), ...inline])],
    dedications: list(data.dedications),                       // F10.3 (0.07)
    color: data.color ? String(data.color) : undefined,        // §6.1 character capsule colour
    look: data.look ? String(data.look) : undefined,           // B4: forged look (key=value; ...), drawn in the library
    body: body.trim(),
  };
}

const errors = [];
const warnings = [];
const entries = [];
for (const [dir, label] of [[LORE, 'content/lore'], [ARTIFACTS, 'content/artifacts']]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md') && !x.startsWith('_')).sort()) {
    try { entries.push(read(dir, f, warnings)); }
    catch (e) { errors.push(e instanceof Plain ? e.message : `${label}/${f}: couldn't be read (${e.message}) — check it's a plain text .md file.`); }
  }
}
const byId = new Map();
for (const e of entries) {
  if (byId.has(e.id)) errors.push(`${e.id}.md: two files share the name "${e.id}" (one in lore, one in artifacts) — rename one.`);
  byId.set(e.id, e);
}
// §6.4: links_in, and plain warnings for links to books that don't exist (they render as "missing page").
for (const e of entries) e.links_in = [];
for (const e of entries) for (const to of e.links_out) {
  const t = byId.get(to);
  if (t) t.links_in.push(e.id);
  else warnings.push(`${e.id}.md: links to "${to}", which isn't in the library yet — it will show as a missing page.`);
}

// F5.2: shelves.json — every slug must resolve. Books not listed are shelved automatically (so a new
// contributor never has to edit shelves.json to find their book, §8 0.06 creativity check).
let shelves = [];
if (fs.existsSync(SHELVES)) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(SHELVES, 'utf8')); }
  catch (e) { errors.push(`shelves.json: isn't valid JSON (${e.message}) — check for a missing comma or quote.`); raw = { shelves: [] }; }
  shelves = (raw.shelves ?? []).map((s, i) => ({ id: s.id ?? `shelf-${i + 1}`, label: s.label ?? '', red: [...(s.red ?? [])], grey: Number(s.grey ?? 12) }));
  for (const s of shelves) for (const slug of s.red) {
    const e = byId.get(slug);
    if (!e) errors.push(`shelves.json: shelf "${s.id}" lists "${slug}", but there's no content/lore/${slug}.md — fix the name or remove it.`);
    else if (e.type !== 'lore') errors.push(`shelves.json: "${slug}" is a ${e.type}, not a book — only lore goes on shelves (artifacts get their own spot).`);
  }
}
const SHELF_COUNT = 12, PER_SHELF = 8;
while (shelves.length < SHELF_COUNT) shelves.push({ id: `shelf-${shelves.length + 1}`, label: '', red: [], grey: 12 });
const placed = new Set(shelves.flatMap((s) => s.red));
for (const e of entries.filter((x) => x.type === 'lore' && !placed.has(x.id))) {
  const s = shelves.find((x) => x.red.length < PER_SHELF) ?? shelves[shelves.length - 1];
  s.red.push(e.id); s.auto = true;
}

if (warnings.length) console.warn('Notes (not errors):\n  ' + warnings.join('\n  '));
if (errors.length) {
  console.error('The library was NOT updated. Fix these and run `npm run lore` again:\n  ' + errors.join('\n  '));
  process.exit(1);
}
entries.sort((a, b) => a.created.localeCompare(b.created) || a.title.localeCompare(b.title));
fs.writeFileSync(path.join(LORE, 'index.json'), JSON.stringify({ schemaVersion: 2, entries, shelves }, null, 2) + '\n');
const n = (k) => entries.filter((e) => (k === 'lore' ? e.type === 'lore' : e.type !== 'lore')).length;
console.log(`Library index written: ${n('lore')} book(s), ${n('art')} artifact(s), ${shelves.length} shelves -> content/lore/index.json`);
