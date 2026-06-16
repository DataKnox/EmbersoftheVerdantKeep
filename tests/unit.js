// Unit tests for pure logic in Level: tile queries and AABB collision.
// No browser, no DOM — Level's IIFE has no cross-module deps at init time.
// Run with: node tests/unit.js
'use strict';
const vm = require('vm');
const fs = require('fs');
const { makeCase, writeJunit } = require('./junit.js');

// Level.js uses no globals at IIFE time, but stub the minimum so future
// changes don't silently reach for window/document.
global.window   = {};
global.document = {};

{
  let src = fs.readFileSync('js/level.js', 'utf8');
  // var so vm.runInThisContext promotes the binding to the Node global scope.
  src = src.replace(/^const Level\s*=/, 'var Level =');
  vm.runInThisContext(src, { filename: 'js/level.js' });
}

const T  = Level.T;
const TS = Level.TILE_SIZE; // 128

const cases = [];

function assert(cond, name) {
  if (cond) { console.log(`OK   ${name}`); }
  else       { console.error(`FAIL ${name}`); }
  cases.push(makeCase(name, 'level', cond, cond ? '' : 'assertion failed'));
}

// Helper: build a minimal level object from row arrays of tile IDs.
function grid(...rows) {
  return { tiles: rows, width: rows[0].length, height: rows.length };
}

// ── getTile ───────────────────────────────────────────────────────────────────
{
  const lvl = grid([T.GRASS]);
  assert(Level.getTile(lvl, -1,  0) === T.EMPTY, 'getTile: x < 0 → EMPTY');
  assert(Level.getTile(lvl,  0, -1) === T.EMPTY, 'getTile: y < 0 → EMPTY');
  assert(Level.getTile(lvl,  1,  0) === T.EMPTY, 'getTile: x >= width → EMPTY');
  assert(Level.getTile(lvl,  0,  1) === T.EMPTY, 'getTile: y >= height → EMPTY');
  assert(Level.getTile(lvl,  0,  0) === T.GRASS,  'getTile: valid cell returns tile id');
}

// ── isSolidTile / isHazardTile ───────────────────────────────────────────────
{
  assert( Level.isSolidTile(T.GRASS),      'isSolidTile: GRASS is solid');
  assert( Level.isSolidTile(T.STONE),      'isSolidTile: STONE is solid');
  assert( Level.isSolidTile(T.BRIDGE),     'isSolidTile: BRIDGE is solid');
  assert(!Level.isSolidTile(T.EMPTY),      'isSolidTile: EMPTY is not solid');
  assert(!Level.isSolidTile(T.SPIKE),      'isSolidTile: SPIKE is not solid');
  assert(!Level.isSolidTile(T.STONE_BG),   'isSolidTile: STONE_BG is not solid');
  assert( Level.isHazardTile(T.SPIKE),     'isHazardTile: SPIKE is hazard');
  assert(!Level.isHazardTile(T.GRASS),     'isHazardTile: GRASS is not hazard');
  assert(!Level.isHazardTile(T.EMPTY),     'isHazardTile: EMPTY is not hazard');
}

// ── moveAndCollide: falling body snaps to floor ───────────────────────────────
// Layout (3 rows × 1 col):
//   row 0 y=0..127:   EMPTY
//   row 1 y=128..255: EMPTY
//   row 2 y=256..383: GRASS  ← floor
// Body (w=80 h=128) starts at y=0 and moves down 200px.
// After sweep: body bottom probes row 2, snaps → body.y = 2*128 - 128 = 128.
{
  const lvl = grid([T.EMPTY], [T.EMPTY], [T.GRASS]);
  const body = { x: 0, y: 0, w: 80, h: 128 };
  const flags = Level.moveAndCollide(lvl, body, 0, 200);
  assert(flags.onGround,              'moveAndCollide: onGround set when landing on floor');
  // Body lands on row 2 (y=256); snap: 2*TS - h = 256 - 128 = 128.
  assert(body.y === 2 * TS - body.h, 'moveAndCollide: y snapped to row-2 tile-top minus body height');
  assert(!flags.hitWall,              'moveAndCollide: no false hitWall on pure vertical fall');
}

// ── moveAndCollide: lateral wall collision ────────────────────────────────────
// Layout (1 row × 2 cols):
//   col 0 x=0..127:   EMPTY
//   col 1 x=128..255: GRASS  ← wall
// Body (w=80 h=128) at x=0 moves right 50px → right edge probes col 1.
{
  const lvl = grid([T.EMPTY, T.GRASS]);
  const body = { x: 0, y: 0, w: 80, h: 128 };
  const flags = Level.moveAndCollide(lvl, body, 50, 0);
  assert(flags.hitWall,   'moveAndCollide: hitWall set on lateral collision');
  assert(body.x < 50,     'moveAndCollide: x resolved back from wall');
  assert(!flags.onGround, 'moveAndCollide: no false onGround on pure lateral move');
}

// ── moveAndCollide: hazard overlap triggers hitHazard ────────────────────────
{
  const lvl = grid([T.SPIKE]);
  const body = { x: 0, y: 0, w: 80, h: 128 };
  const flags = Level.moveAndCollide(lvl, body, 0, 0);
  assert(flags.hitHazard,  'moveAndCollide: hitHazard when body overlaps spike tile');
  assert(!flags.onGround,  'moveAndCollide: spike is not solid (no onGround)');
}

// ── moveAndCollide: out-of-bounds movement must not throw ────────────────────
{
  const lvl = grid([T.EMPTY]);
  const body = { x: 0, y: 0, w: 80, h: 128 };
  let threw = false;
  try { Level.moveAndCollide(lvl, body, -99999, -99999); }
  catch { threw = true; }
  assert(!threw, 'moveAndCollide: no throw on extreme out-of-bounds displacement');
}

const failed = cases.filter(c => !c.passed).length;
writeJunit('Unit Tests', cases, 'tests/results/unit.xml');
console.log(`\n${cases.length - failed} passed  ${failed} failed`);
process.exit(failed ? 1 : 0);
