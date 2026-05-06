// player.js — Embers of the Verdant Keep
// =============================================================================
//  TUNABLE GAMEPLAY CONSTANTS
//  All values in pixels and seconds. Game ticks at fixed 60 Hz timestep.
//  Tweak these and reload — game feel lives here.
//
//  Scaled to the 128-px-tile / 1920×1080-canvas world: every pixel/velocity
//  value is 8× the original 16-px-tile values (matching the 8× tile-size
//  bump); time-based values (durations, intervals) are unchanged so feel
//  stays identical at the new scale.
// =============================================================================
const PLAYER_TUNING = {
  // Horizontal movement
  MAX_SPEED:       760,   // px/s — top run speed
  ACCEL_GROUND:    5600,  // px/s² — ground accel from rest
  ACCEL_AIR:       3600,  // px/s² — reduced air control
  FRICTION_GROUND: 7200,  // px/s² — decel when releasing input
  FRICTION_AIR:    960,   // px/s² — slight drag in air
  TURN_BOOST:      1.6,   // multiplier on accel when reversing direction

  // Vertical / jump
  GRAVITY:         6000,  // px/s² — downward accel while rising
  GRAVITY_FALL:    8000,  // px/s² — heavier accel while falling (snappier descent)
  MAX_FALL:        2560,  // px/s — terminal velocity
  JUMP_VELOCITY:  -1920,  // px/s — initial jump impulse (peak ~2.4 tiles up)
  JUMP_CUT:        0.45,  // velocity multiplier when jump released early
  COYOTE_TIME:     0.10,  // seconds — grace after walking off ledge (~6 frames)
  JUMP_BUFFER:     0.12,  // seconds — early-press grace before landing
  DOUBLE_JUMP_VEL:-1680,  // px/s — air jump impulse

  // Combat
  ATTACK_DURATION: 0.22,  // total swing duration
  ATTACK_ACTIVE_S: 0.04,  // hitbox active window start (windup)
  ATTACK_ACTIVE_E: 0.16,  // hitbox active window end
  ATTACK_COOLDOWN: 0.08,  // recovery before next swing
  ATTACK_RANGE:    128,   // px — sword reach forward of body (1 tile)
  ATTACK_HEIGHT:   144,   // px — hitbox height
  ATTACK_DAMAGE:   1,
  ATTACK_KB_X:     400,   // knockback dealt to enemies

  // Health / damage
  MAX_HP:          6,     // 3 hearts × 2 half-pips
  INVULN_TIME:     1.0,   // i-frames after taking a hit
  HURT_FLASH_HZ:   12,    // sprite blink rate during invuln
  KNOCKBACK_X:     1040,  // received knockback
  KNOCKBACK_Y:    -1120,
  HURT_LOCK:       0.18,  // input-lock during knockback

  // Hitbox / body — same tile-relative proportions as original (0.625×1 tile)
  WIDTH:           80,
  HEIGHT:          128,
  SPRITE_W:        128,
  SPRITE_H:        256,   // 1:2 cell aspect from the player_sheet (256×512 cells)
  SPRITE_OFFSET_X: -24,   // sprite drawn relative to body top-left (centered: (128-80)/2)
  SPRITE_OFFSET_Y: -128,  // unused (drawPlayer computes per-anim) — kept for reference

  // Visual
  RUN_FRAME_TIME:  0.08,
};
// =============================================================================

