# Hand-drawn faces

Since 2026-10-29 every character has realistic proportions and a low-poly 3D head; its face is drawn and sits on
a quad over the front of the skull, swapped per expression like Mega Man Legends' face textures. Drop face sheets
here and rebuild; they're inlined into the game. A character uses one when its look has `art: '<id>'` (heroine =
default player, hero, natalie, pedlar). Without a sheet, the face is drawn in `src/render/headArt.ts`.
Templates and starter sheets are in `art-templates/`.

| File | What |
| --- | --- |
| `<id>-face.png` | Face: eyes, brows, mouth, blush. |
| `<id>-face.json` | Optional Aseprite sheet data (File > Export Sprite Sheet > Output > JSON Data). |
| `<id>.png` | The old 2D head sheet (chibi look). No longer used; kept as Mike's art. |

**Cells:** 96×104 px each, transparent, hard pixels, laid out as in `art-templates/face-template.png` (head ~40 px
across, its centre 40 px from the top). The game shows the middle 48×48 px of the **front** cell (x 24–72,
y 22–70): eyes, brows, nose line, mouth. The 3D head does the turning, so the three-quarter and profile columns
are no longer needed (they're ignored if present).

**Rows:** one per expression. Without JSON the rows are `neutral`, `blink`, `talk-a`, `talk-b`. With JSON, each
Aseprite tag is an expression (tag name = expression; its first frame is used), so you can add more (`happy`,
`angry`, …). The game blinks every 2–5 s, alternates `talk-a`/`talk-b` while a character talks, and code can show
any tag by setting `root.userData.expression = '<tag>'`.

**Format:** PNG, indexed colour (Aseprite: Sprite > Color Mode > Indexed) keeps each sheet a few KB.
Don't use lossy WebP (it smears pixels).
