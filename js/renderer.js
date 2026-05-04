// renderer.js — pixel-perfect rendering, procedural sprite drawing,
// parallax background, vignette, animated tiles.

const Renderer = (() => {
  // 16-bit-feel palette: SNES Castlevania / Secret of Mana mood.
  const PALETTE = {
    // sky / atmosphere
    skyTop:    '#1c1230',
    skyMid:    '#2c2148',
    skyHorizon:'#52345e',
    duskFog:   '#3d2452',
    starGold:  '#f4ecd0',
    starWhite: '#fff8e0',
    moonGlow:  '#fff8d8',

    // mountains
    mountainFar:  '#3a2a52',
    mountainMid:  '#2c2046',
    mountainNear: '#211737',
    mountainSnow: '#7a5e8e',

    // forest
    grassDark:  '#2d4a2b',
    grassMid:   '#4a7c3a',
    grassLight: '#6fa84a',
    grassHL:    '#a8d460',
    leafDark:   '#1f3a22',
    leafMid:    '#345f2c',
    leafLight:  '#558a3c',
    leafHL:     '#7eb44a',
    barkDark:   '#2a1c14',
    barkMid:    '#3a261a',
    barkLight:  '#4a3526',
    dirtDark:   '#3a2418',
    dirtMid:    '#5a3a24',
    dirtLight:  '#7a5236',

    // stone / castle
    stoneDark:  '#2a2735',
    stoneMid:   '#454458',
    stoneLight: '#6a6a82',
    stoneHL:    '#8c8ca8',
    bridgeDark: '#3d2e22',
    bridgeMid:  '#5e4632',
    bridgeLight:'#7a5d42',

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

    // player
    cloakDark:  '#2a1638',
    cloakMid:   '#4a2856',
    cloakLight: '#6b3e7a',
    cloakHL:    '#8a5fa0',
    skin:       '#e8b48c',
    skinShadow: '#a47a5c',
    bootDark:   '#1c1018',
    bootLight:  '#3a242e',
    bladeDark:  '#8c8ca8',
    bladeLight: '#d8dcec',
    bladeHL:    '#ffffff',
    hiltGold:   '#c69a3e',
    hiltGoldHL: '#f0c870',

    // enemies
    slimeDark:  '#2a4a44',
    slimeMid:   '#4d8a7a',
    slimeLight: '#7ec8a8',
    slimeHL:    '#bff0d8',
    skeleBone:  '#e8e0c0',
    skeleBoneShadow: '#a89c78',
    skeleCloth: '#3a2848',
    arrowShaft: '#7a5236',
    arrowHead:  '#a8a8b8',
    wispCore:   '#c0e8ff',
    wispMid:    '#7ab8e0',
    wispDark:   '#3a5a8a',

    black:  '#0a070e',
    white:  '#ffffff',
  };

  let canvas, ctx;
  let parallaxFar, parallaxMid, parallaxNear; // offscreen canvases
  let vignetteCanvas;

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
  }

  function preloadSprites() {
    bakeParallax();
    bakeVignette();
  }

  // ─── Parallax: three offscreen canvases scrolled at different rates ──────
  function bakeParallax() {
    parallaxFar  = makeFarLayer();
    parallaxMid  = makeMidLayer();
    parallaxNear = makeNearLayer();
  }

  // Distant mountains + moon + stars (very wide, slow scroll)
  function makeFarLayer() {
    const w = 480, h = 192;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');

    // stars
    const rand = mulberry32(13);
    cx.fillStyle = PALETTE.starWhite;
    for (let i = 0; i < 30; i++) {
      cx.fillRect((rand() * w) | 0, (rand() * h * 0.55) | 0, 1, 1);
    }
    cx.fillStyle = PALETTE.starGold;
    for (let i = 0; i < 14; i++) {
      cx.fillRect((rand() * w) | 0, (rand() * h * 0.5) | 0, 1, 1);
    }

    // moon — soft glow + crescent
    const mx = 80, my = 30, mr = 12;
    cx.globalAlpha = 0.18;
    cx.fillStyle = PALETTE.moonGlow;
    for (let r = mr + 14; r > mr; r -= 2) {
      cx.beginPath();
      cx.arc(mx, my, r, 0, Math.PI * 2);
      cx.fill();
    }
    cx.globalAlpha = 1;
    cx.fillStyle = PALETTE.moonGlow;
    cx.beginPath(); cx.arc(mx, my, mr, 0, Math.PI * 2); cx.fill();
    // shadow (crescent)
    cx.fillStyle = PALETTE.skyMid;
    cx.beginPath(); cx.arc(mx + 4, my - 2, mr, 0, Math.PI * 2); cx.fill();

    // far mountains (darkest) — tall jagged silhouette
    drawMountains(cx, w, h, h * 0.35, h * 0.78, PALETTE.mountainFar, 23, 28);
    // mid-far layer with snow caps
    drawMountains(cx, w, h, h * 0.50, h * 0.88, PALETTE.mountainMid, 19, 24, true);

    return c;
  }

  function drawMountains(cx, w, h, baseY, maxY, color, peakCount, jaggedness, snowCap = false) {
    const rng = mulberry32(peakCount * 1000 + 7);
    cx.fillStyle = color;
    cx.beginPath();
    cx.moveTo(0, h);
    let lastY = baseY;
    const peaks = [];
    for (let i = 0; i <= peakCount; i++) {
      const x = (i / peakCount) * w;
      const variance = (rng() - 0.5) * jaggedness * 2;
      const y = baseY + variance + (rng() - 0.5) * 12;
      peaks.push({ x, y: Math.min(maxY, Math.max(baseY - jaggedness * 1.6, y)) });
    }
    cx.moveTo(peaks[0].x, peaks[0].y);
    for (let i = 1; i < peaks.length; i++) {
      // jagged edge — small mid-points for serration
      const a = peaks[i - 1], b = peaks[i];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2 + (rng() - 0.5) * 3;
      cx.lineTo(midX, midY);
      cx.lineTo(b.x, b.y);
    }
    cx.lineTo(w, h);
    cx.lineTo(0, h);
    cx.closePath();
    cx.fill();

    if (snowCap) {
      cx.fillStyle = PALETTE.mountainSnow;
      for (const p of peaks) {
        if (p.y < baseY - 4) {
          cx.fillRect((p.x - 3) | 0, (p.y) | 0, 6, 2);
          cx.fillRect((p.x - 1) | 0, (p.y - 1) | 0, 2, 1);
        }
      }
    }
  }

  // Mid-ground forest silhouette
  function makeMidLayer() {
    const w = 480, h = 192;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');

    const rng = mulberry32(42);
    // hills
    cx.fillStyle = PALETTE.mountainNear;
    cx.beginPath();
    cx.moveTo(0, h);
    let y = h * 0.55;
    for (let x = 0; x <= w; x += 4) {
      const ny = h * 0.55 + Math.sin(x * 0.04) * 8 + Math.sin(x * 0.11) * 4;
      cx.lineTo(x, ny);
    }
    cx.lineTo(w, h); cx.lineTo(0, h); cx.closePath(); cx.fill();

    // Trees on the hill
    for (let i = 0; i < 80; i++) {
      const tx = (rng() * w) | 0;
      const baseY = h * 0.55 + Math.sin(tx * 0.04) * 8 + Math.sin(tx * 0.11) * 4;
      drawSilhouetteTree(cx, tx, baseY, 6 + (rng() * 6) | 0, PALETTE.leafDark);
    }
    // Closer trees
    for (let i = 0; i < 32; i++) {
      const tx = (rng() * w) | 0;
      const baseY = h * 0.78 + (rng() * 6);
      drawSilhouetteTree(cx, tx, baseY, 10 + (rng() * 10) | 0, PALETTE.leafMid);
    }
    return c;
  }

  function drawSilhouetteTree(cx, x, baseY, size, color) {
    cx.fillStyle = color;
    // trunk
    cx.fillRect(x, baseY - size * 0.25, 1, size * 0.25);
    // canopy: stacked rectangles forming triangle-ish silhouette
    const top = baseY - size;
    for (let dy = 0; dy < size * 0.85; dy++) {
      const w = ((size - dy) * 0.6) | 0;
      cx.fillRect(x - (w >> 1), top + dy, w, 1);
    }
  }

  // Near foreground — silhouetted ferns + grass tufts
  function makeNearLayer() {
    const w = 480, h = 64;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');

    const rng = mulberry32(99);
    cx.fillStyle = PALETTE.leafDark;
    for (let i = 0; i < 90; i++) {
      const x = (rng() * w) | 0;
      const baseY = h - 4 + (rng() * 6 - 3) | 0;
      const tall = 4 + ((rng() * 7) | 0);
      // fern stem
      cx.fillRect(x, baseY - tall, 1, tall);
      // fronds
      for (let j = 0; j < tall; j += 2) {
        const len = 2 + ((tall - j) >> 1);
        cx.fillRect(x - len, baseY - tall + j, len, 1);
        cx.fillRect(x + 1, baseY - tall + j, len, 1);
      }
    }
    // grass tufts
    cx.fillStyle = PALETTE.grassDark;
    for (let i = 0; i < 60; i++) {
      const x = (rng() * w) | 0;
      const baseY = h - 1;
      const t = 2 + ((rng() * 4) | 0);
      cx.fillRect(x, baseY - t, 1, t);
      cx.fillRect(x + 1, baseY - t + 1, 1, t - 1);
      cx.fillRect(x - 1, baseY - t + 1, 1, t - 1);
    }
    return c;
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

  // ─── Per-frame drawing ────────────────────────────────────────────────────

  function clear() {
    const h = canvas.height, w = canvas.width;
    // Three-stop sky band (cheaper than gradient per frame)
    ctx.fillStyle = PALETTE.skyTop;     ctx.fillRect(0, 0, w, h * 0.40);
    ctx.fillStyle = PALETTE.skyMid;     ctx.fillRect(0, h * 0.40, w, h * 0.45);
    ctx.fillStyle = PALETTE.skyHorizon; ctx.fillRect(0, h * 0.85, w, h * 0.15);
  }

  function drawParallax(camera, levelW) {
    const cw = canvas.width, ch = canvas.height;

    // Far layer (mountains + moon) — 0.15 scroll factor
    if (parallaxFar) {
      const fw = parallaxFar.width, fh = parallaxFar.height;
      const ox = (-camera.x * 0.12) % fw;
      const o2 = ox > 0 ? ox - fw : ox;
      ctx.drawImage(parallaxFar, o2 | 0, ch - fh - 4);
      ctx.drawImage(parallaxFar, (o2 + fw) | 0, ch - fh - 4);
      ctx.drawImage(parallaxFar, (o2 + 2 * fw) | 0, ch - fh - 4);
    }
    // Mid layer (forest silhouette) — 0.35 scroll
    if (parallaxMid) {
      const mw = parallaxMid.width;
      const ox = (-camera.x * 0.32) % mw;
      const o2 = ox > 0 ? ox - mw : ox;
      ctx.drawImage(parallaxMid, o2 | 0, ch - parallaxMid.height + 8);
      ctx.drawImage(parallaxMid, (o2 + mw) | 0, ch - parallaxMid.height + 8);
      ctx.drawImage(parallaxMid, (o2 + 2 * mw) | 0, ch - parallaxMid.height + 8);
    }
    // Near layer (ferns) — 0.6 scroll, drawn near bottom
    // Note: we draw foreground ferns AFTER tiles in game.js (drawForeground)
  }

  function drawForeground(camera) {
    if (!parallaxNear) return;
    const cw = canvas.width, ch = canvas.height;
    const nw = parallaxNear.width;
    const ox = (-camera.x * 0.65) % nw;
    const o2 = ox > 0 ? ox - nw : ox;
    ctx.drawImage(parallaxNear, o2 | 0, ch - parallaxNear.height + 6);
    ctx.drawImage(parallaxNear, (o2 + nw) | 0, ch - parallaxNear.height + 6);
    ctx.drawImage(parallaxNear, (o2 + 2 * nw) | 0, ch - parallaxNear.height + 6);
  }

  function drawVignette() {
    if (!vignetteCanvas) return;
    ctx.drawImage(vignetteCanvas, 0, 0);
  }

  // Solid fill helper
  function fr(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  // Tile drawing — direct fillRect art per tile.
  // `t` is a global time accumulator passed in from game.js for animation.
  function drawTiles(level, camera, t) {
    const TS = level.tileSize;
    const x0 = Math.max(0, Math.floor(camera.x / TS));
    const x1 = Math.min(level.width, Math.ceil((camera.x + canvas.width) / TS));
    const y0 = Math.max(0, Math.floor(camera.y / TS));
    const y1 = Math.min(level.height, Math.ceil((camera.y + canvas.height) / TS));

    const T = Level.T;
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const tile = level.tiles[ty][tx];
        if (tile === T.EMPTY) continue;
        const px = tx * TS - camera.x;
        const py = ty * TS - camera.y;

        switch (tile) {
          case T.GRASS:    drawGrass(px, py, tx, ty); break;
          case T.DIRT:     drawDirt(px, py, tx, ty); break;
          case T.BRIDGE:   drawBridge(px, py, tx, ty); break;
          case T.STONE:    drawStone(px, py, tx, ty); break;
          case T.STONE_BG: drawStoneBg(px, py); break;
          case T.CASTLE_TOP: drawCastleTop(px, py, tx); break;
          case T.SPIKE:    drawSpike(px, py); break;
          case T.TREE:     drawTree(px, py, tx, ty, t); break;
          case T.FOLIAGE:  drawFoliage(px, py, tx, t); break;
          case T.TORCH:    drawTorch(px, py, tx, t); break;
          case T.BANNER:   drawBanner(px, py, tx, t); break;
          case T.PILLAR:   drawPillar(px, py); break;
          case T.WATER:    drawWater(px, py, tx, t); break;
        }
      }
    }
  }

  function drawGrass(px, py, tx, ty) {
    const P = PALETTE;
    fr(px, py, 16, 4, P.grassMid);
    fr(px, py + 4, 16, 12, P.dirtMid);
    // grass blades on top
    const seed = (tx * 13 + ty * 7) % 8;
    fr(px + 1, py, 1, 1, P.grassHL);
    fr(px + 4 + (seed % 2), py, 1, 1, P.grassHL);
    fr(px + 9 + ((seed >> 1) % 2), py, 1, 1, P.grassHL);
    fr(px + 13, py, 1, 1, P.grassHL);
    // shading at the seam
    fr(px, py + 3, 16, 1, P.grassDark);
    fr(px, py + 4, 16, 1, P.dirtDark);
    // dirt texture
    fr(px + 3, py + 8, 1, 1, P.dirtDark);
    fr(px + 11, py + 12, 1, 1, P.dirtDark);
    fr(px + 6 + (seed % 4), py + 6, 1, 1, P.dirtLight);
  }

  function drawDirt(px, py, tx, ty) {
    const P = PALETTE;
    fr(px, py, 16, 16, P.dirtMid);
    const seed = (tx * 17 + ty * 31) & 0xff;
    // top edge gradient (only when there's no grass above)
    fr(px + (seed & 7),     py + 2, 1, 1, P.dirtLight);
    fr(px + ((seed >> 3) & 7) + 8, py + 5, 1, 1, P.dirtDark);
    fr(px + 2 + ((seed >> 1) & 7),  py + 10, 1, 1, P.dirtDark);
    fr(px + 4 + ((seed >> 2) & 7),  py + 13, 1, 1, P.dirtDark);
    fr(px + ((seed) & 11),  py + 7, 1, 1, P.dirtLight);
  }

  function drawBridge(px, py, tx, ty) {
    const P = PALETTE;
    fr(px, py, 16, 1, P.bridgeLight);
    fr(px, py + 1, 16, 4, P.bridgeMid);
    fr(px, py + 5, 16, 11, P.bridgeDark);
    // plank seams
    const off = (tx & 1) ? 5 : 7;
    fr(px + off, py, 1, 16, P.black);
    // wood grain marks
    const g = (tx * 11) & 7;
    fr(px + 2 + g, py + 8, 1, 1, P.bridgeMid);
    fr(px + 9 + ((g + 3) & 5), py + 11, 1, 1, P.bridgeMid);
    // nails on top corners
    fr(px + 1, py + 1, 1, 1, P.stoneDark);
    fr(px + 14, py + 1, 1, 1, P.stoneDark);
  }

  function drawStone(px, py, tx, ty) {
    const P = PALETTE;
    fr(px, py, 16, 16, P.stoneMid);
    // top edge highlight
    fr(px, py, 16, 1, P.stoneLight);
    fr(px, py + 15, 16, 1, P.stoneDark);
    // brick seam pattern
    const offset = (ty & 1) ? 0 : 8;
    fr(px + offset, py, 1, 8, P.stoneDark);
    fr(px + ((offset + 8) & 15), py + 8, 1, 8, P.stoneDark);
    fr(px, py + 7, 16, 1, P.stoneDark);
    // small highlights
    const seed = (tx * 7 + ty * 13) & 7;
    fr(px + 3 + (seed & 3), py + 2, 1, 1, P.stoneHL);
    fr(px + 9 + (seed & 1), py + 10, 1, 1, P.stoneHL);
  }

  function drawStoneBg(px, py) {
    const P = PALETTE;
    fr(px, py, 16, 16, P.stoneDark);
    fr(px + 5, py + 6, 1, 1, P.stoneMid);
    fr(px + 11, py + 11, 1, 1, P.stoneMid);
  }

  function drawCastleTop(px, py, tx) {
    const P = PALETTE;
    // body of crenellation
    fr(px, py + 4, 16, 12, P.stoneMid);
    fr(px, py + 4, 16, 1, P.stoneLight);
    fr(px, py + 15, 16, 1, P.stoneDark);
    // alternating crenellations on top
    const high = (tx & 1) === 0;
    if (high) {
      fr(px, py, 16, 4, P.stoneMid);
      fr(px, py, 16, 1, P.stoneLight);
    } else {
      fr(px, py, 6, 4, P.stoneMid);
      fr(px + 10, py, 6, 4, P.stoneMid);
      fr(px, py, 6, 1, P.stoneLight);
      fr(px + 10, py, 6, 1, P.stoneLight);
    }
    // brick seam mid
    fr(px + 7, py + 8, 1, 8, P.stoneDark);
  }

  function drawSpike(px, py) {
    const P = PALETTE;
    // 4 individual spikes triangular
    for (let i = 0; i < 4; i++) {
      const sx = px + i * 4;
      // tip
      fr(sx + 1, py + 4, 2, 2, P.stoneLight);
      // shaft tapering
      fr(sx + 1, py + 6, 2, 4, P.stoneHL);
      fr(sx, py + 10, 4, 4, P.stoneMid);
      fr(sx, py + 13, 4, 1, P.stoneDark);
    }
    // base plate
    fr(px, py + 14, 16, 2, P.stoneDark);
  }

  function drawTree(px, py, tx, ty, t) {
    const P = PALETTE;
    // tree silhouette layered. Slight wind sway.
    const sway = Math.floor(Math.sin(t * 0.5 + tx * 0.6 + ty * 0.3) * 0.6);
    fr(px + 4 + sway, py, 9, 4, P.leafDark);
    fr(px + 2 + sway, py + 2, 12, 6, P.leafDark);
    fr(px + 3 + sway, py + 1, 4, 1, P.leafMid);
    fr(px + 8 + sway, py + 3, 3, 1, P.leafMid);
    fr(px + 5 + sway, py + 4, 2, 1, P.leafLight);
    fr(px + 4 + sway, py + 6, 8, 4, P.leafDark);
    fr(px + 6 + sway, py + 7, 4, 2, P.leafMid);
    // trunk
    fr(px + 7, py + 9, 2, 7, P.barkDark);
    fr(px + 7, py + 9, 1, 7, P.barkMid);
  }

  function drawFoliage(px, py, tx, t) {
    const P = PALETTE;
    const sway = Math.floor(Math.sin(t * 1.2 + tx * 0.7) * 0.6);
    fr(px + 2 + sway, py + 12, 1, 4, P.grassMid);
    fr(px + 3 + sway, py + 14, 2, 2, P.grassDark);
    fr(px + 6, py + 10, 1, 6, P.grassMid);
    fr(px + 7, py + 12, 2, 4, P.grassDark);
    fr(px + 6, py + 9, 1, 1, P.grassHL);
    fr(px + 10 - sway, py + 13, 1, 3, P.grassMid);
    fr(px + 11 - sway, py + 14, 2, 2, P.grassDark);
  }

  function drawTorch(px, py, tx, t) {
    const P = PALETTE;
    // wall sconce
    fr(px + 6, py + 8, 4, 7, P.barkDark);
    fr(px + 5, py + 7, 6, 1, P.barkMid);
    fr(px + 6, py + 8, 1, 7, P.barkLight);
    // animated flame — flickers in size
    const phase = Math.sin(t * 14 + tx) * 0.5 + 0.5;
    const size = phase > 0.5 ? 2 : 1;
    // glow halo
    ctx.fillStyle = P.flameGlow;
    ctx.fillRect(px + 4, py + 1, 8, 6);
    ctx.fillRect(px + 3, py + 2, 10, 4);
    // outer flame
    fr(px + 6, py + 4, 4, 4, P.flameDark);
    // inner flame
    fr(px + 7, py + 3 - size, 2, 4 + size, P.flameMid);
    // core
    fr(px + 7, py + 2, 2, 2, P.flameCore);
    // tip flicker
    if (phase > 0.6) fr(px + 7, py, 2, 1, P.flameMid);
  }

  function drawBanner(px, py, tx, t) {
    const P = PALETTE;
    // hanging rod
    fr(px + 4, py, 8, 1, P.barkDark);
    // banner body — wave with sin
    for (let row = 0; row < 13; row++) {
      const wave = Math.floor(Math.sin(t * 2 + row * 0.4 + tx * 0.5) * 0.8);
      fr(px + 5 + wave, py + 1 + row, 6, 1, P.heartRed);
      fr(px + 5 + wave, py + 1 + row, 1, 1, P.flameDark);
      fr(px + 10 + wave, py + 1 + row, 1, 1, P.heartDark);
    }
    // sigil — small gold cross
    const wave = Math.floor(Math.sin(t * 2 + 3 * 0.4 + tx * 0.5) * 0.8);
    fr(px + 7 + wave, py + 5, 2, 1, P.relicGold);
    fr(px + 7 + wave, py + 7, 2, 1, P.relicGold);
    fr(px + 6 + wave, py + 6, 4, 1, P.relicGold);
    fr(px + 7 + wave, py + 6, 2, 1, P.relicGoldHL);
    // bottom tassels
    const waveB = Math.floor(Math.sin(t * 2 + 14 * 0.4 + tx * 0.5) * 0.8);
    fr(px + 5 + waveB, py + 14, 1, 2, P.heartRed);
    fr(px + 8 + waveB, py + 14, 1, 2, P.heartRed);
    fr(px + 10 + waveB, py + 14, 1, 2, P.heartRed);
  }

  function drawPillar(px, py) {
    const P = PALETTE;
    fr(px + 4, py, 8, 16, P.stoneDark);
    fr(px + 4, py, 1, 16, P.stoneMid);
    fr(px + 11, py, 1, 16, P.stoneDark);
    fr(px + 4, py, 8, 1, P.stoneMid);
    fr(px + 4, py + 15, 8, 1, P.stoneDark);
    // some weathering
    fr(px + 6, py + 4, 1, 1, P.stoneMid);
    fr(px + 9, py + 9, 1, 1, P.stoneMid);
  }

  function drawWater(px, py, tx, t) {
    const P = PALETTE;
    fr(px, py, 16, 16, P.gemBlueDark);
    const phase = Math.sin(t * 3 + tx * 0.4) * 1;
    fr(px + 2, py + 3 + phase, 4, 1, P.gemBlue);
    fr(px + 9, py + 6 - phase, 4, 1, P.gemBlue);
    fr(px + 4, py + 11 + phase, 3, 1, P.gemBlueHL);
    fr(px + 11, py + 13 - phase, 3, 1, P.gemBlueHL);
  }

  // ─── Player drawing ───────────────────────────────────────────────────────
  function drawPlayer(p, camera, t) {
    const T = Player.TUNING;
    const sx = Math.floor(p.x - camera.x) + T.SPRITE_OFFSET_X;
    const sy = Math.floor(p.y - camera.y) + T.SPRITE_OFFSET_Y;

    // Hurt flash: blink off every other frame during invuln.
    if (p.invuln > 0 && Math.floor(p.invuln * T.HURT_FLASH_HZ) % 2 === 0) return;

    ctx.save();
    if (p.facing < 0) {
      ctx.translate(sx + 16, sy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, sy);
    }
    paintPlayer(p, t);
    ctx.restore();
  }

  function paintPlayer(p, t) {
    const P = PALETTE;
    const state = p.state;
    let bob = 0;
    if (state === Player.STATE.IDLE) bob = Math.floor(Math.sin(t * 2) * 0.5);
    if (state === Player.STATE.RUN) {
      const f = p.runFrame & 3;
      bob = (f === 1 || f === 3) ? -1 : 0;
    }
    if (state === Player.STATE.JUMP) bob = -1;
    if (state === Player.STATE.FALL) bob = 1;

    // Hood (dark)
    fr(6, 1 + bob, 4, 1, P.cloakDark);
    fr(5, 2 + bob, 6, 1, P.cloakDark);
    fr(4, 3 + bob, 8, 1, P.cloakDark);
    fr(4, 4 + bob, 1, 3, P.cloakDark);
    fr(11, 4 + bob, 1, 3, P.cloakDark);
    fr(4, 7 + bob, 8, 1, P.cloakDark);

    // Hood interior (slight mid for depth on the cheeks)
    fr(5, 4 + bob, 1, 2, P.cloakMid);
    fr(10, 4 + bob, 1, 2, P.cloakMid);

    // Face inside hood
    fr(6, 4 + bob, 4, 2, P.skin);
    fr(8, 5 + bob, 1, 1, P.skinShadow);  // eye/mouth shadow
    fr(7, 6 + bob, 3, 1, P.skin);

    // Cloak shoulders
    fr(4, 7 + bob, 8, 1, P.cloakDark);
    fr(3, 8 + bob, 10, 1, P.cloakMid);
    fr(3, 8 + bob, 1, 1, P.cloakDark);
    fr(12, 8 + bob, 1, 1, P.cloakDark);

    // Cloak body
    fr(3, 9 + bob, 10, 6, P.cloakMid);
    fr(3, 9 + bob, 1, 6, P.cloakDark);   // left shadow edge
    fr(12, 9 + bob, 1, 6, P.cloakDark);  // right shadow edge
    fr(4, 9 + bob, 1, 1, P.cloakLight);  // small hood-shoulder light
    fr(4, 14 + bob, 8, 1, P.cloakDark);  // hem shadow

    // Cloak skirt taper
    fr(4, 15, 8, 1, P.cloakMid);
    fr(4, 15, 1, 1, P.cloakDark);
    fr(11, 15, 1, 1, P.cloakDark);

    // Sword (hilt + blade — drawn vertically against cloak right side)
    if (state !== Player.STATE.ATTACK) {
      // sheathed/held vertical
      fr(11, 9 + bob, 1, 1, P.bladeDark);
      fr(11, 10 + bob, 1, 1, P.hiltGold);
      fr(11, 11 + bob, 1, 1, P.hiltGoldHL);
      fr(11, 12 + bob, 1, 1, P.hiltGold);
      fr(11, 13 + bob, 1, 1, P.bladeDark);
      fr(11, 14 + bob, 1, 1, P.bladeLight);
      fr(11, 15, 1, 1, P.bladeLight);
      fr(11, 16, 1, 1, P.bladeHL);
    } else {
      paintSwordSwing(p);
    }

    // Legs / boots
    let legPose = 'still';
    if (state === Player.STATE.RUN) {
      const f = p.runFrame & 3;
      legPose = (f === 0 || f === 2) ? 'apart' : 'together';
    } else if (state === Player.STATE.JUMP) {
      legPose = 'tucked';
    } else if (state === Player.STATE.FALL) {
      legPose = 'apart';
    }

    if (legPose === 'apart' || legPose === 'still') {
      // both feet apart
      fr(4, 16, 2, 2, P.cloakDark);
      fr(10, 16, 2, 2, P.cloakDark);
      fr(4, 18, 2, 1, P.bootLight);
      fr(10, 18, 2, 1, P.bootLight);
      fr(4, 19, 2, 1, P.bootDark);
      fr(10, 19, 2, 1, P.bootDark);
    } else if (legPose === 'together') {
      // narrower stance
      fr(5, 16, 6, 2, P.cloakDark);
      fr(5, 18, 6, 1, P.bootLight);
      fr(5, 19, 6, 1, P.bootDark);
    } else if (legPose === 'tucked') {
      // mid-jump tuck
      fr(5, 16, 6, 2, P.cloakDark);
      fr(5, 17, 1, 1, P.cloakLight);
      fr(5, 18, 6, 1, P.bootLight);
      fr(5, 19, 6, 1, P.bootDark);
    }
  }

  // Sword swing — extended forward across active frames
  function paintSwordSwing(p) {
    const T = Player.TUNING;
    const P = PALETTE;
    const phase = (T.ATTACK_DURATION - p.attackTimer) / T.ATTACK_DURATION;
    // 3 visual stages: windup (0-0.2), strike (0.2-0.65), recover (0.65-1)
    if (phase < 0.2) {
      // windup — sword raised back
      fr(11, 7, 1, 1, P.bladeDark);
      fr(11, 8, 1, 1, P.hiltGold);
      fr(11, 5, 1, 4, P.bladeLight);  // pointing up-back
      fr(11, 4, 1, 1, P.bladeHL);
    } else if (phase < 0.7) {
      // strike — sword horizontal forward
      fr(12, 9, 1, 1, P.hiltGold);
      fr(12, 10, 1, 1, P.hiltGoldHL);
      // blade extends from x=13 to x=20 horizontal
      fr(13, 9, 6, 1, P.bladeDark);
      fr(13, 10, 7, 1, P.bladeLight);
      fr(15, 10, 5, 1, P.bladeHL);
      fr(13, 11, 6, 1, P.bladeDark);
      // motion arc above
      fr(14, 8, 5, 1, P.bladeLight);
      fr(15, 7, 3, 1, P.bladeHL);
    } else {
      // recover — sword angled forward-down
      fr(12, 11, 1, 1, P.hiltGold);
      fr(13, 11, 5, 1, P.bladeLight);
      fr(13, 12, 4, 1, P.bladeDark);
      fr(15, 11, 3, 1, P.bladeHL);
    }
  }

  // ─── Pickup / checkpoint drawing ──────────────────────────────────────────
  function drawPickup(p, camera, t) {
    if (p.collected) return;
    const bob = Math.sin(t * 3 + p.bobPhase) * 1.5;
    // p.x, p.y = center; each draw routine offsets to its own bounding box
    const cx = Math.floor(p.x - camera.x);
    const cy = Math.floor(p.y - camera.y + bob);
    if (p.type === 'gem')   drawGem(cx, cy, t);
    if (p.type === 'heart') drawHeart(cx, cy, t);
    if (p.type === 'relic') drawRelic(cx, cy, t);
  }

  function drawGem(cx, cy, t) {
    const P = PALETTE;
    const x = cx - 3, y = cy - 4;       // 6 wide × 7 tall sprite
    const blink = Math.floor(t * 6) % 8 === 0;
    if (blink) {
      ctx.fillStyle = 'rgba(168,230,240,0.18)';
      ctx.fillRect(x - 4, y - 1, 14, 9);
    }
    fr(x + 2, y, 2, 1, P.gemBlueHL);
    fr(x + 1, y + 1, 4, 1, P.gemBlue);
    fr(x, y + 2, 6, 2, P.gemBlue);
    fr(x + 1, y + 2, 1, 1, P.gemBlueHL);
    fr(x, y + 4, 6, 1, P.gemBlueDark);
    fr(x + 1, y + 5, 4, 1, P.gemBlueDark);
    fr(x + 2, y + 6, 2, 1, P.gemBlueDark);
    const sp = (Math.floor(t * 4) % 4);
    const sx = x + [0, 5, 5, 0][sp];
    const sy = y + [0, 0, 6, 6][sp];
    fr(sx, sy, 1, 1, P.white);
  }

  function drawHeart(cx, cy, t) {
    const P = PALETTE;
    const x = cx - 3, y = cy - 3;       // 7 wide × 7 tall
    const pulse = Math.floor(t * 3) % 2 === 0;
    const c = pulse ? P.heartRed : P.heartHL;
    fr(x + 1, y + 1, 2, 1, c);
    fr(x + 4, y + 1, 2, 1, c);
    fr(x, y + 2, 7, 2, c);
    fr(x + 1, y + 4, 5, 1, c);
    fr(x + 2, y + 5, 3, 1, c);
    fr(x + 3, y + 6, 1, 1, c);
    fr(x + 1, y + 2, 1, 1, P.heartHL);
    fr(x + 2, y + 2, 1, 1, P.heartHL);
    fr(x, y + 3, 1, 1, P.heartDark);
  }

  function drawRelic(cx, cy, t) {
    const P = PALETTE;
    const x = cx - 5, y = cy - 5;       // 10 wide × 10 tall
    const shimmer = (Math.floor(t * 8) % 4);
    // soft golden glow
    ctx.fillStyle = 'rgba(255,242,176,0.18)';
    ctx.fillRect(x - 3, y - 1, 16, 11);
    fr(x + 2, y, 6, 1, P.relicGoldDark);
    fr(x + 1, y + 1, 8, 1, P.relicGold);
    fr(x + 2, y + 2, 6, 4, P.relicGold);
    fr(x + 2, y + 2, 1, 4, P.relicGoldHL);
    fr(x + 7, y + 2, 1, 4, P.relicGoldDark);
    fr(x + 3, y + 3, 4, 1, P.relicGoldHL);
    fr(x + 4, y + 6, 2, 2, P.relicGoldDark);
    fr(x + 3, y + 8, 4, 1, P.relicGoldDark);
    // central gem
    fr(x + 4, y + 4, 2, 1, P.heartRed);
    fr(x + 4, y + 4, 1, 1, P.heartHL);
    // rotating shimmer pixel
    const sx = x + [9, -1, 0, 8][shimmer];
    const sy = y + [0, 2, 7, 7][shimmer];
    fr(sx, sy, 1, 1, P.white);
    fr(sx - 1, sy, 1, 1, P.relicGoldHL);
    fr(sx + 1, sy, 1, 1, P.relicGoldHL);
  }

  function drawCheckpoint(c, camera, t) {
    const P = PALETTE;
    const x = Math.floor(c.x - camera.x);
    const y = Math.floor(c.y - camera.y);
    // stake
    fr(x + 4, y + 6, 2, 12, P.barkDark);
    fr(x + 4, y + 6, 1, 12, P.barkLight);
    // basin top
    fr(x + 1, y + 4, 8, 3, P.stoneMid);
    fr(x + 1, y + 4, 8, 1, P.stoneLight);
    fr(x + 1, y + 6, 8, 1, P.stoneDark);
    if (c.activated) {
      // animated bright flame
      const phase = Math.sin(t * 14 + c.x) * 0.5 + 0.5;
      const size = phase > 0.5 ? 2 : 1;
      ctx.fillStyle = P.flameGlow;
      ctx.fillRect(x - 2, y - 2, 14, 8);
      ctx.fillRect(x - 4, y, 18, 6);
      fr(x + 2, y, 6, 4, P.flameDark);
      fr(x + 3, y - size, 4, 4 + size, P.flameMid);
      fr(x + 4, y - 1, 2, 3, P.flameCore);
      // pulse ring
      if (c.pulse > 0) {
        ctx.fillStyle = `rgba(255,224,164,${c.pulse})`;
        ctx.fillRect(x - 6, y - 4, 22, 14);
      }
    } else {
      // unlit — wisp of smoke / faint coal
      fr(x + 4, y + 2, 2, 2, P.uiPurpleDk);
      fr(x + 4, y + 1, 2, 1, P.stoneDark);
    }
  }

  // ─── Title screen ─────────────────────────────────────────────────────────
  function drawTitle(t) {
    clear();
    const ch = canvas.height, cw = canvas.width;

    // Slow auto-scrolling parallax
    if (parallaxFar) {
      const fw = parallaxFar.width;
      const ox = (-(t * 4) % fw + fw) % fw - fw;
      ctx.drawImage(parallaxFar, ox | 0, ch - parallaxFar.height - 4);
      ctx.drawImage(parallaxFar, (ox + fw) | 0, ch - parallaxFar.height - 4);
      ctx.drawImage(parallaxFar, (ox + fw * 2) | 0, ch - parallaxFar.height - 4);
    }
    if (parallaxMid) {
      const mw = parallaxMid.width;
      const ox = (-(t * 8) % mw + mw) % mw - mw;
      ctx.drawImage(parallaxMid, ox | 0, ch - parallaxMid.height + 8);
      ctx.drawImage(parallaxMid, (ox + mw) | 0, ch - parallaxMid.height + 8);
      ctx.drawImage(parallaxMid, (ox + mw * 2) | 0, ch - parallaxMid.height + 8);
    }

    // Foreground ground strip (so the player figure has somewhere to stand)
    fr(0, ch - 28, cw, 4, PALETTE.grassMid);
    fr(0, ch - 24, cw, 4, PALETTE.dirtMid);
    fr(0, ch - 20, cw, 20, PALETTE.dirtDark);
    // grass blades
    for (let x = 4; x < cw; x += 7) {
      fr(x + ((x * 13 + (t * 30 | 0)) % 5), ch - 28, 1, 1, PALETTE.grassHL);
    }

    // Idle player figure under the title
    const pX = cw / 2 - 8;
    const pY = ch - 28 - 20 + Math.floor(Math.sin(t * 2) * 0.6);
    drawTitlePlayer(pX, pY, t);

    if (parallaxNear) {
      const nw = parallaxNear.width;
      const ox = (-(t * 16) % nw + nw) % nw - nw;
      ctx.drawImage(parallaxNear, ox | 0, ch - parallaxNear.height + 6);
      ctx.drawImage(parallaxNear, (ox + nw) | 0, ch - parallaxNear.height + 6);
      ctx.drawImage(parallaxNear, (ox + nw * 2) | 0, ch - parallaxNear.height + 6);
    }

    drawVignette();

    const cx = cw / 2;
    // Title plate
    ctx.fillStyle = 'rgba(20,12,32,0.62)';
    ctx.fillRect(cx - 112, 22, 224, 56);
    ctx.strokeStyle = PALETTE.relicGold;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 112 + 0.5, 22.5, 223, 55);
    // inner decorative line
    ctx.strokeStyle = 'rgba(244,201,82,0.35)';
    ctx.strokeRect(cx - 109 + 0.5, 25.5, 217, 49);

    ctx.fillStyle = PALETTE.relicGold;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EMBERS OF THE', cx, 44);
    ctx.fillStyle = PALETTE.relicGoldHL;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('VERDANT KEEP', cx, 62);

    ctx.fillStyle = PALETTE.uiCream;
    ctx.font = '7px monospace';
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillText('PRESS  ENTER  TO  BEGIN', cx, 110);
    }
    ctx.fillStyle = 'rgba(244,236,208,0.45)';
    ctx.fillText('ARROWS / WASD  MOVE   ·   SPACE  JUMP', cx, ch - 28);
    ctx.fillText('X / J  ATTACK   ·   M  MUTE', cx, ch - 18);
  }

  // Standalone idle figure for the title screen.
  function drawTitlePlayer(sx, sy, t) {
    ctx.save();
    ctx.translate(sx, sy);
    const bob = Math.floor(Math.sin(t * 2) * 0.5);
    paintPlayerStanding(t, bob);
    ctx.restore();
  }

  function paintPlayerStanding(t, bob) {
    const P = PALETTE;
    // identical to paintPlayer's idle rendering (kept inline so title screen
    // doesn't need a real Player object)
    fr(6, 1 + bob, 4, 1, P.cloakDark);
    fr(5, 2 + bob, 6, 1, P.cloakDark);
    fr(4, 3 + bob, 8, 1, P.cloakDark);
    fr(4, 4 + bob, 1, 3, P.cloakDark);
    fr(11, 4 + bob, 1, 3, P.cloakDark);
    fr(4, 7 + bob, 8, 1, P.cloakDark);
    fr(5, 4 + bob, 1, 2, P.cloakMid);
    fr(10, 4 + bob, 1, 2, P.cloakMid);
    fr(6, 4 + bob, 4, 2, P.skin);
    fr(8, 5 + bob, 1, 1, P.skinShadow);
    fr(7, 6 + bob, 3, 1, P.skin);
    fr(4, 7 + bob, 8, 1, P.cloakDark);
    fr(3, 8 + bob, 10, 1, P.cloakMid);
    fr(3, 8 + bob, 1, 1, P.cloakDark);
    fr(12, 8 + bob, 1, 1, P.cloakDark);
    fr(3, 9 + bob, 10, 6, P.cloakMid);
    fr(3, 9 + bob, 1, 6, P.cloakDark);
    fr(12, 9 + bob, 1, 6, P.cloakDark);
    fr(4, 9 + bob, 1, 1, P.cloakLight);
    fr(4, 14 + bob, 8, 1, P.cloakDark);
    fr(4, 15, 8, 1, P.cloakMid);
    fr(4, 15, 1, 1, P.cloakDark);
    fr(11, 15, 1, 1, P.cloakDark);
    // sword
    fr(11, 9 + bob, 1, 1, P.bladeDark);
    fr(11, 10 + bob, 1, 1, P.hiltGold);
    fr(11, 11 + bob, 1, 1, P.hiltGoldHL);
    fr(11, 12 + bob, 1, 1, P.hiltGold);
    fr(11, 13 + bob, 1, 1, P.bladeDark);
    fr(11, 14 + bob, 1, 1, P.bladeLight);
    fr(11, 15, 1, 1, P.bladeLight);
    fr(11, 16, 1, 1, P.bladeHL);
    // legs/boots
    fr(4, 16, 2, 2, P.cloakDark);
    fr(10, 16, 2, 2, P.cloakDark);
    fr(4, 18, 2, 1, P.bootLight);
    fr(10, 18, 2, 1, P.bootLight);
    fr(4, 19, 2, 1, P.bootDark);
    fr(10, 19, 2, 1, P.bootDark);
  }

  // ─── Misc helpers ─────────────────────────────────────────────────────────
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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
