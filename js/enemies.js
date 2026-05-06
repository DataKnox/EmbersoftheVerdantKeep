// enemies.js — slime, skeleton archer, wisp.
// Each carries its own state + AI. Combat lives in game.js (it owns the
// player + particles + audio dispatch). Enemies expose damage(), hitbox(),
// and a sprite-based draw routine.

const Enemies = (() => {
  // All pixel/velocity values doubled from the original 16-px-tile world.
  const ENEMY_TUNING = {
    slime:  { hp: 2, w: 28, h: 20, jumpVy: -360, jumpVx: 120, jumpInterval: 1.6, contactDmg: 1 },
    archer: { hp: 2, w: 20, h: 32, fireInterval: 2.1, arrowSpeed: 240, range: 440, contactDmg: 1 },
    wisp:   { hp: 1, w: 20, h: 20, chaseRange: 152, chaseAccel: 140, drag: 0.92, contactDmg: 1 },
  };

  // Sprite display rectangles per enemy type — each enemy_sheet cell is
  // 256×1024 (1:4 aspect), so we render at 32×128 to preserve that ratio.
  // feetRel is the fraction of cell height where the visible feet sit (measured
  // from the alpha-keyed PNG); used to align ground-anchored sprites so the
  // visible feet land at body.y + h instead of dh below it.
  const SPRITE = {
    slime:  { dw: 32, dh: 128, anchor: 'bottom', feetRel: 0.60 },
    archer: { dw: 32, dh: 128, anchor: 'bottom', feetRel: 0.67 },
    wisp:   { dw: 32, dh: 128, anchor: 'center' },
  };

  function create(type, cx, by) {
    const t = ENEMY_TUNING[type] || ENEMY_TUNING.slime;
    const x = cx - t.w / 2;
    const y = by - t.h;
    const base = {
      type,
      x, y,
      vx: 0, vy: 0,
      w: t.w, h: t.h,
      hp: t.hp,
      maxHp: t.hp,
      facing: -1,
      onGround: false,
      flash: 0,
      hurt: 0,
      knockback: 0,
      dead: false,
      animTime: 0,
      timer: 0,
      ax: x, ay: y,
    };
    if (type === 'slime')   return { ...base, jumpTimer: 0.4 + Math.random() };
    if (type === 'archer')  return { ...base, shootTimer: 0.8 + Math.random(), aimAngle: 0, drawing: 0, arrows: [] };
    if (type === 'wisp')    return { ...base, phase: Math.random() * Math.PI * 2, alpha: 0.85 };
    return base;
  }

  function damage(e, amount, sourceX) {
    if (e.dead) return false;
    e.hp = Math.max(0, e.hp - amount);
    e.flash = 0.12;
    e.hurt = 0.35;
    e.knockback = 0.22;
    if (sourceX !== undefined) {
      const dir = (e.x + e.w / 2) < sourceX ? -1 : 1;
      e.vx = dir * 140;
      if (e.type !== 'wisp') e.vy = -180;
    }
    if (e.hp <= 0) e.dead = true;
    return true;
  }

  function hitbox(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }

  // ─── Update ───────────────────────────────────────────────────────────────
  function update(list, dt, level, player) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.animTime += dt;
      if (e.flash > 0)   e.flash -= dt;
      if (e.hurt  > 0)   e.hurt  -= dt;
      if (e.knockback > 0) e.knockback -= dt;

      if (e.dead) {
        e.deathTimer = (e.deathTimer || 0) + dt;
        if (e.type === 'wisp') {
          e.vx *= 0.92; e.vy *= 0.92;
          e.x += e.vx * dt; e.y += e.vy * dt;
        } else {
          e.vy += 1200 * dt;
          e.x += e.vx * dt; e.y += e.vy * dt;
        }
        if (e.deathTimer > 0.45 || e.y > level.pixelHeight + 64) {
          list.splice(i, 1);
        }
        continue;
      }

      if (e.type === 'slime')  updateSlime(e, dt, level, player);
      if (e.type === 'archer') updateArcher(e, dt, level, player);
      if (e.type === 'wisp')   updateWisp(e, dt, level, player);

      if (e.arrows) updateArrows(e, dt, level);
    }
  }

  function updateSlime(e, dt, level, player) {
    if (!e.onGround) e.vy += 1400 * dt;
    if (e.vy > 640) e.vy = 640;

    e.jumpTimer -= dt;
    if (e.onGround && e.knockback <= 0 && e.jumpTimer <= 0) {
      const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
      const dist = Math.abs(dx);
      const dir = dist < 280 ? Math.sign(dx) || 1 : (Math.random() < 0.5 ? -1 : 1);
      e.vx = dir * 120;
      e.vy = -360;
      e.facing = dir < 0 ? -1 : 1;
      e.onGround = false;
      e.jumpTimer = 1.0 + Math.random() * 1.2;
      e.timer = 0;
    }
    if (e.onGround && e.knockback <= 0) e.vx *= 0.82;

    const flags = Level.moveAndCollide(level, e, e.vx * dt, e.vy * dt);
    if (flags.onGround) {
      if (!e.onGround && Math.abs(e.vy) > 200) e.timer = 0.15;
      e.onGround = true;
      e.vy = 0;
    } else {
      e.onGround = false;
    }
    if (flags.hitWall) e.vx *= -0.4;
  }

  function updateArcher(e, dt, level, player) {
    if (!e.onGround) e.vy += 1400 * dt;
    const flags = Level.moveAndCollide(level, e, e.vx * dt, e.vy * dt);
    if (flags.onGround) { e.onGround = true; e.vy = 0; }
    if (flags.hitWall)  e.vx *= -0.4;
    if (e.knockback <= 0) e.vx *= 0.85;

    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    const dy = (player.y + player.h / 2) - (e.y + 8);
    e.facing = dx < 0 ? -1 : 1;
    e.aimAngle = Math.atan2(dy, dx);

    const inRange = Math.abs(dx) < ENEMY_TUNING.archer.range && Math.abs(dy) < 200;
    if (inRange && e.knockback <= 0) {
      e.shootTimer -= dt;
      e.drawing = e.shootTimer < 0.4 ? 1 : 0;

      if (e.shootTimer <= 0) {
        const speed = ENEMY_TUNING.archer.arrowSpeed;
        const ang = e.aimAngle;
        e.arrows.push({
          x: e.x + e.w / 2 + Math.cos(ang) * 12,
          y: e.y + 8 + Math.sin(ang) * 8,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          life: 3.0,
          maxLife: 3.0,
          stuck: false,
        });
        e.shootTimer = ENEMY_TUNING.archer.fireInterval + Math.random() * 0.6;
        e.drawing = 0;
        if (typeof Audio !== 'undefined') Audio.play('arrow');
      }
    } else {
      e.drawing = 0;
    }
  }

  function updateWisp(e, dt, level, player) {
    e.phase += dt;
    const T = ENEMY_TUNING.wisp;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dx = px - ex, dy = py - ey;
    const dist = Math.hypot(dx, dy);

    if (dist < T.chaseRange && e.knockback <= 0) {
      e.vx += (dx / Math.max(0.1, dist)) * T.chaseAccel * dt;
      e.vy += (dy / Math.max(0.1, dist)) * T.chaseAccel * dt;
    } else {
      const aoff_x = Math.cos(e.phase * 0.7) * 48;
      const aoff_y = Math.sin(e.phase * 1.1) * 32;
      const tx = e.ax + aoff_x;
      const ty = e.ay + aoff_y;
      e.vx += (tx - e.x) * 1.2 * dt;
      e.vy += (ty - e.y) * 1.2 * dt;
    }
    e.vx *= T.drag;
    e.vy *= T.drag;
    const maxS = 180;
    e.vx = Math.max(-maxS, Math.min(maxS, e.vx));
    e.vy = Math.max(-maxS, Math.min(maxS, e.vy));
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  function updateArrows(e, dt, level) {
    for (let i = e.arrows.length - 1; i >= 0; i--) {
      const a = e.arrows[i];
      if (a.stuck) {
        a.life -= dt;
        if (a.life <= 0) e.arrows.splice(i, 1);
        continue;
      }
      a.vy += 440 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      if (a.life <= 0) { e.arrows.splice(i, 1); continue; }
      const tx = Math.floor(a.x / Level.TILE_SIZE);
      const ty = Math.floor(a.y / Level.TILE_SIZE);
      if (Level.isSolidAt(level, tx, ty)) {
        a.stuck = true;
        a.life = 0.8;
        a.vx = 0; a.vy = 0;
      }
    }
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────
  function pickAnim(e) {
    if (e.type === 'slime') {
      if (e.dead)                            return 'death';
      if (!e.onGround && e.vy < -80)         return 'bounce';
      if (!e.onGround && e.vy > 120)         return 'squash';
      if (e.timer > 0)                       return 'squash';
      return 'idle';
    }
    if (e.type === 'archer') {
      if (e.dead)                            return 'death';
      if (e.shootTimer !== undefined && e.shootTimer < 0.08) return 'shoot';
      if (e.drawing > 0)                     return 'draw';
      return 'idle';
    }
    if (e.type === 'wisp') {
      if (e.dead)                            return 'dissipate';
      if (e.knockback > 0)                   return 'puffed';
      if (Math.hypot(e.vx, e.vy) > 90)       return 'lunge';
      return 'float';
    }
    return 'idle';
  }

  function draw(ctx, list, camera) {
    for (const e of list) {
      drawEnemy(ctx, e, camera);
      if (e.arrows) for (const a of e.arrows) drawArrow(ctx, a, camera);
    }
  }

  function drawEnemy(ctx, e, camera) {
    const spec = SPRITE[e.type];
    if (!spec) return;
    const sx = Math.floor(e.x - camera.x);
    const sy = Math.floor(e.y - camera.y);
    const dw = spec.dw, dh = spec.dh;
    let dx, dy;
    if (spec.anchor === 'center') {
      dx = sx + (e.w - dw) / 2;
      dy = sy + (e.h - dh) / 2;
    } else { // bottom — feet land at body.y + h via feetRel
      dx = sx + (e.w - dw) / 2;
      dy = sy + e.h - dh * (spec.feetRel || 1.0);
    }
    const anim = pickAnim(e);
    Assets.drawSprite(ctx, e.type, anim, 0, dx, dy, dw, dh, e.facing < 0);

    // Hit flash — additive white wash over the sprite bounds while flashing
    if (e.flash > 0 && !e.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${(e.flash / 0.12) * 0.5})`;
      // Approximate sprite bounds (whole display rect — most is transparent so fine)
      ctx.fillRect(dx | 0, dy | 0, dw, dh);
      ctx.restore();
    }
  }

  function drawArrow(ctx, a, camera) {
    const P = Renderer.PALETTE;
    const x = a.x - camera.x;
    const y = a.y - camera.y;
    const ang = a.stuck ? a._stuckAng || (a._stuckAng = Math.atan2(a._lastVy || 0, a._lastVx || 1))
                        : Math.atan2(a.vy, a.vx);
    a._lastVx = a.vx; a._lastVy = a.vy;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // shaft (doubled length 8→16)
    ctx.fillStyle = P.arrowShaft;
    ctx.fillRect(-14, -1, 16, 2);
    // fletching
    ctx.fillStyle = P.uiCream;
    ctx.fillRect(-14, -3, 4, 1);
    ctx.fillRect(-14,  2, 4, 1);
    // head
    ctx.fillStyle = P.arrowHead;
    ctx.fillRect( 2, -2, 6, 4);
    ctx.fillStyle = P.stoneHL;
    ctx.fillRect( 6,  0, 2, 1);
    ctx.restore();
  }

  return { create, update, draw, damage, hitbox, ENEMY_TUNING };
})();
