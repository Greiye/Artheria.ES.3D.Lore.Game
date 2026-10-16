# Assumptions log

Places where the spec was ambiguous, where browsers forced a choice, or where the build deviates. Per §0 rule 6: simplest version that passes Done-when, logged here. The owner can overturn any of these.

| # | Req | Assumption / deviation | Why |
|---|-----|------------------------|-----|
| 1 | D4 | M0–M5 were delivered together, already on Vite + TS. `npm run build` still emits **one self-contained `dist/index.html`**. | The single-file stage (M0–M2) and the Vite stage give the same player-facing result. Shipping straight to the end state avoids a throwaway rewrite. |
| 2 | — | No CDN or network dependency: three.js, lore and images are all inlined into the build. | Test attempt 1 failed because the CDN imports were blocked, so the game script never ran. |
| 3 | F2 Mouse | If the browser denies pointer lock (sandboxed previews, some embeds), the game falls back to **hold left mouse + drag to look** and shows a hint. | Without a fallback, the game is unplayable wherever pointer lock is blocked. |
| 4 | F3.6 | Closing the book with **Esc** may show a one-click "Click to continue" before the pointer relocks. | Browsers only grant pointer lock on a user gesture, and Esc doesn't count as one. Tab and E relock directly. |
| 5 | F2 C | Sneak is a **toggle** (as in Skyrim) at 1.6 m/s. Jumping is disabled while sneaking. | The spec gives no sneak speed. |
| 6 | F2 Caps Lock | Toggles on keydown. A keyup with no recent keydown also toggles. | macOS sends only a keyup when Caps Lock turns off. |
| 7 | F1.3 | Rocks, trunks, pillars, walls, lectern and standees collide. **Bushes are walk-through.** | Soft foliage. The spec names only rocks and the map edge. |
| 8 | A3 | The outline is pushed along the **view-space** normal and scaled by depth, giving a constant ~2 px line instead of a fixed 1.03 object-space scale. | Thin, non-uniformly scaled instances (tree trunks) lost their outline with object-space scaling. Still an inverted hull: BackSide, unlit black. |
| 9 | A4 | The four spec tokens are kept exactly. Extra tints (leaf, bark, wood, parchment, sky…) are derived from the reference image and live in the same `palette.ts`. | The scene needs more than four colours. They all stay in one file. |
| 10 | F1.4 | The toon ramp's darkest step is 59% brightness, and sky/fog are a pale moss grey. | "No pure-black areas." |
| 11 | F3.5 | Markdown is rendered by a small built-in renderer (`src/markdown.ts`): headings, bold, italic, lists, images, quotes, inline code, rules. Raw HTML in lore shows as text. | No CDN or library, and lore can't inject script. |
| 12 | F3.4 | Each entry starts on a new page. Contents rows show title, contributor and page number. | Readable chapters. Page numbers make the contents useful. |
| 13 | F3.7 | `lastPage` is stored as a page index. If the window size changes, pagination is redone and the position is restored to the start of the same entry. | Page count depends on window size. |
| 14 | F5.1 | Movement and jumping use a fixed 120 Hz simulation step, so speeds and jump height are exact at any frame rate. | Clamping per-frame delta made slow frames lose distance. |
| 15 | 2D/3D placeholders | 3D placeholders are low-poly primitives (rocks, trees, ruins, lectern, book). 2D placeholders are billboard standees (The Stagecoach, Hero) and SVG images in lore, all labelled PLACEHOLDER. | Owner asked for 2D and 3D placeholders. |
| 16 | L3 | The sample entries' contributor is "Sample Player", except The Stagecoach (Mike). | Real contributor names come from players. |
| 17 | D6 | **Changed by the owner on 2026-10-16:** touch and gamepad support moved from backlog (B7) into the MVP. | Owner request. |
| 18 | Touch | Floating joystick on the left 45% of the screen and drag-to-look on the right, plus Jump, Sneak, Sprint (hold), Read and ☰ buttons. The joystick walks on a small push and runs on a full push. | Common mobile FPS layout, mirroring Skyrim's analog walk/run. |
| 19 | Book on phones | Portrait phones, narrow windows and short landscape phones (< 500 px tall) show **one page at a time**. Landscape uses a wide page so lines stay readable. Swipe or tap a page edge to turn, ✕ to close. | A two-page spread on a phone gives ~25-character lines. |
| 20 | Gamepad | Skyrim controller layout where one exists: A activate, B back, Y jump, LB sprint, L3 sneak, Start pause. Additions: R3 toggles always-run, LB/RB/D-pad/stick flick turn pages. Bindings live in `controls.gamepad`. | Matches the Skyrim reference; F2.2 one-line remap. |
| 21 | Gamepad | The pause menu's sliders still need mouse or touch. Start/A/B resume. | Full controller menu navigation is a larger UI task. Logged for later. |
| 22 | Phones | Render resolution is capped at 1.5× on touch devices. | Mid-range phones hold frame rate without visible blur. |
| 23 | iPhone | iPhone Safari has no fullscreen API for pages. Players get fullscreen through Share → Add to Home Screen (web manifest included). Android goes fullscreen when the game starts. | Platform limit. |
| 24 | Hosting | GitHub Actions builds and deploys to GitHub Pages on every push to `main`. `campaign/lore/index.json` is no longer committed; CI regenerates it. | Lore can be edited on github.com with no local npm. |
