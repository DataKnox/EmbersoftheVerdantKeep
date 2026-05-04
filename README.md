# Embers of the Verdant Keep

A browser-based 16-bit-style side-scrolling platformer. Vanilla JavaScript and
HTML5 Canvas — no build step, no dependencies.

## How to play

### Quick start
Just open `index.html` in any modern browser:

```
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

If your browser blocks audio autoplay or local-file scripts, run a tiny local
server instead:

```
python3 -m http.server 8000
```

then visit <http://localhost:8000/>.

### Controls

| Action       | Keys                          |
|--------------|-------------------------------|
| Move         | `←` `→` or `A` `D`            |
| Jump         | `Space` (hold for higher jump)|
| Attack       | `X` or `J`                    |
| Confirm      | `Enter`                       |
| Mute audio   | `M`                           |

The first checkpoint unlocks **double jump** — required to clear the wider
bridge gap.

### Goal

Travel from the enchanted forest, across a crumbling stone bridge, and into a
ruined castle to recover the **Verdant Relic** hidden in the alcove. Collect
gems and hearts along the way. Falling into the pit costs HP and respawns you
at the last checkpoint. Run out of hearts and your ember fades.

### Tips
- Variable-height jump: tap for a hop, hold for full leap.
- Coyote time and jump buffering are generous — don't worry about pixel-perfect
  edge timing.
- Sword swings have a brief windup, an active hitbox, and a recovery frame.
  Time it.
- The skeleton archer's bow visibly draws back before firing — that's your cue
  to dodge.

## Tweaking game feel

All gameplay constants live at the top of `js/player.js` in the
`PLAYER_TUNING` object: gravity, jump velocity, jump cut, coyote time, attack
range, knockback, etc. Edit and reload — no rebuild needed.

## Project layout

```
index.html
js/
  game.js        main loop, state machine, HUD, combat, ambient FX
  player.js      physics + tunable constants
  enemies.js     slime / archer / wisp AI + arrows
  level.js       60×24 tile grid + collision
  renderer.js    palette, parallax, sprites, vignette, title screen
  particles.js   spark / dust / ember / leaf / bone / goo
  audio.js       procedural SFX + looping chiptune melody
  input.js       action-based keyboard layer
```
