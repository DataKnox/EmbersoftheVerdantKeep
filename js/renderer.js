// renderer.js — pixel-perfect rendering, sprite atlas generation, parallax, vignette.

const Renderer = (() => {
  // 16-bit-feel palette: SNES Castlevania / Secret of Mana mood.
  const PALETTE = {
    // sky / atmosphere
    skyTop:    '#1c1230',
    skyMid:    '#2c2148',
    skyHorizon:'#52345e',
    duskFog:   '#3d2452',

    // mountains
    mountainFar:  '#3a2a52',
    mountainMid:  '#2c2046',
    mountainNear: '#211737',

    // forest
    grassDark:  '#2d4a2b',
    grassMid:   '#4a7c3a',
    grassLight: '#6fa84a',
    grassHL:    '#a8d460',
    leafDark:   '#1f3a22',
    leafMid:    '#345f2c',
    leafLight:  '#558a3c',
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

    // gems / pickups
    gemBlue:    '#5ec1d8',
    gemBlueHL:  '#a8e6f0',
    heartRed:   '#d9433f',
    heartHL:    '#ff7d6a',
    relicGold:  '#f4c952',
    relicGoldHL:'#fff2b0',

    // ui
    uiCream:    '#f4ecd0',
    uiDark:     '#1a1224',
    uiPurple:   '#5e4382',

    // player
    cloakDark:  '#2a1638',
    cloakMid:   '#4a2856',
    cloakLight: '#6b3e7a',
    skin:       '#e8b48c',
    skinShadow: '#a47a5c',
    bootDark:   '#2c1a18',
    bootLight:  '#4a2e26',
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

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
  }

  function preloadSprites() {
    // Built in a later commit — currently using direct draw routines.
  }

  function clear() {
    // Vertical sky gradient using 3 bands (no expensive linear-gradient calls per frame)
    const h = canvas.height;
    ctx.fillStyle = PALETTE.skyTop;       ctx.fillRect(0, 0, canvas.width, h * 0.35);
    ctx.fillStyle = PALETTE.skyMid;       ctx.fillRect(0, h * 0.35, canvas.width, h * 0.45);
    ctx.fillStyle = PALETTE.skyHorizon;   ctx.fillRect(0, h * 0.80, canvas.width, h);
  }

  // Solid fill helper
  function fr(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function drawTilesPlaceholder(level, camera) {
    const TS = level.tileSize;
    const x0 = Math.max(0, Math.floor(camera.x / TS));
    const x1 = Math.min(level.width, Math.ceil((camera.x + canvas.width) / TS));
    const y0 = Math.max(0, Math.floor(camera.y / TS));
    const y1 = Math.min(level.height, Math.ceil((camera.y + canvas.height) / TS));

    const T = Level.T;
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const t = level.tiles[ty][tx];
        if (t === T.EMPTY) continue;
        const px = tx * TS - camera.x;
        const py = ty * TS - camera.y;

        switch (t) {
          case T.GRASS:
            fr(px, py, 16, 4, PALETTE.grassMid);
            fr(px, py, 16, 1, PALETTE.grassHL);
            fr(px, py + 4, 16, 12, PALETTE.dirtMid);
            break;
          case T.DIRT:
            fr(px, py, 16, 16, PALETTE.dirtMid);
            // sprinkle dark pixels for texture
            fr(px + 3, py + 4, 2, 2, PALETTE.dirtDark);
            fr(px + 11, py + 9, 2, 2, PALETTE.dirtDark);
            fr(px + 6, py + 12, 2, 2, PALETTE.dirtDark);
            break;
          case T.BRIDGE:
            fr(px, py, 16, 5, PALETTE.bridgeLight);
            fr(px, py + 5, 16, 5, PALETTE.bridgeMid);
            fr(px, py + 10, 16, 6, PALETTE.bridgeDark);
            // plank seams
            fr(px + 5, py, 1, 16, PALETTE.bridgeDark);
            fr(px + 11, py, 1, 16, PALETTE.bridgeDark);
            break;
          case T.STONE:
            fr(px, py, 16, 16, PALETTE.stoneMid);
            fr(px, py, 16, 1, PALETTE.stoneLight);
            fr(px, py + 15, 16, 1, PALETTE.stoneDark);
            fr(px + 7, py, 1, 16, PALETTE.stoneDark);
            break;
          case T.STONE_BG:
            fr(px, py, 16, 16, PALETTE.stoneDark);
            break;
          case T.CASTLE_TOP:
            // crenellated battlement
            fr(px, py + 4, 16, 12, PALETTE.stoneMid);
            fr(px, py + 4, 16, 1, PALETTE.stoneLight);
            fr(px, py + 15, 16, 1, PALETTE.stoneDark);
            fr(px, py, 6, 6, PALETTE.stoneMid);
            fr(px + 10, py, 6, 6, PALETTE.stoneMid);
            fr(px, py, 6, 1, PALETTE.stoneLight);
            fr(px + 10, py, 6, 1, PALETTE.stoneLight);
            break;
          case T.SPIKE:
            // triangular spikes pointing up
            for (let i = 0; i < 4; i++) {
              const sx = px + i * 4;
              fr(sx + 1, py + 8,  2, 8, PALETTE.stoneLight);
              fr(sx + 1, py + 6,  2, 2, PALETTE.stoneHL);
              fr(sx,     py + 12, 4, 4, PALETTE.stoneMid);
            }
            fr(px, py + 14, 16, 2, PALETTE.stoneDark);
            break;
          case T.TREE:
            // stylized leafy tree silhouette: layered blobs
            fr(px + 4, py, 8, 12, PALETTE.leafMid);
            fr(px + 2, py + 2, 12, 8, PALETTE.leafMid);
            fr(px + 4, py + 1, 2, 1, PALETTE.leafLight);
            fr(px + 9, py + 3, 2, 1, PALETTE.leafLight);
            fr(px + 5, py + 8, 6, 4, PALETTE.leafDark);
            fr(px + 7, py + 11, 2, 5, PALETTE.barkMid);
            break;
          case T.FOLIAGE:
            fr(px + 4, py + 12, 2, 4, PALETTE.grassMid);
            fr(px + 7, py + 10, 2, 6, PALETTE.grassMid);
            fr(px + 10, py + 13, 2, 3, PALETTE.grassMid);
            fr(px + 7, py + 9, 1, 1, PALETTE.grassHL);
            break;
          case T.TORCH:
            // wall sconce — animated flame is drawn separately in animation pass
            fr(px + 6, py + 8, 4, 6, PALETTE.barkLight);
            fr(px + 5, py + 7, 6, 1, PALETTE.barkMid);
            // base flame (placeholder; will animate later)
            fr(px + 7, py + 3, 2, 5, PALETTE.flameMid);
            fr(px + 7, py + 1, 2, 2, PALETTE.flameCore);
            break;
          case T.BANNER:
            fr(px + 5, py, 6, 1, PALETTE.stoneDark);
            fr(px + 6, py + 1, 4, 11, PALETTE.heartRed);
            fr(px + 6, py + 1, 1, 11, PALETTE.flameDark);
            fr(px + 7, py + 4, 2, 2, PALETTE.relicGold);
            fr(px + 6, py + 12, 1, 2, PALETTE.heartRed);
            fr(px + 9, py + 12, 1, 2, PALETTE.heartRed);
            break;
          case T.PILLAR:
            // background stone pillar under bridge
            fr(px + 4, py, 8, 16, PALETTE.stoneDark);
            fr(px + 4, py, 1, 16, PALETTE.stoneMid);
            fr(px + 11, py, 1, 16, PALETTE.stoneMid);
            break;
        }
      }
    }
  }

  function drawTitlePlaceholder(t) {
    ctx.fillStyle = PALETTE.skyTop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PALETTE.uiCream;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EMBERS OF THE VERDANT KEEP', canvas.width / 2, canvas.height / 2 - 8);
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillText('PRESS ENTER', canvas.width / 2, canvas.height / 2 + 12);
    }
  }

  return {
    PALETTE,
    init,
    preloadSprites,
    clear,
    fr,
    drawTilesPlaceholder,
    drawTitlePlaceholder,
    get ctx() { return ctx; },
    get canvas() { return canvas; },
  };
})();
