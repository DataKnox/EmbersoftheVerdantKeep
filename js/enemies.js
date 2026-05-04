// enemies.js — slime, skeleton archer, wisp.
// Each carries its own state + AI. Combat lives in game.js (it owns the
// player + particles + audio dispatch). Enemies expose damage(), hitbox(),
// and a per-type drawXxx routine.

const Enemies = (() => {
  const ENEMY_TUNING = {
    slime: { hp: 2, w: 14, h: 10, jumpVy: -180, jumpVx: 60, jumpInterval: 1.6, contactDmg: 1 },
    archer:{ hp: 2, w: 10, h: 16, fireInterval: 2.1, arrowSpeed: 120, range: 220, contactDmg: 1 },
    wisp:  { hp: 1, w: 10, h: 10, chaseRange: 76, chaseAccel: 70, drag: 0.92, contactDmg: 1 },
  };

  function create(type, cx, by) {
    // cx,by = bottom-center spawn point (as written in level data)
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
      flash: 0,                 // hit-flash timer (sprite goes white)
      hurt: 0,                  // post-hit recovery
      knockback: 0,             // remaining knockback time
      dead: false,
      animTime: 0,
      timer: 0,
      ax: x, ay: y,             // anchor for hover/return
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
      e.vx = dir * 70;
      if (e.type !== 'wisp') e.vy = -90;  // slime/archer pop up; wisp just floats
    }
    if (e.hp <= 0) e.dead = true;
    return true;
  }

  // AABB hitbox (for collision tests)
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
        // Death tumble — gravity for ground enemies, gentle fade for wisps.
        e.deathTimer = (e.deathTimer || 0) + dt;
        if (e.type === 'wisp') {
          e.vx *= 0.92; e.vy *= 0.92;
          e.x += e.vx * dt; e.y += e.vy * dt;
        } else {
          e.vy += 600 * dt;
          e.x += e.vx * dt; e.y += e.vy * dt;
        }
        if (e.deathTimer > 0.45 || e.y > level.pixelHeight + 32) {
          list.splice(i, 1);
        }
        continue;
      }

      if (e.type === 'slime')  updateSlime(e, dt, level, player);
      if (e.type === 'archer') updateArcher(e, dt, level, player);
      if (e.type === 'wisp')   updateWisp(e, dt, level, player);

      // Update any owned projectiles
      if (e.arrows) updateArrows(e, dt, level);
    }
  }

  function updateSlime(e, dt, level, player) {
    // gravity
    if (!e.onGround) e.vy += 700 * dt;
    if (e.vy > 320) e.vy = 320;

    // jump cadence
    e.jumpTimer -= dt;
    if (e.onGround && e.knockback <= 0 && e.jumpTimer <= 0) {
      const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
      const dist = Math.abs(dx);
      const dir = dist < 140 ? Math.sign(dx) || 1 : (Math.random() < 0.5 ? -1 : 1);
      e.vx = dir * 60;
      e.vy = -180;
      e.facing = dir < 0 ? -1 : 1;
      e.onGround = false;
      e.jumpTimer = 1.0 + Math.random() * 1.2;
      e.timer = 0;
    }
    // friction on the ground
    if (e.onGround && e.knockback <= 0) e.vx *= 0.82;

    const flags = Level.moveAndCollide(level, e, e.vx * dt, e.vy * dt);
    if (flags.onGround) {
      if (!e.onGround && Math.abs(e.vy) > 100) e.timer = 0.15; // landing pause
      e.onGround = true;
      e.vy = 0;
    } else {
      e.onGround = false;
    }
    if (flags.hitWall) e.vx *= -0.4;
  }

  function updateArcher(e, dt, level, player) {
    // gravity / fall
    if (!e.onGround) e.vy += 700 * dt;
    const flags = Level.moveAndCollide(level, e, e.vx * dt, e.vy * dt);
    if (flags.onGround) { e.onGround = true; e.vy = 0; }
    if (flags.hitWall)  e.vx *= -0.4;
    if (e.knockback <= 0) e.vx *= 0.85;

    // face player
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    const dy = (player.y + player.h / 2) - (e.y + 4);
    e.facing = dx < 0 ? -1 : 1;
    e.aimAngle = Math.atan2(dy, dx);

    // shoot pacing
    const inRange = Math.abs(dx) < ENEMY_TUNING.archer.range && Math.abs(dy) < 100;
    if (inRange && e.knockback <= 0) {
      e.shootTimer -= dt;
      // drawing animation in last 0.4s before fire
      const drawAt = ENEMY_TUNING.archer.fireInterval - 0.4;
      e.drawing = e.shootTimer < 0.4 ? 1 : 0;

      if (e.shootTimer <= 0) {
        const speed = ENEMY_TUNING.archer.arrowSpeed;
        const ang = e.aimAngle;
        e.arrows.push({
          x: e.x + e.w / 2 + Math.cos(ang) * 6,
          y: e.y + 4 + Math.sin(ang) * 4,
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
      // gentle return to anchor with sinusoidal hover
      const aoff_x = Math.cos(e.phase * 0.7) * 24;
      const aoff_y = Math.sin(e.phase * 1.1) * 16;
      const tx = e.ax + aoff_x;
      const ty = e.ay + aoff_y;
      e.vx += (tx - e.x) * 1.2 * dt;
      e.vy += (ty - e.y) * 1.2 * dt;
    }
    e.vx *= T.drag;
    e.vy *= T.drag;
    // clamp
    const maxS = 90;
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
      a.vy += 220 * dt;
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
  function draw(ctx, list, camera) {
    for (const e of list) {
      if (e.type === 'slime')  drawSlime(ctx, e, camera);
      if (e.type === 'archer') drawArcher(ctx, e, camera);
      if (e.type === 'wisp')   drawWisp(ctx, e, camera);
      if (e.arrows) for (const a of e.arrows) drawArrow(ctx, a, camera);
    }
  }

  function applyFlash(ctx) {
    ctx.fillStyle = '#ffffff';
    return true;
  }

  function drawSlime(ctx, e, camera) {
    const P = Renderer.PALETTE;
    const x = Math.floor(e.x - camera.x);
    const y = Math.floor(e.y - camera.y);
    const flash = e.flash > 0;

    // squash / stretch
    let sw = e.w, sh = e.h;
    let yo = 0;
    if (e.dead) {
      // splatted
      sw = e.w + 4; sh = 4; yo = e.h - 4;
    } else if (!e.onGround) {
      if (e.vy < -40)      { sw = e.w - 2; sh = e.h + 3; yo = -1; }    // stretched up
      else if (e.vy > 60)  { sw = e.w - 1; sh = e.h + 2; yo = -1; }    // stretched down
    } else if (e.timer > 0) {
      sw = e.w + 3; sh = Math.max(4, e.h - 2); yo = e.h - sh; // landing squash
    }
    const dx = x + Math.floor((e.w - sw) / 2);
    const dy = y + yo;

    const body  = flash ? '#ffffff' : P.slimeMid;
    const dark  = flash ? '#ffffff' : P.slimeDark;
    const light = flash ? '#ffffff' : P.slimeLight;
    const hl    = flash ? '#ffffff' : P.slimeHL;

    // body: rounded rect
    Renderer.fr(dx + 1, dy + 1, sw - 2, sh - 2, body);
    Renderer.fr(dx + 2, dy, sw - 4, 1, body);
    Renderer.fr(dx + 2, dy + sh - 1, sw - 4, 1, body);
    Renderer.fr(dx, dy + 2, 1, sh - 4, body);
    Renderer.fr(dx + sw - 1, dy + 2, 1, sh - 4, body);
    // shaded belly
    Renderer.fr(dx + 1, dy + sh - 2, sw - 2, 1, dark);
    Renderer.fr(dx + 2, dy + sh - 1, sw - 4, 1, dark);
    // top highlight droplet
    Renderer.fr(dx + 3, dy + 1, 3, 1, light);
    Renderer.fr(dx + 3, dy + 2, 1, 1, hl);
    Renderer.fr(dx + 4, dy + 2, 1, 1, hl);
    if (!e.dead) {
      // eyes
      const eyeY = dy + Math.floor(sh / 2) - 1;
      Renderer.fr(dx + 4, eyeY, 1, 2, P.uiDark);
      Renderer.fr(dx + sw - 5, eyeY, 1, 2, P.uiDark);
      // tiny pupils glint
      if (!flash) {
        Renderer.fr(dx + 4, eyeY, 1, 1, '#ffffff');
        Renderer.fr(dx + sw - 5, eyeY, 1, 1, '#ffffff');
      }
    }
  }

  function drawArcher(ctx, e, camera) {
    const P = Renderer.PALETTE;
    const x = Math.floor(e.x - camera.x);
    const y = Math.floor(e.y - camera.y);
    const flash = e.flash > 0;
    const bone  = flash ? '#ffffff' : P.skeleBone;
    const boneS = flash ? '#ffffff' : P.skeleBoneShadow;
    const cloth = flash ? '#ffffff' : P.skeleCloth;
    const wood  = flash ? '#ffffff' : P.barkLight;

    ctx.save();
    if (e.facing < 0) {
      ctx.translate(x + e.w, y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, y);
    }
    // skull (rows 0-4)
    Renderer.fr(2, 0, 6, 1, bone);
    Renderer.fr(1, 1, 8, 4, bone);
    Renderer.fr(1, 2, 1, 1, boneS);
    Renderer.fr(8, 2, 1, 1, boneS);
    // eye sockets
    Renderer.fr(2, 2, 2, 2, P.uiDark);
    Renderer.fr(6, 2, 2, 2, P.uiDark);
    if (!flash) {
      // glowing pupils
      Renderer.fr(3, 2, 1, 1, P.flameMid);
      Renderer.fr(7, 2, 1, 1, P.flameMid);
    }
    // jaw line
    Renderer.fr(2, 4, 6, 1, boneS);
    Renderer.fr(3, 5, 1, 1, P.uiDark);
    Renderer.fr(5, 5, 1, 1, P.uiDark);
    // shoulders cloth
    Renderer.fr(1, 6, 8, 1, cloth);
    Renderer.fr(0, 7, 10, 1, cloth);
    // ribcage
    Renderer.fr(1, 7, 8, 5, cloth);
    Renderer.fr(3, 7, 1, 5, bone);
    Renderer.fr(6, 7, 1, 5, bone);
    Renderer.fr(2, 8, 1, 1, bone);
    Renderer.fr(7, 8, 1, 1, bone);
    Renderer.fr(2, 10, 1, 1, bone);
    Renderer.fr(7, 10, 1, 1, bone);
    // pelvis
    Renderer.fr(2, 12, 6, 1, bone);
    Renderer.fr(2, 13, 6, 1, boneS);
    // legs
    Renderer.fr(3, 14, 1, 2, bone);
    Renderer.fr(6, 14, 1, 2, bone);
    Renderer.fr(2, 16, 2, 1, boneS);
    Renderer.fr(6, 16, 2, 1, boneS);
    // bow + drawing motion
    drawBow(e, flash, wood, bone);
    ctx.restore();
  }

  function drawBow(e, flash, wood, bone) {
    const draw = e.drawing > 0;
    // bow held in front (mirror of facing already applied via ctx.scale)
    // bow rests roughly at (10..11, 6..14) when facing right
    Renderer.fr(10, 5, 1, 1, wood);
    Renderer.fr(11, 5, 1, 1, wood);
    Renderer.fr(11, 6, 1, 1, wood);
    Renderer.fr(11, 7, 1, 1, wood);
    Renderer.fr(11, 8, 1, 1, wood);
    Renderer.fr(11, 9, 1, 1, wood);
    Renderer.fr(11, 10, 1, 1, wood);
    Renderer.fr(11, 11, 1, 1, wood);
    Renderer.fr(11, 12, 1, 1, wood);
    Renderer.fr(11, 13, 1, 1, wood);
    Renderer.fr(10, 13, 1, 1, wood);
    // string
    const sx = draw ? 8 : 10;
    Renderer.fr(sx, 5, 1, 9, flash ? '#ffffff' : Renderer.PALETTE.uiCream);
    if (draw) {
      // arrow drawn back
      Renderer.fr(sx, 9, 5, 1, flash ? '#ffffff' : Renderer.PALETTE.arrowShaft);
      Renderer.fr(sx + 5, 8, 2, 3, flash ? '#ffffff' : Renderer.PALETTE.arrowHead);
    }
  }

  function drawWisp(ctx, e, camera) {
    const P = Renderer.PALETTE;
    const cx = Math.floor(e.x + e.w / 2 - camera.x);
    const cy = Math.floor(e.y + e.h / 2 - camera.y);
    const pulse = Math.sin(e.phase * 6) * 0.5 + 0.5;
    const flash = e.flash > 0;

    // wide soft halos (with alpha)
    ctx.fillStyle = 'rgba(122,184,224,0.16)';
    ctx.fillRect(cx - 8, cy - 8, 16, 16);
    ctx.fillStyle = 'rgba(192,232,255,0.20)';
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);

    const dark  = flash ? '#ffffff' : P.wispDark;
    const mid   = flash ? '#ffffff' : P.wispMid;
    const core  = flash ? '#ffffff' : P.wispCore;

    Renderer.fr(cx - 3, cy - 3, 6, 6, dark);
    Renderer.fr(cx - 2, cy - 2, 4, 4, mid);
    const rs = 1 + Math.floor(pulse * 1.5);
    Renderer.fr(cx - rs, cy - rs, rs * 2, rs * 2, core);
    Renderer.fr(cx, cy, 1, 1, '#ffffff');

    // trailing tendrils
    Renderer.fr(cx - 5, cy - 1, 1, 1, mid);
    Renderer.fr(cx + 4, cy + 1, 1, 1, mid);
    Renderer.fr(cx - 1, cy - 5, 1, 1, mid);
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
    // shaft
    ctx.fillStyle = P.arrowShaft;
    ctx.fillRect(-7, -1, 8, 1);
    // fletching
    ctx.fillStyle = P.uiCream;
    ctx.fillRect(-7, -2, 2, 1);
    ctx.fillRect(-7,  1, 2, 1);
    // head
    ctx.fillStyle = P.arrowHead;
    ctx.fillRect( 1, -1, 3, 2);
    ctx.fillStyle = P.stoneHL;
    ctx.fillRect( 3,  0, 1, 1);
    ctx.restore();
  }

  return { create, update, draw, damage, hitbox, ENEMY_TUNING };
})();
