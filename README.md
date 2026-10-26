# Tales of Artheria (Video Gametool) — v0.02 (unreleased roadmap work in progress)

Private project, all rights reserved (§1). Not open source.

You start in a third-person 3D world (F for first person), move with Skyrim PC controls, and read player-written lore in a book on a lectern. Version shown on the title screen; see `CHANGELOG.md` for what shipped in each step.

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
1. Copy a template from `content/templates/`: `lore.md` (a red book) goes in `content/lore/<slug>.md`;
   `character.md`, `song.md`, `food.md` and `art.md` go in `content/artifacts/<slug>.md`.
2. Fill in the frontmatter. Required: `title`, `contributor`, `credit_as` (the name shown on your work, exactly
   as written), `created` (YYYY-MM-DD) and `type`. Everything else is optional; `tier` is worked out from length.
3. Link to another book with `[[its-slug]]` in the text, or reply to one with `links: [its-slug]`.
4. Put images in `content/assets/images/` and reference them as `assets/images/<file>`.
5. Online: just commit; the GitHub Action rebuilds. Locally: `npm run dev` picks up saves automatically, and `npm run build` makes `dist/index.html`.

New books are shelved automatically. To put one on a particular shelf, add its slug to that shelf's `red` list in
`content/shelves.json`.

If a file has a problem, `npm run lore` prints one plain line naming the file, the field and the fix, and stops
without writing the index.

## Add a 3D model (.glb)

1. Export a `.glb` (Blender: File → Export → glTF 2.0, format *glTF Binary*). Feet at the origin, facing +Z.
2. Name it after the slot it replaces and upload it to `public/models/` on github.com (Add file → Upload files):

| File | Replaces |
|---|---|
| `natalie.glb` | Natalie's standee by the library door |
| `stagecoach.glb` | The Stagecoach standee |
| `hero.glb` | The Hero standee |
| `player.glb` | Your own body in third person (F) |

3. Commit. The site rebuilds; the model is scaled to the slot's height automatically. If the file is missing or broken,
   the placeholder stays and nothing breaks.

**Keep it phone-friendly:** under 1 MB per file, under ~3,000 triangles for a character, one texture of 512 px
(1024 at most). Compress with Meshopt or Draco (e.g. `npx gltf-transform optimize in.glb out.glb --compress meshopt`).
Style target: Mega Man Legends-like chunky low-poly parts with hand-painted textures (light painted in; textured models
render unlit). Models load on the live site (and `npm run dev` after a restart); a double-clicked local `dist/index.html` shows placeholders instead.

### Animation clips (optional)

A character `.glb` can carry animation clips: armature or object animation exported with the model, not video.
Name each clip after the state it plays in. Case doesn't matter, and Blender's `Armature|` prefix is ignored.

| Clip name | Plays when | If the clip is missing |
|---|---|---|
| `idle` | Standing still (everyone) | The model holds its exported pose |
| `walk` | Moving at walking pace | `idle` |
| `run` | Moving at run or sprint pace | `walk`, then `idle` |
| `talk` | During dialogue (you and Natalie) | `idle` |
| `aim` | Crossbow in hand (you) | `idle` |

Clips crossfade over 0.2 s and loop. Make them loopable: the last frame should match the first. In Blender, give
each action a fake user (the shield icon) so the glTF exporter includes every clip, not only the active one.
A model without clips still works; it just stands still.

## Forges and dice (B4, B5, B6)

At the travellers' camp by the stagecoach, the **mirror** opens the character forge and the **anvil** opens the
weapon forge (you need the crossbow first). Both are also in the pause menu. Everything you make is saved in this browser.
*Roll constraint dice* gives you three prompts to work into the story. *Submit…* sends your creation for review as a
GitHub issue (or downloads the .md). A reviewed character placed in `content/artifacts/` keeps its `look:` line and
shows up in the library with that look.

## Writing on the world (B13, B3, B10)

Open any book and press **✎** to pin a note to the page in your own ink, with a sketch as its wax seal. Notes show on
the page, on the lectern's 3D pages, and as a ribbon on the shelf book. Pick your ink and paper in the same panel.
The **banner** at the camp (or *Sketchbook* in the pause menu) opens a 32×32 pixel painter; *Hang on the banner*
puts your sketch on the cloth. Notes and sketches stay in this browser; *Submit…* sends them for review.

## Quests and folklore (B2, B12)

After Natalie hands you the crossbow, look for things out of place (E). The **casebook** (J) collects clues; with
three, write your theory of what happened to her party and pick who / where / why. The theory decides where the
blue light leads. Ask Natalie *Come with me* and she follows and comments. The **Curio Pedlar** by the coach road
knows the canon of legendary things and takes your own names, histories and rumors for anything you carry.
Quest text lives in `content/quest/` (clues, tags, keywords, leads, barks, legendary items) and can be edited there.

## Campfire, tunes and the gallery (B8, B11, B9)

Sit by the **campfire** at the camp: write an 8-step tune, then tell your adventure in three turns. Natalie adds her
own, and the bard sings it back as a ballad you can shelve, replay and submit. The **gallery hall** east of the dais
shows what you've made and the library works you've read, each with its credit.

## Places: dungeon, living map and dojo (B15, B7, B14)

Open the **trapdoor** beside the library and descend into a seeded dungeon: the same seed always builds the same
one, so you can share it. Press **M** for the **living map**, which fills in as you walk and lets you pin notes. At
the **dojo** your character demonstrates drills while you follow beginner-safe versions; risky moves are done by
the character only. Drills are light movement, not medical advice.

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
| F | Third person (default) / first person |
| I | Inventory |
| 1 / 2 | Crossbow / hands |
| RMB / LMB | Aim / fire (crossbow) |
| R | Reload (press again in the bright zone for a fast reload) |
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
content/artifacts/*.md   characters, songs, food, art (§6.1)
content/templates/       one copy-paste template per type (§6.2)
content/shelves.json     which red books sit on which of the 12 library shelves (F5.2)
content/rolltables/      grey-book lines (F5.3) and creation prompts (§6.3)
content/lore/index.json  generated by `npm run lore`; never hand-edit
content/assets/images/   images used by lore (placeholder SVGs for now)
src/palette.ts            A4 colour tokens + A5 swatch texture
src/controls.ts           F2.2 bindings and speeds
src/world.ts              M0 start area, outlines, placeholders, colliders
src/player.ts             M1 first-person movement + collision
src/book.ts, markdown.ts  M4 book UI, pagination, Markdown; F5.4 shelf reader, F5.6 [[links]]
src/library.ts            F5.1 library interior: 12 shelves, red/grey books, artifacts, exit door
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
| v0.04 — F3 dialogue + inventory | `src/dialogue.ts`, `src/inventory.ts`, `content/items.json`, `src/world.ts` (door, Natalie hitbox) | `test/e2e-v0.04.mjs`: typewriter rate, choices, frozen movement, give/unlock, inventory grid, walk through the open door, n5 prompt then crossbow |
| .glb loader + animation clips | `src/models.ts`, `public/draco/`, `vite.config.ts` | `test/e2e-models.mjs`: model replaces placeholder at slot height; missing/broken files fall back; clips play by state with fallbacks |
| v0.05 — F4 crossbow | `src/crossbow.ts`, `src/main.ts`, input layers | `test/e2e-v0.05.mjs`: equip, ADS FOV, 60 m/s + gravity, sticking, all three reload outcomes, 2× bonus, pickup, 30 s despawn |

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
