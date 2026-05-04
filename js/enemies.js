// enemies.js — slime / archer / wisp.
// Real AI + sprites added in a later commit. For now, just create + stub.

const Enemies = (() => {
  function create(type, x, y) {
    const base = {
      type,
      x, y,
      vx: 0, vy: 0,
      w: 12, h: 12,
      hp: 1,
      facing: -1,
      onGround: false,
      flash: 0,
      hurt: 0,
      dead: false,
      animTime: 0,
      timer: 0,
      // anchor for AI patterns
      ax: x, ay: y,
    };
    if (type === 'slime')   return { ...base, w: 14, h: 10, hp: 2, jumpTimer: 0 };
    if (type === 'archer')  return { ...base, w: 10, h: 16, hp: 2, shootTimer: 1.0, arrows: [] };
    if (type === 'wisp')    return { ...base, w: 10, h: 10, hp: 1, phase: Math.random() * Math.PI * 2 };
    return base;
  }

  function update(list, dt, level, player) {
    // stubbed (real AI in a later commit)
    for (const e of list) {
      e.animTime += dt;
      if (e.flash > 0) e.flash -= dt;
    }
  }

  function draw(ctx, list, camera) {
    // stubbed
  }

  return { create, update, draw };
})();
