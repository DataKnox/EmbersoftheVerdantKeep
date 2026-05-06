# Embers of the Verdant Keep — project notes for Claude

A browser-based side-scrolling platformer in a modern detailed pixel-art
style. Single `index.html` plus modular JS files in `js/`, with PNG art
assets in `assets/`. **No build step. No npm. No package.json.**

## Hard constraints (do not violate)

- Vanilla JavaScript + HTML5 Canvas + WebAudio only
- All SFX and music generated via WebAudio — never add audio files
- Runs by opening `index.html` directly in a browser (also works behind
  `python3 -m http.server`)
- Pixel-perfect rendering: `imageSmoothingEnabled = false`, integer scaling
  via CSS

Do not suggest bundlers, frameworks, npm, TypeScript, or external runtime
libraries. They defeat the project's spirit.

## Art pipeline

Sprite sheets, tilesets, parallax backgrounds, and HUD elements are PNG
files in `assets/`, generated with the `gpt-image-2` skill against the
master style reference at `assets/sampleart.jpeg`. Each generated PNG is
post-processed by an alpha-key step that strips the near-white background
the model paints behind transparent prompts; keyed versions are saved
alongside the originals as `<name>.alpha.png` and are what the runtime
loads via `assets/manifest.json`.

Procedural Canvas drawing is **still used** for animated overlays on top
of the static art: torch flicker, banner sway, water ripple, wind sway,
hurt flash, sword-swing arc, parallax scroll math, vignette. These add
free motion to otherwise static sprite frames and should be preserved.

To regenerate art (or generate new pieces): use the bundled gpt-image
skill with `assets/sampleart.jpeg` (and ideally `assets/sprites/_test_player_hero.png`)
as `-i` references so style/palette stay locked. Re-run the alpha-key
step (`scripts/alpha_key.py`) afterward.

## Architecture

Each `js/<module>.js` declares a single global module object via IIFE:

```js
const Player = (() => {
  // private state
  function update(...) { ... }
  return { update, ... };
})();
```

Scripts load in dependency order in `index.html`:

```
audio → input → particles → assets → renderer → enemies → player → level → game
```

`assets.js` preloads every PNG referenced in `manifest.json` and exposes
`Assets.image('player')` etc. Cross-module references are by global
(`Player.TUNING`, `Level.create()`, etc.), evaluated at runtime — safe
because `init` runs on `window load` after asset preload.

## Dimensions

| Constant            | Value           |
|---------------------|-----------------|
| Internal canvas     | 480 × 270 px    |
| Tile size           | 32 px           |
| Level grid          | 60 × 24 tiles   |
| Player body box     | 20 × 32 px      |
| Player sprite cell  | 256 × 512 px in 1024×1024 sheet (8:1 downscale → 32 × 64 in-game) |
| Display scale       | 4× via CSS (1920 × 1080) |
| Fixed timestep      | 60 Hz           |

## Module roles

- `game.js` — main loop (fixed timestep, interpolated render), state machine
  (TITLE / PLAYING / GAME_OVER), HUD, combat dispatch, ambient FX, screen
  shake, hitstop
- `player.js` — physics, attack logic; **all feel-tuning constants live in
  `PLAYER_TUNING` at the top of this file**
- `enemies.js` — slime/archer/wisp AI, arrows, hit-flash, death tumble
- `level.js` — programmatic 60×24 grid builder, tile collision (AABB sweep,
  X-then-Y), entity spawn, hazard sampling
- `renderer.js` — palette, parallax, sprite/tile drawing via `ctx.drawImage`
  from preloaded sheets, vignette, title screen, animated procedural
  overlays (torch flicker etc.)
- `assets.js` — manifest-driven PNG preload, `image(name)` accessor,
  `drawSprite(name, anim, frame, dx, dy, dw, dh)` helper
- `particles.js` — sparks/dust/embers/leaves/bone/goo
- `audio.js` — procedural SFX library + 4-bar A-minor chiptune melody scheduled
  via WebAudio look-ahead pattern
- `input.js` — action-map keyboard layer with edge detection

## Conventions

- Coordinate system: y grows downward; tile (tx, ty) occupies pixels
  (tx·32, ty·32) to ((tx+1)·32, (ty+1)·32)
- Entity body anchor: top-left (e.g., player `x, y` is top-left of the
  20×32 body box; sprite is offset by `SPRITE_OFFSET_X/Y`)
- Pickups stored at center coords; drawing routines offset internally
- Sprite drawing uses `Assets.drawSprite(name, anim, frame, dx, dy)` which
  reads the source rect from `manifest.json` and calls `ctx.drawImage`
- Solid color fills still use `Renderer.fr(x, y, w, h, color)` for HUD,
  particles, and procedural overlays
- Particles spawned via `Particles.spawn(particles, p)` or
  `Particles.burst(particles, x, y, opts)`
- Audio gated through `Audio.play('name')` — silently no-ops if muted or
  AudioContext not yet unlocked

## Adding new things

- **New tile type** — add a tile cell to the appropriate tileset PNG (or
  regenerate), add an entry to `manifest.json` mapping name → cell coords,
  add to `Level.T`, mark solid/hazard set if needed, add a case to
  `Renderer.drawTiles` (which now just calls `Assets.drawTile`)
- **New enemy** — add to `ENEMY_TUNING` in `enemies.js`, add to the type
  switch in `update` and `draw`, add a sheet to `assets/sprites/` and
  manifest entry, add an entity char in `Level.ENTITY_CHARS`
- **New SFX** — add an entry to `SFX` in `audio.js`, call `Audio.play('name')`
  from the appropriate place
- **New tunable** — add to `PLAYER_TUNING` (or its enemy/level equivalent)
  with a unit comment, never inline a magic number

## Testing

There is no test framework. To verify changes:
- `node --check js/<file>.js` for syntax
- Open `index.html` in a browser and play
- For headless smoke tests, the `node -e` pattern with stubbed `document` /
  `window` / `performance` works (see commit messages for examples)

## Commit style

Many small atomic commits per task — one per logical chunk (e.g., scaffolding,
physics, level, enemies, audio, polish). Match the existing log's style:
short imperative subject, short body explaining the why, Co-Authored-By
trailer.
