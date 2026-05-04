// renderer.js — pixel-perfect rendering, sprite atlas generation, parallax, vignette.
// Stub: just clears to a placeholder color until later commits add real visuals.

const Renderer = (() => {
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
    leafDark:   '#1f3a22',
    leafMid:    '#345f2c',
    leafLight:  '#558a3c',
    barkDark:   '#2a1c14',
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
  let dpr = 1;

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
  }

  function preloadSprites() {
    // Built in a later commit
  }

  function clear() {
    ctx.fillStyle = PALETTE.skyTop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    drawTitlePlaceholder,
    get ctx() { return ctx; },
    get canvas() { return canvas; },
  };
})();
