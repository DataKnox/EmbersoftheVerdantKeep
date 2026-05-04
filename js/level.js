// level.js — tile data, collision, checkpoints, entity spawn. Stubbed.

const Level = (() => {
  const TILE_SIZE = 16;

  // Tile IDs
  const T = {
    EMPTY: 0,
    GRASS: 1,
    DIRT:  2,
    STONE: 3,
    BRIDGE:4,
    CASTLE:5,
    CASTLE_BG: 6,  // non-solid backdrop
    SPIKE: 7,
    PLATFORM: 8,   // one-way (jump-through)
    TORCH: 9,      // visual
    WATER: 10,
    BANNER:11,
    GRASS_TUFT: 12,
    PILLAR_TOP: 13,
    PILLAR_MID: 14,
    PILLAR_BOT: 15,
    CRACK: 16,
  };

  function create() {
    return {
      width: 60, height: 24,
      tiles: [], entities: [],
      spawn: { x: 32, y: 240 },
      checkpoints: [],
      pixelWidth: 60 * TILE_SIZE,
      pixelHeight: 24 * TILE_SIZE,
    };
  }

  function spawnEnemies(level) { return []; }

  return { TILE_SIZE, T, create, spawnEnemies };
})();
