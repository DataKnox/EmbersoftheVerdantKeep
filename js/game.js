// game.js — main loop, state machine, dispatch.

const Game = (() => {
  const STATE = { TITLE: 'title', PLAYING: 'playing', GAME_OVER: 'gameover' };

  let canvas, ctx;
  let state = STATE.TITLE;
  let lastTime = 0;
  let accumulator = 0;
  const FIXED_DT = 1 / 60;
  const MAX_FRAME = 0.1;

  let elapsed = 0;
  let player, level, camera, particles, enemies, pickups, checkpoints;
  let shake = { x: 0, y: 0, intensity: 0, timer: 0 };
  let titleAnim = 0;
  let gameOverTimer = 0;

  // HUD-ish state
  let lastDoubleJumpFlash = 0;
  let firstCheckpointActivated = false;

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;

    Renderer.init(canvas);
    Audio.init();
    Input.init();
    Renderer.preloadSprites();

    const tip = document.getElementById('tip');
    tip.classList.add('show');
    setTimeout(() => tip.classList.remove('show'), 5000);

    requestAnimationFrame(loop);
  }

  function reset() {
    level = Level.create();
    player = Player.create(level.spawn.x, level.spawn.y);
    enemies = Level.spawnEnemies(level);
    pickups = Level.spawnPickups(level);
    checkpoints = Level.spawnCheckpoints(level);
    particles = Particles.create();
    camera = { x: 0, y: 0 };
    shake = { x: 0, y: 0, intensity: 0, timer: 0 };
    firstCheckpointActivated = false;
    // Snap camera near player
    snapCamera();
  }

  function snapCamera() {
    const cw = canvas.width, ch = canvas.height;
    camera.x = Math.max(0, Math.min(level.pixelWidth - cw, player.x - cw / 2));
    camera.y = Math.max(0, Math.min(level.pixelHeight - ch, player.y - ch * 0.55));
  }

  function loop(now) {
    const dt = Math.min(((now - lastTime) || FIXED_DT * 1000) / 1000, MAX_FRAME);
    lastTime = now;
    accumulator += dt;

    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 5) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    if (accumulator >= FIXED_DT) accumulator = 0;

    render();
    Input.endFrame();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    elapsed += dt;
    titleAnim += dt;

    if (Input.justPressed('mute')) {
      Audio.toggleMute();
    }

    if (state === STATE.TITLE) {
      if (Input.justPressed('confirm')) {
        Audio.ensure();
        reset();
        state = STATE.PLAYING;
        Audio.startMusic();
      }
    } else if (state === STATE.PLAYING) {
      // diff player state to detect jumps and landings for FX
      const prevOnGround = player.onGround;
      const prevVy = player.vy;
      const prevAttack = player.attackTimer;
      Player.update(player, dt, level, Input);

      // Jump dust (left ground while moving up)
      if (!player.onGround && prevOnGround && player.vy < 0) {
        Audio.play('jump');
        for (let i = 0; i < 6; i++) {
          Particles.spawn(particles, {
            x: player.x + player.w / 2 + (Math.random() * 6 - 3),
            y: player.y + player.h - 1,
            vx: (Math.random() * 2 - 1) * 50,
            vy: -20 - Math.random() * 30,
            ay: 220, drag: 0.92,
            life: 0.25 + Math.random() * 0.2,
            kind: 'dust',
            color: 'rgba(244,236,208,0.45)',
          });
        }
      }
      // Landing dust (touched ground after a meaningful fall)
      if (player.onGround && !prevOnGround && prevVy > 90) {
        const heavy = prevVy > 220;
        for (let i = 0; i < (heavy ? 14 : 8); i++) {
          Particles.spawn(particles, {
            x: player.x + player.w / 2 + (Math.random() * 12 - 6),
            y: player.y + player.h - 1,
            vx: (Math.random() * 2 - 1) * (heavy ? 110 : 70),
            vy: -10 - Math.random() * 30,
            ay: 240, drag: 0.9,
            life: 0.3 + Math.random() * 0.25,
            kind: 'dust',
            color: 'rgba(220,200,170,0.45)',
          });
        }
        if (heavy) triggerShake(1.6, 0.18);
      }
      // Attack started (small slash particles)
      if (player.attackTimer > 0 && prevAttack <= 0) {
        Audio.play('swing');
        spawnSwingParticles();
      }

      Enemies.update(enemies, dt, level, player);
      processCombat(dt);
      updatePickups(dt);
      updateCheckpoints(dt);
      Particles.update(particles, dt);
      spawnAmbientFx(dt);
      updateCamera(dt);
      updateShake(dt);

      if (player && player.hp <= 0) {
        state = STATE.GAME_OVER;
        gameOverTimer = 0;
        Audio.stopMusic();
      }
    } else if (state === STATE.GAME_OVER) {
      gameOverTimer += dt;
      if (gameOverTimer > 0.6 && Input.justPressed('confirm')) {
        reset();
        state = STATE.PLAYING;
        Audio.startMusic();
      }
    }
  }

  // Pickup / checkpoint collision logic
  function updatePickups(dt) {
    for (const pk of pickups) {
      if (pk.collected) continue;
      // AABB overlap (pickup as 8x8 around its center)
      const r = 6;
      const px = pk.x - r, py = pk.y - r;
      const pw = r * 2, ph = r * 2;
      if (rectsOverlap(player.x, player.y, player.w, player.h, px, py, pw, ph)) {
        pk.collected = true;
        if (pk.type === 'gem')   { player.gems += 1; Audio.play('gem'); }
        if (pk.type === 'heart') { player.hp = Math.min(Player.TUNING.MAX_HP, player.hp + 2); Audio.play('heart'); }
        if (pk.type === 'relic') { player.hasRelic = true; Audio.play('relic'); triggerShake(2.0, 0.4); }
        sparkleAt(pk.x, pk.y, pk.type);
      }
    }
  }

  function updateCheckpoints(dt) {
    for (const c of checkpoints) {
      if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 3);
      if (c.activated) continue;
      if (rectsOverlap(player.x, player.y, player.w, player.h, c.x - 4, c.y - 4, 16, 24)) {
        c.activated = true;
        c.pulse = 1;
        Audio.play('checkpoint');
        Player.setRespawn(player, player.x, player.y);
        if (!firstCheckpointActivated) {
          firstCheckpointActivated = true;
          Player.unlockDoubleJump(player);
          lastDoubleJumpFlash = 1.5;
        }
        // checkpoint sparkles
        for (let i = 0; i < 14; i++) {
          Particles.spawn(particles, {
            x: c.x + 4, y: c.y + 4,
            vx: (Math.random() * 2 - 1) * 50,
            vy: -50 - Math.random() * 80,
            ay: 200,
            life: 0.5 + Math.random() * 0.4,
            kind: 'spark',
            color: '#fde0a3',
          });
        }
        triggerShake(1.2, 0.18);
      }
    }
  }

  function sparkleAt(x, y, type) {
    const colorMap = {
      gem:   ['#a8e6f0', '#5ec1d8'],
      heart: ['#ff7d6a', '#d9433f'],
      relic: ['#fff2b0', '#f4c952'],
    };
    const colors = colorMap[type] || ['#ffffff', '#f4ecd0'];
    const count = type === 'relic' ? 24 : 10;
    for (let i = 0; i < count; i++) {
      Particles.spawn(particles, {
        x, y,
        vx: (Math.random() * 2 - 1) * 80,
        vy: -50 - Math.random() * 80,
        ay: 240,
        life: 0.4 + Math.random() * 0.4,
        kind: 'spark',
        color: colors[i & 1],
      });
    }
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // Combat: sword vs enemies, enemy contact, arrow contact.
  function processCombat(dt) {
    // 1. Sword hitbox vs enemies (only one hit per swing per enemy)
    const hb = Player.attackHitbox(player);
    if (hb) {
      for (const e of enemies) {
        if (e.dead || player.attackedHits.has(e)) continue;
        if (rectsOverlap(hb.x, hb.y, hb.w, hb.h, e.x, e.y, e.w, e.h)) {
          const before = e.hp;
          Enemies.damage(e, Player.TUNING.ATTACK_DAMAGE, player.x + player.w / 2);
          player.attackedHits.add(e);
          Audio.play('hit');
          triggerShake(2.4, 0.16);
          spawnHitBurst(e);
          if (e.hp <= 0) {
            spawnDeathBurst(e);
            Audio.play('death');
            triggerShake(3.2, 0.22);
            if (e.type !== 'wisp') {
              // small score reward
              player.gems += 0;  // (no gems for kills — but keep hook)
            }
          } else if (before > 0) {
            // brief micro-shake on non-killing hit
          }
        }
      }
    }

    // 2. Enemy body damages player on contact (when not invuln)
    if (player.invuln <= 0 && player.state !== Player.STATE.DEAD) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (rectsOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
          if (Player.damage(player, ENEMY_DMG(e), e.x + e.w / 2)) {
            Audio.play('hurt');
            triggerShake(3.0, 0.28);
          }
          break;
        }
      }
    }

    // 3. Arrows damage player; both arrows and pit hazards already covered by Player.update
    if (player.invuln <= 0 && player.state !== Player.STATE.DEAD) {
      outer: for (const e of enemies) {
        if (!e.arrows) continue;
        for (const a of e.arrows) {
          if (a.stuck) continue;
          if (rectsOverlap(player.x, player.y, player.w, player.h, a.x - 4, a.y - 1, 8, 3)) {
            if (Player.damage(player, 1, a.x)) {
              a.stuck = true; a.life = 0.4;
              Audio.play('hurt');
              triggerShake(2.6, 0.22);
            }
            break outer;
          }
        }
      }
    }
  }

  function ENEMY_DMG(e) {
    return (Enemies.ENEMY_TUNING[e.type] || {}).contactDmg || 1;
  }

  function spawnHitBurst(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const palette = e.type === 'slime' ? ['#bff0d8', '#7ec8a8', '#4d8a7a']
                  : e.type === 'archer' ? ['#e8e0c0', '#a89c78', '#3a2848']
                  : ['#c0e8ff', '#7ab8e0', '#3a5a8a'];
    Particles.burst(particles, cx, cy, {
      count: 10,
      speed: 110,
      colors: palette,
      kind: e.type === 'slime' ? 'goo' : 'spark',
      ay: 200,
      life: 0.3,
    });
    // tiny white flash sparkles
    for (let i = 0; i < 4; i++) {
      Particles.spawn(particles, {
        x: cx + (Math.random() * 2 - 1) * 6,
        y: cy + (Math.random() * 2 - 1) * 6,
        vx: (Math.random() * 2 - 1) * 30,
        vy: -30 - Math.random() * 40,
        ay: 220, life: 0.18,
        kind: 'spark', color: '#ffffff', size: 2,
      });
    }
  }

  function spawnDeathBurst(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    if (e.type === 'slime') {
      Particles.burst(particles, cx, cy, {
        count: 18, speed: 130,
        colors: ['#bff0d8', '#7ec8a8', '#4d8a7a', '#2a4a44'],
        kind: 'goo', ay: 360, life: 0.55,
      });
    } else if (e.type === 'archer') {
      Particles.burst(particles, cx, cy, {
        count: 14, speed: 110,
        colors: ['#e8e0c0', '#a89c78'],
        kind: 'bone', ay: 280, life: 0.6, drag: 0.97,
      });
      Particles.burst(particles, cx, cy, {
        count: 8, speed: 80,
        colors: ['#fde0a3', '#f4b860'],
        kind: 'spark', ay: 80, life: 0.4,
      });
    } else if (e.type === 'wisp') {
      Particles.burst(particles, cx, cy, {
        count: 22, speed: 140,
        colors: ['#c0e8ff', '#7ab8e0', '#ffffff'],
        kind: 'spark', ay: 0, life: 0.55, drag: 0.94,
      });
    }
  }

  // Particles spawned along the path of a sword swing.
  function spawnSwingParticles() {
    const dir = player.facing;
    const cx = player.x + player.w / 2 + dir * 6;
    const cy = player.y + player.h / 2 - 2;
    for (let i = 0; i < 8; i++) {
      const r = i / 7;
      Particles.spawn(particles, {
        x: cx + dir * (4 + r * 14),
        y: cy + Math.sin(r * Math.PI) * -4,
        vx: dir * 60 + (Math.random() * 30 - 15),
        vy: (Math.random() * 30 - 15),
        ay: 30,
        life: 0.12 + Math.random() * 0.06,
        kind: 'slash',
        color: i < 4 ? '#ffffff' : '#d8dcec',
        size: 3 - i * 0.3,
      });
    }
  }

  // Ambient embers near torches and drifting leaves in the forest.
  let ambientCooldown = 0;
  function spawnAmbientFx(dt) {
    ambientCooldown -= dt;
    if (ambientCooldown > 0) return;
    ambientCooldown = 0.05;
    const cw = canvas.width, ch = canvas.height;
    // Torch embers — sample any torch tile in view
    const TS = level.tileSize;
    const x0 = Math.max(0, Math.floor(camera.x / TS));
    const x1 = Math.min(level.width, Math.ceil((camera.x + cw) / TS));
    const y0 = Math.max(0, Math.floor(camera.y / TS));
    const y1 = Math.min(level.height, Math.ceil((camera.y + ch) / TS));
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const t = level.tiles[ty][tx];
        if (t === Level.T.TORCH && Math.random() < 0.18) {
          Particles.spawn(particles, {
            x: tx * TS + 8 + (Math.random() * 2 - 1),
            y: ty * TS + 2,
            vx: (Math.random() * 2 - 1) * 8,
            vy: -8 - Math.random() * 16,
            ay: -12,
            life: 0.6 + Math.random() * 0.6,
            kind: 'ember',
            color: '#f4b860',
          });
        }
      }
    }
    // Forest ambient leaves — drift in the leftmost ~22 tiles when visible
    if (camera.x < 22 * TS && Math.random() < 0.25) {
      Particles.spawn(particles, {
        x: camera.x + Math.random() * cw,
        y: camera.y - 6 - Math.random() * 30,
        vx: -8 - Math.random() * 12,
        vy: 12 + Math.random() * 18,
        ay: 4,
        spin: (Math.random() * 2 - 1) * 4,
        life: 5 + Math.random() * 3,
        kind: 'leaf',
        color: Math.random() < 0.5 ? '#558a3c' : '#345f2c',
      });
    }
  }

  function updateCamera(dt) {
    if (!player || !level) return;
    const cw = canvas.width, ch = canvas.height;
    // velocity-based look-ahead — peek further in the direction of motion
    const lookAhead = Math.max(-40, Math.min(40, player.vx * 0.25)) + player.facing * 18;
    const targetX = player.x - cw / 2 + lookAhead;
    // soft vertical follow with downward bias when falling
    const yBias = player.vy > 80 ? 16 : 0;
    const targetY = player.y - ch * 0.6 + yBias;
    camera.x += (targetX - camera.x) * Math.min(1, dt * 5.5);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 4.5);
    camera.x = Math.max(0, Math.min(level.pixelWidth - cw, camera.x));
    camera.y = Math.max(0, Math.min(level.pixelHeight - ch, camera.y));
  }

  function triggerShake(intensity, duration) {
    if (intensity > shake.intensity) {
      shake.intensity = intensity;
      shake.timer = duration;
    }
  }

  function updateShake(dt) {
    if (shake.timer > 0) {
      shake.timer -= dt;
      const k = shake.intensity * Math.max(0, shake.timer / 0.3);
      shake.x = (Math.random() * 2 - 1) * k;
      shake.y = (Math.random() * 2 - 1) * k;
      if (shake.timer <= 0) { shake.x = 0; shake.y = 0; shake.intensity = 0; }
    } else {
      shake.x = 0; shake.y = 0;
    }
  }

  function render() {
    if (state === STATE.TITLE) {
      Renderer.drawTitle(titleAnim);
      return;
    }

    // Sky
    Renderer.clear();

    if (state === STATE.PLAYING || state === STATE.GAME_OVER) {
      const cam = { x: camera.x + shake.x, y: camera.y + shake.y };

      // Parallax behind tiles
      Renderer.drawParallax(cam, level.pixelWidth);

      // Tiles
      Renderer.drawTiles(level, cam, elapsed);

      // Pickups (drawn before enemies so flying particles overlay)
      for (const pk of pickups) Renderer.drawPickup(pk, cam, elapsed);

      // Checkpoints
      for (const c of checkpoints) Renderer.drawCheckpoint(c, cam, elapsed);

      // Enemies
      Enemies.draw(ctx, enemies, cam);

      // Player
      Renderer.drawPlayer(player, cam, elapsed);

      // Particles overlay world
      Particles.draw(ctx, particles, cam);

      // Foreground foliage parallax
      Renderer.drawForeground(cam);

      // Vignette
      Renderer.drawVignette();

      drawHUD();

      if (state === STATE.GAME_OVER) {
        ctx.fillStyle = 'rgba(8,4,16,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = Renderer.PALETTE.relicGold;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YOUR EMBER FADES', canvas.width / 2, canvas.height / 2 - 6);
        if (gameOverTimer > 0.6 && Math.floor(gameOverTimer * 2) % 2 === 0) {
          ctx.fillStyle = Renderer.PALETTE.uiCream;
          ctx.font = '8px monospace';
          ctx.fillText('PRESS ENTER TO TRY AGAIN', canvas.width / 2, canvas.height / 2 + 12);
        }
      }
    }
  }

  // Simple HUD: hearts top-left, gem counter top-right, double-jump unlock flash.
  function drawHUD() {
    const P = Renderer.PALETTE;
    // Hearts
    const totalHearts = Player.TUNING.MAX_HP / 2;  // 3 hearts (each = 2 hp)
    for (let i = 0; i < totalHearts; i++) {
      const x = 4 + i * 11;
      const y = 4;
      const filled = (player.hp - i * 2);
      drawHeartIcon(x, y, filled);
    }

    // Gem counter
    const x = canvas.width - 38, y = 4;
    drawGemIcon(x, y);
    ctx.fillStyle = P.uiCream;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    const txt = String(player.gems).padStart(2, '0');
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(txt, x + 11, y + 9);
    ctx.fillStyle = P.uiCream;
    ctx.fillText(txt, x + 10, y + 8);

    // Relic indicator
    if (player.hasRelic) {
      ctx.fillStyle = P.relicGoldHL;
      const flicker = Math.floor(elapsed * 6) % 2;
      ctx.fillText('★ RELIC', canvas.width / 2 - 18, y + 8 + flicker);
    }

    // Double-jump unlock flash
    if (lastDoubleJumpFlash > 0) {
      lastDoubleJumpFlash -= 1 / 60;
      const a = Math.min(1, lastDoubleJumpFlash);
      ctx.fillStyle = `rgba(244,201,82,${a * 0.85})`;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DOUBLE JUMP UNLOCKED', canvas.width / 2, 28);
    }
  }

  function drawHeartIcon(x, y, filledHp) {
    const P = Renderer.PALETTE;
    // Render a 9x8 heart that shows full / half / empty based on filledHp (0,1,2)
    const empty = filledHp <= 0;
    const half  = filledHp === 1;
    const fillCol = empty ? P.heartDark : P.heartRed;
    const liteCol = empty ? P.heartDark : P.heartHL;

    // shape (left half always rendered with fillCol; right half conditional)
    const drawHalf = (ox, half2) => {
      const c = half2 ? P.heartDark : fillCol;
      // mini heart half (4x6)
      ctx.fillStyle = c;
      ctx.fillRect(x + ox, y + 1, 1, 1);
      ctx.fillRect(x + ox + 1, y + 1, 1, 1);
      ctx.fillRect(x + ox - 1, y + 2, 4, 2);
      ctx.fillRect(x + ox, y + 4, 3, 1);
      ctx.fillRect(x + ox + 1, y + 5, 2, 1);
      ctx.fillRect(x + ox + 2, y + 6, 1, 1);
    };
    drawHalf(1, false);                   // left
    drawHalf(5, half);                    // right (ghost if half)
    // outline shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y + 7, 9, 1);
    // highlight pixel
    if (!empty) {
      ctx.fillStyle = liteCol;
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }
  }

  function drawGemIcon(x, y) {
    const P = Renderer.PALETTE;
    Renderer.fr(x + 2, y + 1, 4, 1, P.gemBlue);
    Renderer.fr(x + 1, y + 2, 6, 2, P.gemBlue);
    Renderer.fr(x + 2, y + 4, 4, 1, P.gemBlueDark);
    Renderer.fr(x + 3, y + 5, 2, 1, P.gemBlueDark);
    Renderer.fr(x + 2, y + 2, 1, 1, P.gemBlueHL);
  }

  window.addEventListener('load', init);

  return {
    triggerShake,
    sparkleAt,
    get state() { return state; },
    get camera() { return camera; },
    get level() { return level; },
    get player() { return player; },
    get particles() { return particles; },
    get enemies() { return enemies; },
    get elapsed() { return elapsed; },
    get shake() { return shake; },
    setState(s) { state = s; },
    STATE,
  };
})();
