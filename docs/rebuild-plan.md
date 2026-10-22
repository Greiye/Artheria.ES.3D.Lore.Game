# Partial rebuild plan

2026-10-22, approved scope: **partial**. We rebuild the look, the world, the camera and the player to match
[vision.md](vision.md). The plumbing that doesn't depend on art style stays.
This is a plan only. Nothing is implemented yet.

## Keep (port as-is, light touch only)

| Area | Files |
|---|---|
| Lore pipeline + content | `content/**`, `scripts/build-lore.mjs`, `src/lore.ts`, `src/markdown.ts` |
| Book reader / editor / character | `src/book.ts`, `src/editor.ts`, `src/character.ts`, `src/prompts.ts` |
| Dialogue / inventory | `src/dialogue.ts`, `src/inventory.ts` |
| Input | `src/controls.ts`, `src/input/*` |
| Settings / audio / version | `src/settings.ts` (new graphics keys added), `src/audio.ts`, `src/version.ts` |
| UI shell | `src/style.css`, `index.html` overlays |
| Model loader | `src/models.ts` (slot logic kept; fit/material rules change) |
| Deploy / PWA | `.github/workflows/deploy.yml`, `public/` (icons, manifest, draco, models) |

## Rebuild from scratch

| Old | New | Why |
|---|---|---|
| `world.ts` (one 437-line file, vertex-painted + outlines) | `src/world/`: `terrain.ts`, `foliage.ts`, `props.ts`, `sky.ts`, `colliders.ts` | Vintage Story pixel-textured terrain + dense foliage; drop outlines |
| `palette.ts` (flat swatches) | `src/tex/`: procedural pixel-noise textures, NearestFilter, shared atlas | Natural texel noise without shipping art |
| *(none)* | `src/render/`: renderer, lights, fog, god rays, bloom, DOF, all controlled by the Low/Med/High presets | Sacrifire/HD-2D lighting |
| `player.ts` (movement + camera mixed) | `src/player/`: `movement.ts`, `body.ts` (Legends-style unlit placeholder + blob shadow) | Clean split; character style |
| camera code in `player.ts`/`main.ts` | `src/camera/`: third-person follow (default), FP toggle (F), wall collision, reading shot | Vision camera |
| `library.ts` scene geometry | Rebuilt in the new style; hit/shelf/artifact logic kept | Look only |
| `crossbow.ts` | Ported to third-person aim (over-shoulder + crosshair) | Camera change |
| `main.ts` (768 lines) | `main.ts` bootstrap + `src/game/state.ts` + `src/game/loop.ts` | Too coupled to rebuild around |

**Contract to keep:** the `window.__gametool` test hook (state, player, camera, world, …) keeps its shape,
so the existing e2e suite stays the safety net. Tests that assert old scene specifics (sun angle, door sightline)
get updated to the new scene. None are deleted.

## Phases (one branch, one merged CHANGELOG, version bump only at launch)

| # | Deliverable | Done when |
|---|---|---|
| R0 | Tag `main` as `legacy-v0.06`; settle the 2 unmerged commits on `claude/project-thread-mrw2zv`; freeze the hook contract | Tag pushed, branch clean |
| R1 | Render core + procedural pixel textures + sky/fog/sun; presets drive post FX | Low preset has no post FX; textures are nearest-filtered; existing settings tests pass |
| R2 | **Style slice:** one glade (terrain, trees, ferns, rocks), the lectern, the Natalie standee, the player body | Side-by-side screenshot vs. vision references; Mike signs off on the look |
| R3 | Camera + movement: follow cam, FP toggle, collision, reading shot with DOF; same Skyrim controls/touch/gamepad | v0.03 camera tests + mobile tests pass |
| R4 | Port gameplay: library + door, books, grey books, crossbow, dialogue, inventory, model slots | Full old e2e suite passes |
| R5 | Polish + perf: god rays/bloom tuning, phone budget (30 fps on Low), README/assumptions updated | All e2e green; deploy to Pages; then the version bump |

R2 is the checkpoint. If the look is wrong there, only the style changes. Nothing downstream needs redoing.

## Risks

- **Post FX on phones:** DOF/bloom are expensive, so they're off on Low and the god rays are cheap sprite shafts.
- **No real art yet:** procedural textures and primitive Legends-style placeholders carry the look until `.glb` models arrive (existing slot system).
- **Parallel work:** the "Apply lore to game" thread touches the same files, so it should pause or merge before R0.
- **Test container has no GPU:** visual sign-off is by screenshot plus Mike's eye, not by automated checks.
