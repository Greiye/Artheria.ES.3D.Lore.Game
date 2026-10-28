# Hand-drawn heads

Drop sheets here and rebuild; they're inlined into the game. A character uses them when its look has
`art: '<id>'` (heroine = default player, hero, natalie, pedlar). Missing files fall back to the heads drawn in
`src/render/headArt.ts`. Templates and starter sheets (the current drawn heads) are in `art-templates/`.

| File | What |
| --- | --- |
| `<id>.png` | Head: hair, skull, headwear. No face. |
| `<id>-face.png` | Face: eyes, brows, mouth, blush. Layered over the head. Optional. |
| `<id>.json`, `<id>-face.json` | Optional Aseprite sheet data (File > Export Sprite Sheet > Output > JSON Data). |

**Frames:** 96×104 px each, transparent, hard pixels. The head is ~40 px across, centred, its centre 40 px from
the top (see the guides in `art-templates/`). Leave a 1 px clear border: the game adds the 1 px ink outline.

**Head sheet:** one row, frames 0 front, 1 three-quarter (face turned to screen-left), 2 profile (face to
screen-left), 3 back three-quarter, 4 back. 5 frames: the right-hand turns are mirrored. 8 frames: all used as drawn.

**Face sheet:** one row per expression, columns front, three-quarter, profile (mirrored for the other side; no face
from behind). Without JSON the rows are `neutral`, `blink`, `talk-a`, `talk-b`. With JSON, each Aseprite tag is an
expression (tag name = expression), so you can add more (`happy`, `angry`, …); export By Rows.
The game blinks every 2–5 s, alternates `talk-a`/`talk-b` while a character talks, and code can show any tag by
setting `root.userData.expression = '<tag>'`.

**Format:** PNG, indexed colour (Aseprite: Sprite > Color Mode > Indexed) keeps each sheet a few KB.
Don't use lossy WebP (it smears pixels).
