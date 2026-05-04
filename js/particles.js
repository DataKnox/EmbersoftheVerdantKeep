// particles.js — lightweight particle system. Each particle is a small object;
// kinds: 'spark', 'dust', 'ember', 'leaf', 'slash', 'bone', 'goo'.

const Particles = (() => {
  const MAX = 400;

  function create() {
    return { list: [] };
  }

  function update(sys, dt) {
    const list = sys.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      if (p.ax) p.vx += p.ax * dt;
      if (p.ay) p.vy += p.ay * dt;
      // air drag
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.angle = (p.angle || 0) + p.spin * dt;
    }
  }

  function draw(ctx, sys, camera) {
    const list = sys.list;
    for (const p of list) {
      const x = Math.floor(p.x - camera.x);
      const y = Math.floor(p.y - camera.y);
      const lifeT = p.life / (p.maxLife || p.life);
      const fade = Math.max(0, Math.min(1, lifeT));

      switch (p.kind) {
        case 'spark': {
          const sz = p.size || (lifeT > 0.5 ? 2 : 1);
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, sz, sz);
          if (lifeT > 0.7) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, 1, 1);
          }
          break;
        }
        case 'dust': {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 2, 1);
          ctx.fillRect(x + 1, y + 1, 1, 1);
          break;
        }
        case 'ember': {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 1, 1);
          if (Math.random() < 0.4) {
            ctx.fillStyle = '#fde0a3';
            ctx.fillRect(x, y, 1, 1);
          }
          break;
        }
        case 'leaf': {
          const phase = Math.sin((p.angle || 0) * 4);
          const w = phase > 0 ? 2 : 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, w, 2);
          break;
        }
        case 'slash': {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, p.size || 3, 1);
          break;
        }
        case 'bone': {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 2, 1);
          ctx.fillRect(x, y + 1, 1, 2);
          break;
        }
        case 'goo': {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 2, 2);
          ctx.fillRect(x + 1, y + 1, 1, 1);
          break;
        }
        default: {
          ctx.fillStyle = p.color || '#ffffff';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  function spawn(sys, p) {
    if (sys.list.length > MAX) sys.list.shift();
    if (!('maxLife' in p)) p.maxLife = p.life;
    sys.list.push(p);
  }

  // Convenience burst: called from many places
  function burst(sys, x, y, opts = {}) {
    const count = opts.count || 8;
    const speed = opts.speed || 80;
    const colors = opts.colors || ['#ffffff'];
    const kind = opts.kind || 'spark';
    const ay = opts.ay !== undefined ? opts.ay : 200;
    const life = opts.life || 0.45;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 0.6) * speed;
      spawn(sys, {
        x, y,
        vx: Math.cos(a) * v + (opts.vx || 0),
        vy: Math.sin(a) * v + (opts.vy || 0),
        ay,
        drag: opts.drag,
        life: life * (0.5 + Math.random() * 0.8),
        kind,
        color: colors[(Math.random() * colors.length) | 0],
        size: opts.size,
      });
    }
  }

  return { create, update, draw, spawn, burst };
})();
