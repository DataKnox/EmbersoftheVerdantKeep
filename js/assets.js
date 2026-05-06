// assets.js — manifest-driven PNG preload and draw helpers.
// Reads assets/manifest.json, loads every PNG referenced, and exposes
// drawSprite/drawTile/drawUI/drawBg helpers that resolve names → src rects
// + ctx.drawImage.

const Assets = (() => {
  let manifest = null;
  const images = {};   // path → HTMLImageElement
  let ready = false;

  // Returns a promise that resolves once manifest + every image is loaded.
  function init() {
    return fetch('assets/manifest.json')
      .then(r => r.json())
      .then(m => {
        manifest = m;
        const paths = collectPaths(m);
        return Promise.all(paths.map(loadImage));
      })
      .then(() => { ready = true; });
  }

  function collectPaths(m) {
    const set = new Set();
    for (const kind of ['sheets', 'tiles', 'ui', 'backgrounds']) {
      if (!m[kind]) continue;
      for (const entry of Object.values(m[kind])) {
        if (entry && entry.src) set.add(entry.src);
      }
    }
    return [...set];
  }

  function loadImage(relPath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { images[relPath] = img; resolve(img); };
      img.onerror = () => reject(new Error('asset load failed: ' + relPath));
      img.src = 'assets/' + relPath;
    });
  }

  // ─── Lookups ────────────────────────────────────────────────────────────────
  function image(kind, name) {
    const e = manifest && manifest[kind] && manifest[kind][name];
    if (!e) return null;
    return images[e.src] || null;
  }

  function spriteRect(sheetName, anim, frame = 0) {
    const e = manifest.sheets[sheetName];
    if (!e) return null;
    const cells = e.anims && e.anims[anim];
    if (!cells || cells.length === 0) return null;
    const [cx, cy] = cells[frame % cells.length];
    return { x: cx * e.cell.w, y: cy * e.cell.h, w: e.cell.w, h: e.cell.h };
  }

  function tileRect(tilesetName, tileName) {
    const e = manifest.tiles[tilesetName];
    if (!e) return null;
    const cell = e.names && e.names[tileName];
    if (!cell) return null;
    const [cx, cy] = cell;
    return { x: cx * e.cell.w, y: cy * e.cell.h, w: e.cell.w, h: e.cell.h };
  }

  function uiRect(sheetName, cellName) {
    const e = manifest.ui[sheetName];
    if (!e) return null;
    return (e.cells && e.cells[cellName]) || null;
  }

  // ─── Draw helpers ───────────────────────────────────────────────────────────
  // All accept ctx, then name lookups, then dst rect (dx,dy,dw,dh), optional flipX.
  function drawSprite(ctx, sheetName, anim, frame, dx, dy, dw, dh, flipX = false) {
    const img = image('sheets', sheetName);
    const r = spriteRect(sheetName, anim, frame);
    if (!img || !r) return;
    if (flipX) {
      ctx.save();
      ctx.translate((dx + dw) | 0, dy | 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, r.x, r.y, r.w, r.h, dx | 0, dy | 0, dw, dh);
    }
  }

  function drawTile(ctx, tilesetName, tileName, dx, dy, dw, dh) {
    const img = image('tiles', tilesetName);
    const r = tileRect(tilesetName, tileName);
    if (!img || !r) return;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, dx | 0, dy | 0, dw, dh);
  }

  function drawUI(ctx, sheetName, cellName, dx, dy, dw, dh) {
    const img = image('ui', sheetName);
    const r = uiRect(sheetName, cellName);
    if (!img || !r) return;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, dx | 0, dy | 0, dw, dh);
  }

  function bgImage(name) {
    return image('backgrounds', name);
  }

  return {
    init,
    isReady: () => ready,
    image,
    drawSprite, drawTile, drawUI,
    bgImage,
    get manifest() { return manifest; },
  };
})();
