// game.js — main game loop, state machine, dispatch.

const Game = (() => {
  const STATE = { TITLE: 'title', PLAYING: 'playing', GAME_OVER: 'gameover' };

  let canvas, ctx;
  let state = STATE.TITLE;
  let lastTime = 0;
  let accumulator = 0;
  const FIXED_DT = 1 / 60;
  const MAX_FRAME = 0.1;   // clamp huge dt (tab switch)

  let elapsed = 0;
  let player, level, camera, particles, enemies;
  let shake = { x: 0, y: 0, intensity: 0, timer: 0 };
  let titleAnim = 0;
  let gameOverTimer = 0;
  let tipShownAt = 0;

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;

    Renderer.init(canvas);
    Audio.init();
    Input.init();
    Renderer.preloadSprites();

    // Show controls tip briefly
    const tip = document.getElementById('tip');
    tip.classList.add('show');
    tipShownAt = performance.now();
    setTimeout(() => tip.classList.remove('show'), 4500);

    requestAnimationFrame(loop);
  }

  function reset() {
    level = Level.create();
    player = Player.create(level.spawn.x, level.spawn.y);
    enemies = Level.spawnEnemies(level);
    particles = Particles.create();
    camera = { x: 0, y: 0 };
    shake = { x: 0, y: 0, intensity: 0, timer: 0 };
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
    if (accumulator >= FIXED_DT) accumulator = 0;  // bail out if super behind

    render();
    Input.endFrame();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    elapsed += dt;
    titleAnim += dt;

    // Mute toggle (works in any state)
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
      Player.update(player, dt, level, Input);
      Enemies.update(enemies, dt, level, player);
      Particles.update(particles, dt);
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

  function updateCamera(dt) {
    if (!player || !level) return;
    const cw = canvas.width, ch = canvas.height;
    const targetX = player.x - cw / 2 + player.facing * 32;
    const targetY = player.y - ch * 0.6;
    camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 5);
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
      const t = Math.max(0, shake.timer);
      const k = shake.intensity * t / Math.max(0.001, shake.timer + dt);
      shake.x = (Math.random() * 2 - 1) * k;
      shake.y = (Math.random() * 2 - 1) * k;
      if (shake.timer <= 0) { shake.x = 0; shake.y = 0; shake.intensity = 0; }
    } else {
      shake.x = 0; shake.y = 0;
    }
  }

  function render() {
    if (state === STATE.TITLE) {
      Renderer.drawTitlePlaceholder(titleAnim);
      return;
    }

    Renderer.clear();

    // (Real rendering gets implemented in later commits)
    if (state === STATE.PLAYING || state === STATE.GAME_OVER) {
      Player.draw(ctx, player, camera);

      if (state === STATE.GAME_OVER) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = Renderer.PALETTE.uiCream;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YOU FELL', canvas.width / 2, canvas.height / 2 - 6);
        if (gameOverTimer > 0.6 && Math.floor(gameOverTimer * 2) % 2 === 0) {
          ctx.fillText('PRESS ENTER', canvas.width / 2, canvas.height / 2 + 10);
        }
      }
    }
  }

  window.addEventListener('load', init);

  return {
    triggerShake,
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
