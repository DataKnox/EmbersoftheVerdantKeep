// particles.js — ring-buffered particle system. Stub for now.

const Particles = (() => {
  function create() {
    return { list: [] };
  }

  function update(sys, dt) {
    const list = sys.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vx += (p.ax || 0) * dt;
      p.vy += (p.ay || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.angle = (p.angle || 0) + p.spin * dt;
    }
  }

  function draw(ctx, sys, camera) {
    // Stub
  }

  function spawn(sys, p) {
    sys.list.push(p);
  }

  return { create, update, draw, spawn };
})();