const Player = (() => {
  const T = PLAYER_TUNING;

  const STATE = {
    IDLE: 'idle', RUN: 'run', JUMP: 'jump', FALL: 'fall',
    ATTACK: 'attack', HURT: 'hurt', DEAD: 'dead',
  };

  function create(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      w: T.WIDTH, h: T.HEIGHT,
      facing: 1,
      onGround: false,
      wasOnGround: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      hasDoubleJump: false,         // unlocked at first checkpoint
      doubleJumpAvailable: false,
      hp: T.MAX_HP,
      invuln: 0,
      hurtLock: 0,
      attackTimer: 0,
      attackCooldown: 0,
      attackedHits: new Set(),       // enemies hit by current swing (no double-hit)
      state: STATE.IDLE,
      animTime: 0,
      runFrame: 0,
      // last safe ground (for pit respawn)
      respawnX: x, respawnY: y,
      score: 0,
      gems: 0,
      hasRelic: false,
      // for renderer interpolation
      px: x, py: y,
    };
  }

  function setRespawn(p, x, y) {
    p.respawnX = x; p.respawnY = y;
  }

  function unlockDoubleJump(p) {
    if (!p.hasDoubleJump) {
      p.hasDoubleJump = true;
      p.doubleJumpAvailable = true;
    }
  }

  function damage(p, amount, sourceX) {
    if (p.invuln > 0 || p.state === STATE.DEAD) return false;
    p.hp = Math.max(0, p.hp - amount);
    p.invuln = T.INVULN_TIME;
    p.hurtLock = T.HURT_LOCK;
    p.state = STATE.HURT;
    p.attackTimer = 0;  // cancel any swing
    if (sourceX !== undefined) {
      const dir = (p.x + p.w / 2) < sourceX ? -1 : 1;
      p.vx = dir * T.KNOCKBACK_X;
      p.vy = T.KNOCKBACK_Y;
    } else {
      p.vy = T.KNOCKBACK_Y;
    }
    if (p.hp <= 0) p.state = STATE.DEAD;
    return true;
  }

  function respawn(p) {
    p.x = p.respawnX;
    p.y = p.respawnY;
    p.vx = 0; p.vy = 0;
    p.invuln = 0.6;       // brief grace period
    p.hurtLock = 0;
    p.attackTimer = 0;
    p.state = STATE.IDLE;
    p.doubleJumpAvailable = p.hasDoubleJump;
  }

  function update(p, dt, level, input) {
    p.px = p.x; p.py = p.y;
    p.animTime += dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtLock > 0) p.hurtLock -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;

    // ── Input intent (suspended during hurt-lock and during attack)
    let inputDir = 0;
    const lockMove = p.hurtLock > 0;
    if (!lockMove) {
      if (input.isDown('left'))  inputDir -= 1;
      if (input.isDown('right')) inputDir += 1;
    }
    if (inputDir !== 0) p.facing = inputDir;

    // ── Jump press buffer
    if (input.justPressed('jump') && !lockMove) {
      p.jumpBuffer = T.JUMP_BUFFER;
    }
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

    // Track jump-held for variable-height (cut on release)
    p.jumpHeld = input.isDown('jump');

    // ── Attack press
    if (input.justPressed('attack') && p.attackTimer <= 0 && p.attackCooldown <= 0 && p.state !== STATE.DEAD) {
      p.attackTimer = T.ATTACK_DURATION;
      p.attackedHits.clear();
      p.state = STATE.ATTACK;
    }
    if (p.attackTimer > 0) {
      p.attackTimer -= dt;
      if (p.attackTimer <= 0) {
        p.attackTimer = 0;
        p.attackCooldown = T.ATTACK_COOLDOWN;
      }
    }

    // ── Horizontal movement
    const accel    = p.onGround ? T.ACCEL_GROUND : T.ACCEL_AIR;
    const friction = p.onGround ? T.FRICTION_GROUND : T.FRICTION_AIR;
    if (inputDir !== 0) {
      const sign = Math.sign(p.vx) || inputDir;
      const turning = (sign !== inputDir);
      const a = accel * (turning ? T.TURN_BOOST : 1);
      p.vx += inputDir * a * dt;
      // clamp to max
      if (p.vx > T.MAX_SPEED)  p.vx = T.MAX_SPEED;
      if (p.vx < -T.MAX_SPEED) p.vx = -T.MAX_SPEED;
    } else {
      // friction toward 0
      if (p.vx > 0) p.vx = Math.max(0, p.vx - friction * dt);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + friction * dt);
    }

    // ── Jump consume buffer
    if (p.jumpBuffer > 0) {
      if (p.onGround || p.coyote > 0) {
        p.vy = T.JUMP_VELOCITY;
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.onGround = false;
        if (typeof Game !== 'undefined') {
          // jump dust + sfx hooks
        }
      } else if (p.hasDoubleJump && p.doubleJumpAvailable) {
        p.vy = T.DOUBLE_JUMP_VEL;
        p.doubleJumpAvailable = false;
        p.jumpBuffer = 0;
      }
    }

    // ── Variable-height jump cut
    if (!p.jumpHeld && p.vy < 0) {
      p.vy *= 1 - (1 - T.JUMP_CUT) * Math.min(1, dt * 30); // smooth cut
      if (p.vy > T.JUMP_VELOCITY * T.JUMP_CUT) p.vy = Math.max(p.vy, T.JUMP_VELOCITY * T.JUMP_CUT);
    }

    // ── Gravity (heavier on descent for snappy feel)
    const g = (p.vy < 0) ? T.GRAVITY : T.GRAVITY_FALL;
    p.vy += g * dt;
    if (p.vy > T.MAX_FALL) p.vy = T.MAX_FALL;

    // ── Move and resolve collisions
    p.wasOnGround = p.onGround;
    const flags = Level.moveAndCollide(level, p, p.vx * dt, p.vy * dt);
    if (flags.hitWall && Math.abs(p.vx) > 0.1) p.vx = 0;
    if (flags.hitCeiling && p.vy < 0) p.vy = 0;
    if (flags.onGround) {
      p.vy = 0;
      p.onGround = true;
      p.coyote = T.COYOTE_TIME;
      p.doubleJumpAvailable = p.hasDoubleJump;
    } else {
      // not on ground this frame
      if (p.wasOnGround) p.coyote = T.COYOTE_TIME;
      p.coyote = Math.max(0, p.coyote - dt);
      p.onGround = false;
    }

    // ── State derivation (for sprite later)
    if (p.attackTimer > 0)               p.state = STATE.ATTACK;
    else if (p.hurtLock > 0)             p.state = STATE.HURT;
    else if (!p.onGround && p.vy < 0)    p.state = STATE.JUMP;
    else if (!p.onGround && p.vy >= 0)   p.state = STATE.FALL;
    else if (Math.abs(p.vx) > 4)         p.state = STATE.RUN;
    else                                 p.state = STATE.IDLE;

    // Animation frame for run cycle
    if (p.state === STATE.RUN) {
      const f = Math.floor(p.animTime / T.RUN_FRAME_TIME) % 4;
      p.runFrame = f;
    }

    // Stash last safe ground position (for pit respawn) — only on landing on solid tile.
    if (flags.onGround) {
      p.respawnX = p.x;
      p.respawnY = p.y - 64;
    }

    // ── Pit / hazard handling
    if (flags.hitHazard) {
      damage(p, 1, p.x + p.w / 2);   // self-source center → just bounces up
    }

    // Falling out the bottom of the level → take damage, respawn at last
    // safe ground only if still alive. If the fall kills, leave them dead so
    // game.js transitions to GAME_OVER.
    if (p.y > level.pixelHeight + 512) {
      damage(p, 1, p.x + p.w / 2);
      if (p.hp > 0) respawn(p);
    }
  }

  // Hitbox for active sword swing — null when not active.
  function attackHitbox(p) {
    if (p.attackTimer <= 0) return null;
    const phase = T.ATTACK_DURATION - p.attackTimer; // 0..DURATION
    if (phase < T.ATTACK_ACTIVE_S || phase > T.ATTACK_ACTIVE_E) return null;
    const hx = (p.facing > 0) ? (p.x + p.w) : (p.x - T.ATTACK_RANGE);
    const hy = p.y - 16;
    return { x: hx, y: hy, w: T.ATTACK_RANGE, h: T.ATTACK_HEIGHT };
  }

  // Drawing is delegated to Renderer.drawPlayer (kept here as a no-op for compat).
  function draw() {}

  return {
    create, update, draw,
    setRespawn, unlockDoubleJump, damage, respawn, attackHitbox,
    STATE, TUNING: T,
  };
})();
