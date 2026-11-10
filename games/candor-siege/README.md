# Candor: The Siege of Newharf

Standalone browser game, separate from the main Artheria app (not part of the Vite build or the Pages deploy).
Over-the-shoulder archery, blade and parkour against endless goblin/orc waves in Newharf.

- Single file: `index.html`. three.js r170 and Rapier 0.14 (`@dimforge/rapier3d-compat`) load from jsDelivr via an import map.
- Play: open `index.html` in Firefox/Chrome, or serve the folder (`npx serve games/candor-siege`).
- Graphics presets: Low (phones) / Medium / High (GTAO + bloom) / Ultra. Add `#low`, `#med`, `#high`, `#ultra` to the URL to force one.

Showcase: Rapier kinematic character controller (player + enemies, autostep, slopes, pushing props), ray casts for arrows/mantle/wall-run/camera,
dynamic crates/barrels, ragdolls built from jointed capsules, bombs, chain explosions; three.js PBR with procedural textures, Preetham sky + PMREM,
soft shadows, instanced wind-blown grass and trees, verlet cloth cloak, GPU point particles, GTAO, bloom and a custom grading pass.
