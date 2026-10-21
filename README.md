# Tales of Artheria (Video Gametool) — v0.02 (unreleased roadmap work in progress)

Private project, all rights reserved (§1). Not open source.

You start in a first-person 3D world, move with Skyrim PC controls, and read player-written lore in a book on a lectern. Version shown on the title screen; see `CHANGELOG.md` for what shipped in each step.

## Play it

- **Quickest:** open `dist/index.html` in Chrome, Edge or Firefox. Double-clicking works. The file is self-contained with no internet access needed.
- **Dev server:** `npm install`, then `npm run dev`.

## Put it online for friends (GitHub Pages)

Friends open a link on iPhone, Android or PC. Nothing to install.

1. Create a repo on github.com and upload this folder, without `node_modules/` or `dist/`. Uploading the files from this zip through **Add file → Upload files** works.
2. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   Browsers often skip hidden folders when you drag-and-drop. If `.github/workflows/deploy.yml` is missing from the repo, create it with **Add file → Create new file**: type that path as the name and paste the file's contents.
3. The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`. The link appears under **Settings → Pages** and on the **Actions** tab, usually `https://<you>.github.io/<repo>/`.

On GitHub Free the repo must be **public** for Pages. With GitHub Pro the repo can be private, but the site itself is always public to anyone who has the link.

### Updating — no npm needed

- **Edit lore:** open `content/lore/<entry>.md` on github.com (or in the GitHub phone app), click the pencil icon, edit, then **Commit changes**. The site updates in about 1–2 minutes. Check progress on the **Actions** tab.
- **Add lore:** open the `content/lore` folder, choose **Add file → Create new file**, paste the template and commit.
- **Add an image:** use **Add file → Upload files** in `content/assets/images/`.
- If a lore file has a mistake, the Action fails with a red ✗ that names the file. The live site keeps the last good version.

You only need Node on your PC to change code or preview before publishing (`npm run dev`, which rebuilds the book whenever you save a `.md`).

On phones, players can use **Share → Add to Home Screen** for a fullscreen, app-like icon.

## Add lore (F4)

**From inside the game (easiest):** title screen, pause menu, or press **L** while playing → **Write lore**.
Fill in a title, tags, and the entry, then either:
- **Publish to GitHub** — first time, open "GitHub publish settings" and fill in the repo owner, repo name, and
  a personal access token (github.com → Settings → Developer settings → Personal access tokens → Fine-grained,
  scoped to this one repo, permission "Contents: Read and write"). The token is saved only in your browser and
  commits straight to `content/lore/`, which triggers the same auto-deploy as any other commit.
- **Download .md** — no token needed. Saves the entry as a file; upload it to `content/lore/` on github.com
  (Add file → Upload files) and commit.

**By hand, for bigger edits:**
1. Copy `content/lore/_template.md` to `content/lore/<slug>.md`.
2. Fill in the frontmatter: `title`, `contributor`, `created` (YYYY-MM-DD) and `tags`.
3. Put images in `content/assets/images/` and reference them as `assets/images/<file>`.
4. Online: just commit; the GitHub Action rebuilds. Locally: `npm run dev` picks up saves automatically, and `npm run build` makes `dist/index.html`.

If a file is missing a frontmatter field, the script names the file and stops without writing the index.

## Settings (F1)

Open **Settings** from the title screen, or **Esc** during play, then expand **Graphics** / **Audio**.

