// Smoke test: load every JS module in dependency order and verify the IIFE
// does not throw. Stubs the browser APIs the IIFEs touch at init time.
// Run with: node tests/smoke.js
'use strict';
const vm = require('vm');
const fs = require('fs');
const { makeCase, writeJunit } = require('./junit.js');

// ── Browser global stubs ──────────────────────────────────────────────────────
const fakeGain   = () => ({ connect() {}, gain: { value: 0 } });
const fakeNode   = () => ({ connect() {}, start() {}, stop() {}, frequency: { value: 0 }, type: 'sine', buffer: null });
const fakeCtx    = () => ({
  imageSmoothingEnabled: false,
  canvas: { width: 1920, height: 1080 },
  scale() {}, save() {}, restore() {}, translate() {}, rotate() {},
  fillRect() {}, clearRect() {}, drawImage() {},
  fillText() {}, strokeText() {}, measureText() { return { width: 0 }; },
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  getImageData() { return { data: new Uint8ClampedArray(4) }; },
  beginPath() {}, arc() {}, fill() {}, stroke() {}, clip() {}, closePath() {},
  moveTo() {}, lineTo() {}, rect() {},
});
const fakeCanvas = () => ({ getContext: fakeCtx, width: 1920, height: 1080, addEventListener() {} });

global.window = {
  AudioContext: class {
    createGain()         { return fakeGain(); }
    createOscillator()   { return fakeNode(); }
    createBuffer()       {}
    createBufferSource() { return fakeNode(); }
    get destination()    { return {}; }
    get currentTime()    { return 0; }
    get state()          { return 'running'; }
  },
  webkitAudioContext: class {},
  addEventListener() {},
  Math,
};
global.document = {
  getElementById: () => fakeCanvas(),
  addEventListener() {},
  querySelector() { return null; },
};
global.performance  = { now: () => 0 };
global.fetch        = () => Promise.resolve({ json: () => Promise.resolve({}) });
global.Image        = class { constructor() { setTimeout(() => this.onload?.(), 0); } };
global.HTMLImageElement = class {};
global.requestAnimationFrame  = () => 0;
global.cancelAnimationFrame   = () => {};

// ── Module load order matches the <script> order in index.html ───────────────
const MODULES = [
  ['js/audio.js',     'Audio'],
  ['js/input.js',     'Input'],
  ['js/particles.js', 'Particles'],
  ['js/assets.js',    'Assets'],
  ['js/renderer.js',  'Renderer'],
  ['js/enemies.js',   'Enemies'],
  ['js/player.js',    'Player'],
  ['js/level.js',     'Level'],
  ['js/game.js',      'Game'],
];

const cases = [];

for (const [file, name] of MODULES) {
  try {
    let src = fs.readFileSync(file, 'utf8');
    // Promote the exported const to var so vm.runInThisContext exposes it as
    // a global, making it available to subsequently loaded modules.
    src = src.replace(new RegExp(`^const ${name}\\s*=`, 'm'), `var ${name} =`);
    vm.runInThisContext(src, { filename: file });
    console.log(`OK   ${file}`);
    cases.push(makeCase(file, 'smoke', true));
  } catch (e) {
    console.error(`FAIL ${file}: ${e.message}`);
    cases.push(makeCase(file, 'smoke', false, e.message));
  }
}

const failed = cases.filter(c => !c.passed).length;
writeJunit('Smoke Tests', cases, 'tests/results/smoke.xml');
console.log(`\n${cases.length - failed} passed  ${failed} failed`);
process.exit(failed ? 1 : 0);
