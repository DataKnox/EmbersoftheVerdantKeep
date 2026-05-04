# Embers of the Verdant Keep — project notes for Claude

A browser-based 16-bit side-scrolling platformer. Single `index.html` plus
modular JS files in `js/`. **No build step. No dependencies. No package.json.**

## Hard constraints (do not violate)

- Vanilla JavaScript + HTML5 Canvas + WebAudio only
- All sprites/tiles generated procedurally via Canvas drawing — never add
  image files
- All SFX and music generated via WebAudio — never add audio files
- Runs by opening `index.html` directly in a browser (also works behind
  `python3 -m http.server`)
- Pixel-perfect rendering: `imageSmoothingEnabled = false`, integer scaling
  via CSS

Do not suggest bundlers, frameworks, npm, TypeScript, asset pipelines, or
external libraries. They defeat the project's spirit.

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
audio → input → particles → renderer → enemies → player → level → game
```

Cross-module references are by global (`Player.TUNING`, `Level.create()`,
etc.), evaluated at runtime — safe because `init` runs on `window load`.

## Dimensions

| Constant            | Value         |
|---------------------|---------------|
| Internal canvas     | 320 × 192 px  |
| Tile size           | 16 px         |
| Level grid          | 60 × 24 tiles |
| Player body box     | 10 × 16 px    |
| Player sprite frame | 16 × 20 px    |
| Display scale       | 4× via CSS    |
| Fixed timestep      | 60 Hz         |

## Module roles

- `game.js` — main loop (fixed timestep, interpolated render), state machine
  (TITLE / PLAYING / GAME_OVER), HUD, combat dispatch, ambient FX, screen
  shake, hitstop
- `player.js` — physics, attack logic; **all feel-tuning constants live in
  `PLAYER_TUNING` at the top of this file**
- `enemies.js` — slime/archer/wisp AI, arrows, hit-flash, death tumble
- `level.js` — programmatic 60×24 grid builder, tile collision (AABB sweep,
  X-then-Y), entity spawn, hazard sampling
- `renderer.js` — palette, parallax, tile/sprite drawing, vignette, title
  screen
- `particles.js` — sparks/dust/embers/leaves/bone/goo
- `audio.js` — procedural SFX library + 4-bar A-minor chiptune melody scheduled
  via WebAudio look-ahead pattern
- `input.js` — action-map keyboard layer with edge detection

## Conventions

- Coordinate system: y grows downward; tile (tx, ty) occupies pixels
  (tx·16, ty·16) to ((tx+1)·16, (ty+1)·16)
- Entity body anchor: top-left (e.g., player `x, y` is top-left of the 10×16
  body box; sprite is offset by `SPRITE_OFFSET_X/Y`)
- Pickups stored at center coords; drawing routines offset internally
- All drawing uses `Renderer.fr(x, y, w, h, color)` for pixel rectangles;
  `Renderer.ctx` is the same context as `game.ctx`
- Particles spawned via `Particles.spawn(particles, p)` or
  `Particles.burst(particles, x, y, opts)`
- Audio gated through `Audio.play('name')` — silently no-ops if muted or
  AudioContext not yet unlocked

## Adding new things

- **New tile type** — add to `Level.T`, mark solid/hazard set if needed, add
  a `case` to `Renderer.drawTiles`, and a draw function (`drawXxx`)
- **New enemy** — add to `ENEMY_TUNING` in `enemies.js`, add to the type
  switch in `update` and `draw`, add an entity char in `Level.ENTITY_CHARS`
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
