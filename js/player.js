// player.js — Embers of the Verdant Keep
// =============================================================================
//  TUNABLE GAMEPLAY CONSTANTS
//  All values in pixels and seconds (game runs at fixed 60Hz timestep).
//  Tweak these and reload — game feel lives here.
// =============================================================================
const PLAYER_TUNING = {
  // Horizontal movement
  MAX_SPEED:       95,    // px/s — top run speed
  ACCEL_GROUND:    700,   // px/s² — ground accel from rest
  ACCEL_AIR:       450,   // px/s² — reduced air control
  FRICTION_GROUND: 900,   // px/s² — decel when releasing input
  FRICTION_AIR:    120,   // px/s² — slight drag in air
  TURN_BOOST:      1.6,   // multiplier on accel when reversing direction

  // Vertical / jump
  GRAVITY:         750,   // px/s² — downward accel
  GRAVITY_FALL:    1000,  // px/s² — accel when falling (snappier descent)
  MAX_FALL:        320,   // px/s — terminal velocity
  JUMP_VELOCITY:   -240,  // px/s — initial jump impulse
  JUMP_CUT:        0.45,  // velocity multiplier when jump released early
  COYOTE_TIME:     0.10,  // seconds — grace after walking off ledge (~6 frames)
  JUMP_BUFFER:     0.12,  // seconds — early-press grace before landing
  DOUBLE_JUMP_VEL: -210,  // px/s — air jump impulse

  // Combat
  ATTACK_DURATION: 0.22,  // seconds — total swing time
  ATTACK_ACTIVE_S: 0.04,  // when hitbox turns on (windup)
  ATTACK_ACTIVE_E: 0.16,  // when hitbox turns off
  ATTACK_COOLDOWN: 0.08,  // recovery before next swing
  ATTACK_RANGE:    16,    // px — sword reach forward of body
  ATTACK_HEIGHT:   18,    // px — hitbox height
  ATTACK_DAMAGE:   1,
  ATTACK_KB_X:     50,    // px/s knockback dealt to enemies

  // Health / damage
  MAX_HP:          6,     // hearts (3 hearts × 2 half-pips OR 6 quarter-hearts; we draw 3 hearts of 2 each)
  INVULN_TIME:     1.0,   // seconds of i-frames after taking a hit
  HURT_FLASH_TIME: 0.12,  // sprite flash interval during invuln
  KNOCKBACK_X:     130,   // received knockback (away from damage source)
  KNOCKBACK_Y:    -130,
  HURT_LOCK:       0.18,  // input-lock during knockback

  // Hitbox / body
  WIDTH:           10,
  HEIGHT:          16,    // 16-tall body, sprite drawn taller
  SPRITE_W:        16,
  SPRITE_H:        20,

  // Visual
  RUN_FRAME_TIME:  0.08,  // run cycle frame duration
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
      facing: 1,           // 1 right, -1 left
      onGround: false,
      wasOnGround: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      hasDoubleJump: false,    // unlocked at first checkpoint
      doubleJumpAvailable: false,
      hp: T.MAX_HP,
      invuln: 0,
      hurtLock: 0,
      attackTimer: 0,         // counts up during swing
      attackCooldown: 0,
      state: STATE.IDLE,
      animTime: 0,
      runFrame: 0,
      // recent footstep tracker for jump dust
      landed: false,
      // last safe ground (set externally)
      respawnX: x, respawnY: y,
      score: 0,
      gems: 0,
      hasRelic: false,
      // for renderer interpolation
      px: x, py: y,
    };
  }

  // Stub update — real implementation in next commit
  function update(p, dt, level, input) {
    // remember previous for renderer interpolation
    p.px = p.x; p.py = p.y;
  }

  function draw(ctx, p, camera) {
    // Stub — real sprite in later commit
    ctx.fillStyle = '#6b3e7a';
    ctx.fillRect(Math.floor(p.x - camera.x), Math.floor(p.y - camera.y), p.w, p.h);
  }

  return { create, update, draw, STATE, TUNING: T };
})();
