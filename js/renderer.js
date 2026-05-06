// renderer.js — sprite/tile/background draw via Assets, plus procedural
// overlays (sky clear, spike, vignette, title plate). The painterly art now
// lives in PNGs; this module only owns palette constants and the few effects
// that have to be procedural.

const Renderer = (() => {
  // Kept for HUD, particles, hurt-flash, title plate, and animated overlays.
  const PALETTE = {
    skyTop:    '#1c1230',
    skyMid:    '#2c2148',
    skyHorizon:'#52345e',

    // fire / accent
    flameCore:  '#fde0a3',
    flameMid:   '#f4b860',
    flameDark:  '#e8893d',
    emberRed:   '#c63b1c',
    flameGlow:  'rgba(244,184,96,0.18)',

    // gems / pickups
    gemBlue:    '#5ec1d8',
    gemBlueHL:  '#a8e6f0',
    gemBlueDark:'#2c6a82',
    heartRed:   '#d9433f',
    heartHL:    '#ff7d6a',
    heartDark:  '#7a1f1c',
    relicGold:  '#f4c952',
    relicGoldHL:'#fff2b0',
    relicGoldDark: '#9c7820',

    // ui
    uiCream:    '#f4ecd0',
    uiDark:     '#1a1224',
    uiPurple:   '#5e4382',
    uiPurpleDk: '#34264a',

    // arrow / archer / wisp (referenced by enemies.js)
    arrowShaft: '#7a5236',
    arrowHead:  '#a8a8b8',
    stoneDark:  '#2a2735',
    stoneMid:   '#454458',
    stoneLight: '#6a6a82',
    stoneHL:    '#8c8ca8',
    barkDark:   '#2a1c14',
    barkMid:    '#3a261a',
    barkLight:  '#4a3526',
    skeleBone:  '#e8e0c0',
    skeleBoneShadow: '#a89c78',
    skeleCloth: '#3a2848',
    wispCore:   '#c0e8ff',
    wispMid:    '#7ab8e0',
    wispDark:   '#3a5a8a',

    black:  '#0a070e',
    white:  '#ffffff',
  };

  let canvas, ctx;
  let vignetteCanvas;
  // Cache of biome to use this frame (resolved from camera.x). Forest until
  // halfway across the level; castle for the second half.
  let biome = 'forest';

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
  }

  function preloadSprites() {
    bakeVignette();
  }

  function bakeVignette() {
    const w = canvas.width, h = canvas.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    const grad = cx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.65, 'rgba(8,4,16,0.18)');
    grad.addColorStop(1, 'rgba(8,4,16,0.55)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, w, h);
    vignetteCanvas = c;
  }

  // Pick biome based on camera.x (level half-way). Updated each draw.
  function pickBiome(camera, level) {
    if (!level) return 'forest';
    const half = level.pixelWidth * 0.55;
    return camera.x > half ? 'castle' : 'forest';
  }

  function clear() {
    const h = canvas.height, w = canvas.width;
    ctx.fillStyle = PALETTE.skyTop;     ctx.fillRect(0, 0, w, h * 0.40);
    ctx.fillStyle = PALETTE.skyMid;     ctx.fillRect(0, h * 0.40, w, h * 0.45);
    ctx.fillStyle = PALETTE.skyHorizon; ctx.fillRect(0, h * 0.85, w, h * 0.15);
  }

  // Solid fill helper — used by HUD, particles, procedural overlays.
  function fr(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  // ─── Parallax (background images, scrolled by camera) ─────────────────────
  // dy/dh are the dst-rect on canvas; sy/sh optionally crop the source vertically.
  function drawTiledHorizontal(img, scrollX, dy, dh, sy = 0, sh = null) {
    if (!img) return;
    const cw = canvas.width;
    const nw = img.width, nh = img.height;
    if (sh === null) sh = nh - sy;
    const dw = Math.round(nw * (dh / sh));
    const ox = ((-scrollX) % dw + dw) % dw - dw;
    for (let x = ox; x < cw + dw; x += dw) {
      ctx.drawImage(img, 0, sy, nw, sh, x | 0, dy | 0, dw, dh);
    }
  }

  function drawParallax(camera, levelW) {
    biome = pickBiome(camera, Game.level);
    const ch = canvas.height;
    const farImg  = Assets.bgImage(biome === 'castle' ? 'castle_far'  : 'forest_far');
    const midImg  = Assets.bgImage(biome === 'castle' ? 'castle_mid'  : 'forest_mid');

    // Far fills the canvas top-to-bottom (it's the sky + distant mountains).
    drawTiledHorizontal(farImg, camera.x * 0.12, 0, ch);
    // Mid trees occupy roughly source y=480..1100. Scale that band to the lower
    // 70% of the canvas so trees line up with the playable horizon.
    if (midImg) {
      const sy = 380, sh = 720;
      const dh = Math.round(ch * 0.75);
      drawTiledHorizontal(midImg, camera.x * 0.32, ch - dh, dh, sy, sh);
    }
  }

  function drawForeground(camera) {
    const ch = canvas.height;
    const nearImg = Assets.bgImage(biome === 'castle' ? 'castle_near' : 'forest_near');
    if (!nearImg) return;
    // Foliage band in source is roughly y=470..770. Crop and place at the
    // canvas bottom strip so it sits in front of the player's feet, not the head.
    const sy = 470, sh = 320;
    const dh = Math.round(ch * 0.22);
    drawTiledHorizontal(nearImg, camera.x * 0.65, ch - dh, dh, sy, sh);
  }

  function drawVignette() {
    if (!vignetteCanvas) return;
    ctx.drawImage(vignetteCanvas, 0, 0);
  }

  // ─── Tiles ────────────────────────────────────────────────────────────────
  function drawTiles(level, camera, t) {
    const TS = level.tileSize;
    const x0 = Math.max(0, Math.floor(camera.x / TS));
    const x1 = Math.min(level.width, Math.ceil((camera.x + canvas.width) / TS));
    const y0 = Math.max(0, Math.floor(camera.y / TS));
    const y1 = Math.min(level.height, Math.ceil((camera.y + canvas.height) / TS));

    const T = Level.T;
    const NAMES = Level.TILE_NAMES;
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const tile = level.tiles[ty][tx];
        if (tile === T.EMPTY) continue;
        const px = tx * TS - camera.x;
        const py = ty * TS - camera.y;

        if (tile === T.SPIKE) {
          drawSpike(px, py, TS);
          continue;
        }

        const mapping = NAMES[tile];
        if (mapping) {
          Assets.drawTile(ctx, mapping[0], mapping[1], px, py, TS, TS);
        }

        // Animated overlays for select tiles (drawn on top of the static asset).
        if (tile === T.TORCH)  drawTorchFlame(px, py, tx, t);
        if (tile === T.WATER)  drawWaterShimmer(px, py, tx, t);
      }
    }
  }

  // Procedural spike (no asset; keeps the original chunky look).
  function drawSpike(px, py, TS) {
    const P = PALETTE;
    // 4 individual spikes scaled to a 32-px tile
    for (let i = 0; i < 4; i++) {
      const sx = px + i * 8;
      fr(sx + 2, py + 8, 4, 4, P.stoneLight);
      fr(sx + 2, py + 12, 4, 8, P.stoneHL);
      fr(sx + 1, py + 20, 6, 8, P.stoneMid);
      fr(sx + 1, py + 26, 6, 2, P.stoneDark);
    }
    fr(px, py + 28, TS, 4, P.stoneDark);
  }

  function drawTorchFlame(px, py, tx, t) {
    const P = PALETTE;
    const phase = Math.sin(t * 14 + tx) * 0.5 + 0.5;
    const size = phase > 0.5 ? 4 : 2;
    // glow halo
    ctx.fillStyle = P.flameGlow;
    ctx.fillRect(px + 8, py + 2, 16, 12);
    ctx.fillRect(px + 6, py + 4, 20, 8);
    // outer flame
    fr(px + 12, py + 8, 8, 8, P.flameDark);
    // inner flame
    fr(px + 14, py + 6 - size, 4, 8 + size, P.flameMid);
    // core
    fr(px + 14, py + 4, 4, 4, P.flameCore);
    if (phase > 0.6) fr(px + 14, py, 4, 2, P.flameMid);
  }

  function drawWaterShimmer(px, py, tx, t) {
    const P = PALETTE;
    const phase = Math.sin(t * 3 + tx * 0.4) * 2;
    fr(px + 4, py + 6 + phase, 6, 1, P.gemBlueHL);
    fr(px + 18, py + 12 - phase, 6, 1, P.gemBlueHL);
    fr(px + 8, py + 22 + phase, 4, 1, P.gemBlue);
  }

  // Per-animation feet position (fraction of cell height) measured by finding
  // the bottommost row in each cell with substantial body width (>=18 px).
  // The plain bottom-most-opaque pixel was unreliable for idle, where the
  // sword tip extends below the feet — the wide-row probe ignores those thin
  // protrusions and lands on the actual boot/leg silhouette instead.
  const PLAYER_FEET_REL = {
    idle:   0.766,
    run:    0.701,
    jump:   0.576,
    fall:   0.723,
    windup: 0.609,
    strike: 0.555,
    hurt:   0.504,
    death:  0.648,
  };

  // ─── Player ───────────────────────────────────────────────────────────────
  function drawPlayer(p, camera, t) {
    const T = Player.TUNING;

    if (p.invuln > 0 && Math.floor(p.invuln * T.HURT_FLASH_HZ) % 2 === 0) return;

    let anim = 'idle';
    if (p.state === Player.STATE.RUN)        anim = 'run';
    else if (p.state === Player.STATE.JUMP)  anim = 'jump';
    else if (p.state === Player.STATE.FALL)  anim = 'fall';
    else if (p.state === Player.STATE.HURT)  anim = 'hurt';
    else if (p.state === Player.STATE.DEAD)  anim = 'death';
    else if (p.state === Player.STATE.ATTACK) {
      const phase = (T.ATTACK_DURATION - p.attackTimer) / T.ATTACK_DURATION;
      anim = phase < 0.4 ? 'windup' : 'strike';
    }

    // offset_y so character feet (at SPRITE_H * feetRel from sprite top) land
    // at body bottom (= body.y + HEIGHT). Solve: sy + SPRITE_H*feetRel = body.y + HEIGHT.
    const feetRel = PLAYER_FEET_REL[anim] || 0.95;
    const dynOffsetY = T.HEIGHT - T.SPRITE_H * feetRel;

    const sx = Math.floor(p.x - camera.x) + T.SPRITE_OFFSET_X;
    const sy = Math.floor(p.y - camera.y) + dynOffsetY;

    Assets.drawSprite(ctx, 'player', anim, 0, sx, sy, T.SPRITE_W, T.SPRITE_H, p.facing < 0);
  }

  // ─── Pickups ──────────────────────────────────────────────────────────────
  function drawPickup(p, camera, t) {
    if (p.collected) return;
    const bob = Math.sin(t * 3 + p.bobPhase) * 3;
    const cx = Math.floor(p.x - camera.x);
    const cy = Math.floor(p.y - camera.y + bob);
    const dw = 32, dh = 32;
    Assets.drawSprite(ctx, 'pickups', p.type, 0, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  function drawCheckpoint(c, camera, t) {
    const x = Math.floor(c.x - camera.x);
    const y = Math.floor(c.y - camera.y);
    const dw = 32, dh = 48;
    Assets.drawSprite(ctx, 'pickups', 'checkpoint', 0, x, y, dw, dh);

    if (c.activated) {
      // Animated flame on top of the static checkpoint shrine
      const P = PALETTE;
      const phase = Math.sin(t * 14 + c.x) * 0.5 + 0.5;
      const size = phase > 0.5 ? 4 : 2;
      ctx.fillStyle = P.flameGlow;
      ctx.fillRect(x + 4, y - 4, 24, 16);
      ctx.fillRect(x + 0, y - 0, 32, 12);
      fr(x + 12, y - 0, 8, 8, P.flameDark);
      fr(x + 14, y - 2 - size, 4, 6 + size, P.flameMid);
      fr(x + 14, y - 4, 4, 4, P.flameCore);
      if (c.pulse > 0) {
        ctx.fillStyle = `rgba(255,224,164,${c.pulse * 0.6})`;
        ctx.fillRect(x - 12, y - 12, 56, 32);
      }
    }
  }

  // ─── Title screen ─────────────────────────────────────────────────────────
  function drawTitle(t) {
    clear();
    const ch = canvas.height, cw = canvas.width;

    // Auto-scrolling parallax using forest backgrounds
    const farImg = Assets.bgImage('forest_far');
    const midImg = Assets.bgImage('forest_mid');
    const nearImg = Assets.bgImage('forest_near');

    if (farImg) drawTiledHorizontal(farImg, t * 8, 0, ch);
    if (midImg) drawTiledHorizontal(midImg, t * 16, 0, ch);

    // Idle player figure under the title
    const T = Player.TUNING;
    const pX = cw / 2 - T.SPRITE_W / 2;
    const pY = ch - 96 + Math.floor(Math.sin(t * 2) * 1);
    Assets.drawSprite(ctx, 'player', 'idle', 0, pX, pY, T.SPRITE_W, T.SPRITE_H);

    if (nearImg) drawTiledHorizontal(nearImg, t * 32, 0, ch);

    drawVignette();

    const cx = cw / 2;
    // Title plate
    ctx.fillStyle = 'rgba(20,12,32,0.62)';
    ctx.fillRect(cx - 200, 36, 400, 96);
    ctx.strokeStyle = PALETTE.relicGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 200 + 1, 37, 398, 94);
    ctx.strokeStyle = 'rgba(244,201,82,0.35)';
    ctx.strokeRect(cx - 195 + 1, 42, 388, 84);

    ctx.fillStyle = PALETTE.relicGold;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EMBERS OF THE', cx, 76);
    ctx.fillStyle = PALETTE.relicGoldHL;
    ctx.font = 'bold 26px monospace';
    ctx.fillText('VERDANT KEEP', cx, 110);

    ctx.fillStyle = PALETTE.uiCream;
    ctx.font = '13px monospace';
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillText('PRESS  ENTER  TO  BEGIN', cx, 180);
    }
    ctx.fillStyle = 'rgba(244,236,208,0.45)';
    ctx.font = '11px monospace';
    ctx.fillText('ARROWS / WASD  MOVE   ·   SPACE  JUMP', cx, ch - 36);
    ctx.fillText('X / J  ATTACK   ·   M  MUTE', cx, ch - 20);
  }

  return {
    PALETTE,
    init,
    preloadSprites,
    clear,
    fr,
    drawParallax,
    drawForeground,
    drawVignette,
    drawTiles,
    drawPlayer,
    drawPickup,
    drawCheckpoint,
    drawTitle,
    get ctx() { return ctx; },
    get canvas() { return canvas; },
  };
})();
