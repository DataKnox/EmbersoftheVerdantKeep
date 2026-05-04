// level.js — tile data, collision queries, entity spawn lists.
//
// Level layout: 60 wide × 24 tall, three biomes flowing left to right.
//   FOREST (cols 0-11):  grass + dirt + trees + first checkpoint
//   BRIDGE (cols 12-39): broken stone planks over a bottomless pit
//   CASTLE (cols 40-59): vertical climb to a relic alcove
//
// Reaching the forest checkpoint unlocks double-jump, required for the
// wider bridge gap (5 tiles wide between planks B and C).

const Level = (() => {
  const TILE_SIZE = 16;
  const W = 60;
  const H = 24;

  // Tile IDs
  const T = {
    EMPTY:      0,
    GRASS:      1,    // grass-top, solid
    DIRT:       2,    // dirt fill, solid
    BRIDGE:     3,    // bridge plank, solid
    STONE:      4,    // castle stone, solid
    STONE_BG:   5,    // castle interior backing, non-solid
    SPIKE:      6,    // hazardous, non-solid
    TREE:       7,    // background tree, non-solid
    FOLIAGE:    8,    // grass tuft, non-solid
    TORCH:      9,    // animated torch, non-solid
    BANNER:    10,    // wall banner, non-solid (animated)
    WATER:     11,    // animated water, non-solid
    PILLAR:    12,    // background pillar under bridge, non-solid
    CASTLE_TOP:13,    // crenellated top, solid
  };

  // Solid tiles for AABB collision
  const SOLID = new Set([T.GRASS, T.DIRT, T.BRIDGE, T.STONE, T.CASTLE_TOP]);
  const HAZARD = new Set([T.SPIKE]);

  // Char -> tile mapping for grid parser.
  const CHAR_TO_TILE = {
    '.': T.EMPTY,
    'G': T.GRASS,
    'D': T.DIRT,
    '=': T.BRIDGE,
    'S': T.STONE,
    'B': T.STONE_BG,
    'C': T.CASTLE_TOP,
    '^': T.SPIKE,
    'T': T.TREE,
    'f': T.FOLIAGE,
    't': T.TORCH,
    'p': T.BANNER,
    '~': T.WATER,
    '|': T.PILLAR,
    // entity placeholders — produce empty tile + entity record:
    'P': T.EMPTY, '*': T.EMPTY, 'H': T.EMPTY, 'R': T.EMPTY, 'K': T.EMPTY,
    '1': T.EMPTY, '2': T.EMPTY, '3': T.EMPTY,
  };

  const ENTITY_CHARS = {
    'P': 'spawn',
    '*': 'gem',
    'H': 'heart',
    'R': 'relic',
    'K': 'checkpoint',
    '1': 'slime',
    '2': 'archer',
    '3': 'wisp',
  };

  // Build a 60x24 grid of chars programmatically.
  function buildGrid() {
    const grid = [];
    for (let y = 0; y < H; y++) grid.push(new Array(W).fill('.'));
    const set = (x, y, ch) => {
      if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch;
    };
    const fill = (x1, y1, x2, y2, ch) => {
      for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++)
          set(x, y, ch);
    };

    // ── FOREST  (cols 0-11) ──────────────────────────────────────────
    fill(0, 16, 11, 16, 'G');                  // grass top across forest
    fill(0, 17, 11, 23, 'D');                  // dirt fill
    fill(4, 14, 6, 14, 'G'); fill(4, 15, 6, 15, 'D');  // small hill mid-forest
    // background trees (visual only, non-solid)
    set(6, 7, 'T');  set(7, 7, 'T');
    set(5, 8, 'T');  set(6, 8, 'T'); set(7, 8, 'T'); set(8, 8, 'T');
    set(4, 9, 'T');  set(5, 9, 'T'); set(6, 9, 'T'); set(7, 9, 'T'); set(8, 9, 'T');
    set(4, 10, 'T'); set(5, 10, 'T'); set(6, 10, 'T'); set(7, 10, 'T');
    set(4, 11, 'T'); set(5, 11, 'T');
    // foliage tufts on the surface
    set(1, 15, 'f'); set(7, 15, 'f'); set(11, 15, 'f');
    // entities
    set(0, 15, 'P');     // player spawn
    set(3, 15, 'H');     // heart pickup
    set(8, 15, '1');     // slime
    set(10, 15, 'K');    // first checkpoint (unlocks double-jump)
    set(3, 13, '*');     // floating gem
    set(8, 13, '*');     // floating gem above hill

    // ── BRIDGE  (cols 12-39) ─────────────────────────────────────────
    fill(12, 16, 17, 16, '=');                  // Plank A (6 tiles, level)
    fill(20, 15, 24, 15, '=');                  // Plank B (5 tiles, raised one tile)
    fill(30, 16, 33, 16, '=');                  // Plank C (4 tiles)
    fill(36, 16, 39, 16, '=');                  // Plank D (4 tiles)
    // background pillars beneath gaps for visual depth
    fill(18, 17, 18, 23, '|');
    fill(27, 17, 27, 23, '|');
    fill(34, 17, 34, 23, '|');
    // entities
    set(14, 14, '*');    // gem above plank A
    set(22, 14, 'H');    // heart above plank B (high path)
    set(31, 15, '*');    // gem above plank C
    set(38, 15, '2');    // skeleton archer perched on plank D
    set(27, 12, '3');    // wisp drifting in the big gap

    // ── CASTLE  (cols 40-59) ─────────────────────────────────────────
    fill(40, 3, 59, 3, 'C');                    // crenellated top
    fill(40, 4, 59, 4, 'S');                    // roof line
    fill(40, 5, 40, 13, 'S');                   // left wall (doorway at rows 14-15)
    fill(59, 5, 59, 15, 'S');                   // right wall
    fill(40, 16, 59, 16, 'S');                  // main floor
    fill(40, 17, 59, 23, 'S');                  // foundation
    fill(41, 5, 58, 15, 'B');                   // interior backing
    // climb platforms (overwrite backing)
    fill(42, 14, 44, 14, 'S');
    fill(46, 12, 48, 12, 'S');
    fill(51, 10, 53, 10, 'S');
    fill(55,  8, 57,  8, 'S');                  // alcove platform
    // hazards
    set(49, 15, '^'); set(50, 15, '^');
    // decorations
    set(43, 13, 't'); set(50, 9, 't'); set(56, 7, 't');
    set(53, 5, 'p'); set(56, 5, 'p');
    // entities
    set(41, 15, 'K');    // 2nd checkpoint (just inside the doorway)
    set(44, 13, '*');
    set(47, 11, '*');
    set(51,  9, 'H');    // heart on the high climb
    set(55,  7, '*');
    set(57,  7, 'R');    // RELIC — hidden in the alcove
    set(47, 13, '3');    // wisp interior 1
    set(52,  9, '3');    // wisp interior 2

    return grid.map(row => row.join(''));
  }

  // Cached so all layers see the same source rows (renderer can inspect via getRaw()).
  let _raw = null;
  function getRaw() {
    if (!_raw) _raw = buildGrid();
    return _raw;
  }

  function create() {
    const raw = getRaw();
    const tiles = [];
    const entities = [];
    let spawn = { x: 32, y: 240 };

    for (let y = 0; y < H; y++) {
      const line = raw[y];
      tiles.push(new Array(W));
      for (let x = 0; x < W; x++) {
        const ch = line[x];
        const tile = CHAR_TO_TILE[ch];
        tiles[y][x] = (tile === undefined) ? T.EMPTY : tile;
        if (ENTITY_CHARS[ch]) {
          const type = ENTITY_CHARS[ch];
          // entity origin: bottom-center of its tile cell
          const px = x * TILE_SIZE + TILE_SIZE / 2;
          const py = y * TILE_SIZE + TILE_SIZE;
          if (type === 'spawn') {
            spawn = { x: px - 5, y: py - 16 };
          } else {
            entities.push({ type, x: px, y: py, tx: x, ty: y });
          }
        }
      }
    }

    return {
      tiles,
      entities,
      spawn,
      width: W,
      height: H,
      tileSize: TILE_SIZE,
      pixelWidth: W * TILE_SIZE,
      pixelHeight: H * TILE_SIZE,
    };
  }

  function getTile(level, tx, ty) {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return T.EMPTY;
    return level.tiles[ty][tx];
  }
  function isSolidTile(t) { return SOLID.has(t); }
  function isHazardTile(t) { return HAZARD.has(t); }
  function isSolidAt(level, tx, ty) {
    return isSolidTile(getTile(level, tx, ty));
  }

  // AABB-vs-tile sweep. Resolves x then y separately for tight platformer feel.
  function moveAndCollide(level, body, dx, dy) {
    const flags = { onGround: false, hitCeiling: false, hitWall: false, hitHazard: false };

    // X axis
    body.x += dx;
    if (dx !== 0) {
      const dir = dx > 0 ? 1 : -1;
      const probeX = dir > 0 ? body.x + body.w : body.x;
      const tx = Math.floor(probeX / TILE_SIZE);
      const ty1 = Math.floor(body.y / TILE_SIZE);
      const ty2 = Math.floor((body.y + body.h - 0.001) / TILE_SIZE);
      for (let ty = ty1; ty <= ty2; ty++) {
        if (isSolidAt(level, tx, ty)) {
          if (dir > 0) body.x = tx * TILE_SIZE - body.w;
          else         body.x = (tx + 1) * TILE_SIZE;
          flags.hitWall = true;
          break;
        }
      }
    }

    // Y axis
    body.y += dy;
    if (dy !== 0) {
      const dir = dy > 0 ? 1 : -1;
      const probeY = dir > 0 ? body.y + body.h : body.y;
      const ty = Math.floor(probeY / TILE_SIZE);
      const tx1 = Math.floor(body.x / TILE_SIZE);
      const tx2 = Math.floor((body.x + body.w - 0.001) / TILE_SIZE);
      for (let tx = tx1; tx <= tx2; tx++) {
        if (isSolidAt(level, tx, ty)) {
          if (dir > 0) {
            body.y = ty * TILE_SIZE - body.h;
            flags.onGround = true;
          } else {
            body.y = (ty + 1) * TILE_SIZE;
            flags.hitCeiling = true;
          }
          break;
        }
      }
    }

    // Hazard sample (any overlapping spike tile counts)
    const hx1 = Math.floor(body.x / TILE_SIZE);
    const hx2 = Math.floor((body.x + body.w - 0.001) / TILE_SIZE);
    const hy1 = Math.floor(body.y / TILE_SIZE);
    const hy2 = Math.floor((body.y + body.h - 0.001) / TILE_SIZE);
    outer: for (let ty = hy1; ty <= hy2; ty++) {
      for (let tx = hx1; tx <= hx2; tx++) {
        if (isHazardTile(getTile(level, tx, ty))) { flags.hitHazard = true; break outer; }
      }
    }

    return flags;
  }

  function spawnEnemies(level) {
    const list = [];
    for (const e of level.entities) {
      if (e.type === 'slime' || e.type === 'archer' || e.type === 'wisp') {
        list.push(Enemies.create(e.type, e.x, e.y));
      }
    }
    return list;
  }

  function spawnPickups(level) {
    const list = [];
    for (const e of level.entities) {
      if (e.type === 'gem' || e.type === 'heart' || e.type === 'relic') {
        list.push({
          type: e.type,
          x: e.x, y: e.y - 8,
          ox: e.x, oy: e.y - 8,
          collected: false,
          bobPhase: Math.random() * Math.PI * 2,
        });
      }
    }
    return list;
  }

  function spawnCheckpoints(level) {
    const list = [];
    for (const e of level.entities) {
      if (e.type === 'checkpoint') {
        list.push({
          x: e.x - 6, y: e.y - 18,
          tx: e.tx, ty: e.ty,
          activated: false,
          pulse: 0,
        });
      }
    }
    return list;
  }

  return {
    TILE_SIZE, W, H, T, SOLID, HAZARD,
    create, getRaw,
    getTile, isSolidTile, isSolidAt, isHazardTile,
    moveAndCollide,
    spawnEnemies, spawnPickups, spawnCheckpoints,
  };
})();
