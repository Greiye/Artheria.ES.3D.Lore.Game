# Tales of Artheria (Video Gametool)

A small 3D lore game set in Artheria. You arrive by stagecoach at a storybook town beside the Ruined Library. There you read and write lore, make characters and weapons, follow Natalie Bourbon's missing-party mystery, and delve the dungeon under the library. The corner label shows the current build (`src/version.ts`, now 0.06). `CHANGELOG.md` lists everything that shipped.

Private project, all rights reserved. Not open source. Third-party models are credited below.

**Play:** <https://greiye.github.io/Artheria.ES.3D.Lore.Game/>. It runs on PC, phones and tablets with no install. On a phone, Share → Add to Home Screen gives a fullscreen icon.

## What's in it

- **The town:** nine buildings round a cobbled plaza with a fountain, one per tool:
  - library, smithy (weapon forge), tailor (character mirror), scriptorium (writing), cartographer (living map), dojo, gallery, General Store and inn;
  - a river with a stone bridge and a footbridge, a windmill and the library spire;
  - townsfolk who walk, spar, haggle and chat, a band, and a cinema screen;
  - day, sunset and night, with sound placed in the world.
- **Characters:** realistic proportions with low-poly 3D heads. The faces are drawn as eye and mouth strips with six expressions, plus blinking and talking. Mike's drawn faces are used where they exist (`src/art/heads/README.md`).
- **Reading and writing:** the red books at the library door and the 12 shelves inside. You can pin notes to pages, sketch on the writing desk, and write lore in the game (Extras → Write lore).
- **Making things:** the character forge (tailor's mirror) and the weapon forge (smithy anvil) both have constraint dice. *Submit…* sends work for review; player text stays on the device until submitted.
- **The quest:** find clues (casebook, J), write a theory, and Natalie follows the lead. The Curio Pedlar (a placeholder) trades in legends.
- **The campfire:** sit to play in the 7-stem band, hear or tell a tale (Natalie's telling is kinetic text), and sleep to move time on.
- **The dungeon:** a seeded crawl under the trapdoor, plus the Quick Dungeon node map. Goblins are rolled from trait tables (`src/data/traits/`, `docs/trait-roll-tables.md`): every goblin is named, and rare ones get titles.
- **Living map (M), dojo drills, gallery, shop and cinema** (looping WebM reels).
- **Options:** three cameras (overhead by default, shoulder, first person) and Low, Medium or High presets. Auto quality eases off when the frame rate drops. Keys can be rebound.

## Controls

| Keyboard and mouse | Action |
|---|---|
| WASD | Move (runs by default). Shift walks, Alt sprints, Caps Lock toggles always-run |
| Space / C | Jump / sneak |
| E | Use, talk or read |
| F / Q | Change camera view / swap shoulder (or weapon) |
| 1 / 2, RMB / LMB, R | Crossbow / hands, aim / fire, reload |
| T | Torch |
| I / J / M | Bag / casebook / map |
| Esc | Pause menu (Gameplay, Graphics, Sound, Controls) |

| Controller | Action |
|---|---|
| Left stick / right stick | Move / look. L3 sprints, R3 changes the camera view |
| A / B / X / Y | Use / back or sneak / reload / jump |
| LT / RT | Aim / fire |
| LB / RB | Zoom in or out (turn pages in a book) |
| D-pad | Up: swap shoulder or weapon. Hold down: torch. Left and right: quick swap. It also moves through menus |
| View / Menu | Bag / pause |

On touch screens, the left thumb is a joystick and the right thumb drags to look. The on-screen buttons cover the rest. Pause → Controls shows the full map with your own pad's button names.

## Build and deploy

- `npm install`, then `npm run dev` for a dev server. `npm run build` checks lore and types and writes the single-file `dist/index.html`.
- Every push to `main` runs `.github/workflows/deploy.yml`, which builds and publishes **`dist/`** to GitHub Pages. The root `index.html` is only Vite's source entry.
- `.github/workflows/smoke.yml` runs the boot, town and menu tests on every PR. The full suite (`npm run test:e2e`, headless Chromium) is long, so run it locally.

## Content

- **Lore:** `content/lore/*.md`. Templates are in `content/templates/`, and shelving is in `content/shelves.json`. Edit on github.com and commit; the site rebuilds in 1–2 minutes. A bad file fails the build with a plain message, and the live site keeps the last good version.
- **Quest text:** `content/quest/`. Roll tables are in `content/rolltables/`.
- **Models:** put `public/models/<slot>.glb` in the repo and it replaces that slot's placeholder:
  - slots: `natalie`, `hero`, `kavik`, `pedlar`, `stagecoach`, `witch`, `sword` and `player`;
  - `forest-trees.glb` dresses the hills;
  - clips named `idle`, `walk`, `run`, `talk` and `aim` play by state.
- **Model budget:** at most 5k triangles per character and at most 512² textures. Use Meshopt compression; Draco is not supported.
- **Faces:** see `src/art/heads/README.md` (eye and mouth strip sheets; templates are in the project's `art-templates/`).
- **Reference art:** `references/` is git-ignored study material. Nothing in it ships, except the three cleared models below.

## Credits

- Witch (rig and animations) and Sword by [Quaternius](https://quaternius.com), CC0. The witch is simplified for phones.
- [Low Poly Forest Tree Pack](https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b) by [99.Miles](https://sketchfab.com/99.Miles), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its textures are resized to 512 px and unused maps are removed.
- The auto-quality idea comes from Edelweiss's Optimizer.js (CC0, no code used).
- Details are in `public/models/CREDITS.md`, and in the game under Extras → Inspirations → Asset credits.