- **Graphics:** Low/Medium/High preset (fills every slider below it), render scale 50–100%, shadows, outlines, fog distance, FPS cap (30 / 60 / uncapped). Each control also applies live on its own after picking a preset.
- **Audio:** independent 0–100 level + mute per bus — Master, Music, SFX, Dialogue. Muting a bus doesn't touch its level or any other bus (`src/audio.ts`).
- Everything above persists to `localStorage` and survives a reload; low-end/perf numbers are informational only (see `docs/assumptions.md` #30 — the sandboxed test container has no real GPU).

## Character (spec B4)

The first time anyone clicks "Click to begin," a short form asks for a character name and two optional
questions ("what do they want", "what's one true thing about this world only you know"). Skip it or fill it
in — either way it won't ask again on that browser. Revisit or change answers anytime from the pause menu's
**Character** button.

## Controls

| Key | Action |
|---|---|
| W A S D | Move (runs at 5 m/s by default) |
| Mouse | Look (drag with left button if pointer lock is blocked) |
| Shift (hold) | Walk, 2.5 m/s |
| Caps Lock | Toggle always-run |
| Alt (hold) | Sprint, 8 m/s |
| Space | Jump, about 1 m |
| C | Sneak / crouch toggle (eye height 1.1 m) |
| E | Read the book (within 2 m, aimed at it) |
| L | Write lore |
| A/D, ←/→, page-edge click | Turn pages |
| Tab / Esc / E | Close the book |
| F | First / third person |
| Esc | Pause menu: sensitivity, FOV, invert Y, always-run, character, write lore |

**Touch (phones / tablets):** left thumb = floating joystick (small push walks, full push runs), right thumb = drag to look. Buttons: Jump, Sneak, Sprint (hold), View (first/third person), Read (appears when you aim at the book), ☰ menu. In the book, swipe or tap a page edge; ✕ closes. Write lore and Character are in the ☰ pause menu (no touch/gamepad binding yet).

**Gamepad (Xbox / PlayStation / Switch Pro, Skyrim layout):**

| Button | Action |
|---|---|
| Left stick | Move (partial = walk, full = run) |
| Right stick | Look |
| A | Read / start / confirm |
| B | Close book |
| Y | Jump |
| LB (hold) | Sprint |
| L3 | Sneak toggle |
| R3 | Toggle always-run |
| LB / RB, D-pad, stick flick | Turn pages |
| Start | Pause / resume |

Press any button once so the browser detects the controller. iPhone and Android pair Bluetooth controllers in system settings.

To remap a key, edit one line in `src/controls.ts` (F2.2).

## Layout

```
content/lore/*.md        lore, one file per entry (source of truth, L1)
content/lore/index.json  generated by `npm run lore`; never hand-edit
content/assets/images/   images used by lore (placeholder SVGs for now)
src/palette.ts            A4 colour tokens + A5 swatch texture
src/controls.ts           F2.2 bindings and speeds
src/world.ts              M0 start area, outlines, placeholders, colliders
src/player.ts             M1 first-person movement + collision
src/book.ts, markdown.ts  M4 book UI, pagination, Markdown
src/editor.ts             in-browser lore editor, GitHub Contents API publish
src/character.ts          one-time character-creation answers
src/settings.ts           F1 settings schema, presets, load/save (schemaVersion)
src/audio.ts              A7 WebAudio synth: 4-bus mixer, wind/footstep/page-turn/etc.
src/version.ts            VERSION string shown on the title screen
src/main.ts               title, pause menu, input routing, frame loop
docs/assumptions.md       decisions the spec left open
CHANGELOG.md              what shipped in each version step (§0 rule 3)
test/e2e.mjs              automated Done-when checks (headless Chromium)
```

## Build log (§0 rule 7)

| Task | Files | Verified by |
|---|---|---|
| M0 | `index.html`, `src/world.ts`, `src/palette.ts` | Screenshot `test/screenshots/02-spawn-view.png`: palette colours, outlines, book visible from spawn (F1.2) |
| M1 | `src/main.ts`, `src/player.ts`, `src/controls.ts` | e2e: every F2 binding, speeds, jump apex, pitch clamp, rock / wall / edge collision |
| M2 | `scripts/build-lore.mjs`, `content/lore/*` | Adding a 4th file (the 3,000-word fixture) appears after `npm run lore` |
| M3 | `vite.config.ts`, `tsconfig.json`, lectern / book / prompt | e2e F3.1: prompt follows distance and aim |
| M4 | `src/book.ts`, `src/markdown.ts`, `src/style.css` | e2e F3.2–F3.7, including the 3,000-word entry at 3 window sizes: no clipping, every word in order |
| M5 | Pause menu, fixed-step simulation | e2e: settings and last page survive reload. 41 draw calls, ~35k triangles |
| Mobile + gamepad | `src/input/*`, `src/book.ts`, `src/style.css`, `public/`, `.github/workflows/deploy.yml` | `test/e2e-mobile.mjs`: joystick walk/run, multi-touch, buttons, swipe, portrait and landscape book, mocked gamepad for every binding |
| In-browser lore editor + character creation | `src/editor.ts`, `src/character.ts`, `src/main.ts`, `src/style.css` | `test/e2e-features.mjs`: character form gates first spawn and persists; editor publish (mocked GitHub API), validation, download fallback, L-key and HUD access |
| v0.02 — F1 Settings, A7 Audio, version label (spec §8) | `src/settings.ts`, `src/audio.ts`, `src/version.ts`, `src/world.ts`, `src/main.ts`, `src/style.css`; `content/` renamed from `campaign/` (D7); `sunset`/`dusk` palette tokens added (A5) | `test/e2e-v0.02.mjs`: presets/sliders apply live and persist, bus mute isolation, version label, Low vs. High relative frame cost (informational, #30), no audio-engine errors during play |
| v0.03 — F2 world/camera, §5, §6.3 prompts | `index.html`, `src/world.ts`, `src/player.ts`, `src/prompts.ts`, `src/main.ts`, `src/controls.ts`, `src/input/touch.ts`, `content/rolltables/creation-prompts.json` | `test/e2e-v0.03.mjs`: fade-in, daily prompt, sun < 15°, 3.4 m door visible from spawn and locked, F toggles POV while moving, camera wall collision |

Run the checks with:

```
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:e2e   # desktop + touch + gamepad + editor/character
```

To include the 3,000-word check:

1. Copy `test/fixtures/long-entry.md` into `content/lore/`.
2. Run `npm run build`.
3. Run `LONG_ENTRY=test/fixtures/long-entry.md npm run test:e2e`.
4. Remove the fixture from `content/lore/` and rebuild.
