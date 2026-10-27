# Vision: look, camera, feel

> **2026-10-27: direction changed.** Mike moved the look to a low-poly storybook style (his "Echoes of Avalon"
> boards: Tree of Savior + Ragnarok Online + Dark Cloud 2), with no MMORPG elements and the creative tools
> central. The camera section and "Storybook style" below are current. The older sections describe the earlier
> Legends/Vintage Story look and stay for history.

## Storybook style (current, S2b+S3)

- **Characters:** Tree of Savior / RO style pixel-art sprites, 8 directions, 12 fps, 1 px ink outline. They are
  rendered live from chibi 3D rigs (about 2.7 heads tall, soft rounded parts, anime eyes on a face plane, chunky
  cuffed boots and gloves), so forged looks and all poses carry over. Default adventurer: newsboy cap with goggles, navy vest
  and trousers, cream shirt, rust neckerchief, leather satchel. Light painted into vertex colours (warm key,
  cool shadow), blob shadow underneath.
- **Palette:** navy, rust, leather, cream, moss; bright greens and warm stone in the world.
- **World:** procedural textures kept, but brighter and smoothly filtered (painted, not pixel-crisp).
  Faceted low-poly canopies and bushes. Clear blue sky with a warm cream horizon.
- **Next:** storybook town pieces (timber houses, red roofs, bunting, cobbles) and the UI skin (S4).

Distilled 2026-10-22 from Mike's references (`references/` on his PC, project uploads, lore image board).
Reference files are third-party: never commit them, never put them under `public/`, never copy their code.

## One-line pitch

A small, sunlit, hand-made 3D world that friends walk through to read and write each other's lore:
**Mega Man Legends characters standing in a Vintage Story world, lit like HD-2D.**

## What each reference contributes

| Reference | Take | Leave |
|---|---|---|
| Mega Man Legends (Volnutt turnaround GIF) | Characters: boxy segmented limbs, big head, face painted in texture, 2–3 flat saturated tones per part, chunky hands/boots, readable from any angle | Robot/blue palette, MML world |
| Vintage Story (forest screenshot) | Environment: low-res pixel textures (nearest filter) on simple geometry, per-texel colour noise (moss, bark, lichen), dense layered foliage, warm sun through canopy, soft shadows | Full voxel terrain, survival systems |
| Sacrifire (2 screenshots) | Lighting/mood: god rays, atmospheric haze, depth layering (fore/mid/background), warm window glows vs. teal night, glowing fungi, lively towns | Pixel-sprite characters, side-on 2D framing |
| DDLC 3D fanart | Pixel/low-res figures inside a lit 3D room; one strong low sun casting long shadows; tone shifts with lighting | Subject matter |
| "Replaced" clip (animated webp) | Cinematic camera: shallow depth of field, fog, chunky pixel grass in the foreground, low eye-level shots | Combat/side-scroller framing |
| BRiTEBOT (LÖVE source zip) | Rotatable small diorama world, undo, one mechanic per level, cute readable icons, menu islands floating in sky | Its code (study only), isometric-only camera |
| FPS Shooter (Unity Windows build, not source) | Movement verbs worth considering later: vault, ledge grab, ladder, swim, lean, interact prompt | Guns/FPS focus; binary is not usable code |
| Lore image board (`lore/images/`) | Content palette: libraries, ruined halls, villages, mushrooms/ferns, hooded wanderers, owls, golden thrones, lava; mixed Victorian/fantasy costume | Photo-real/AI-painterly finish (convert to the style above) |

## How Legends and Vintage Story fit together

- **Split by layer.** Characters/props = Legends (flat, clean, low-poly, painted-in light).
  Ground/trees/rocks/walls = Vintage Story (pixel texture noise, nearest-filtered, natural palette).
- **Shared rules so they don't clash:** same texel density feel (≈16–32 px per metre), same warm sun direction,
  saturated but natural palette (greens/ochres/stone; character colour accents pop against it).
- **Lighting glue (Sacrifire/HD-2D):** world gets real sun, fog, haze, bloom on glows; characters stay mostly unlit
  (painted light) with a soft blob/contact shadow so they sit in the world. Optional DOF on reading/menus only.

## Camera and perspective

- Default (S1): a Dark Cloud 2 style follow camera above and behind the player. The mouse wheel zooms from a
  close over-the-back view out to a high, narrow-FOV Ragnarok Online / Tree of Savior overview. Dragging turns it.
  The cursor stays free: hover highlights things, click (or E) uses them.
- First person is optional and off by default: scroll in past the closest zoom (the camera glides into the eyes),
  press F, or pick it from the pause menu's Camera list (how phones choose it). Aiming the crossbow uses it too.
- Reading/lore moments: camera eases to a framed shot of the book/lectern with background blur (Replaced/DDLC).
- Optional later: orbit/diorama view of a location (BRiTEBOT rotate) for showing a friend's build or map.

## Player experience

1. Arrive in a quiet, beautiful place (haze, sun rays, birdsong). No pressure.
2. Walk to find in-world objects that hold friends' lore (books, notices, statues).
3. Read in a cinematic, focused view.
4. Add your own: one simple creative verb at a time (BRiTEBOT's "one mechanic per level" applied to creation).
5. Places feel lived-in: lit windows, banners, small NPC clutter (Sacrifire town).
Tone: cosy-adventurous by day, eerie by night; mature themes stay in content, not the default look.

## Practical targets (browser/phone)

- Textures 32 px per metre, `NearestFilter` up close, mipmapped in the distance (stops shimmer); painted at load time.
- Characters ≤ 3k tris, one ≤ 512 px texture, unlit; environment lit, fog + cheap god-ray/sprite shafts.
- Post FX (bloom, DOF) behind the Graphics preset; Low = off.
