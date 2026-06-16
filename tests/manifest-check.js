// Verify every PNG listed in assets/manifest.json exists on disk.
// Catches the common mistake of generating/regenerating an asset but
// forgetting to commit the file (or mistyping the path in the manifest).
// Run with: node tests/manifest-check.js
'use strict';
const fs   = require('fs');
const path = require('path');
const { makeCase, writeJunit } = require('./junit.js');

const MANIFEST_PATH = 'assets/manifest.json';

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (e) {
  console.error(`FAIL could not parse ${MANIFEST_PATH}: ${e.message}`);
  process.exit(1);
}

const cases = [];

function check(src) {
  const fullPath = path.join('assets', src);
  const exists   = fs.existsSync(fullPath);
  const msg      = exists ? '' : 'file missing from disk';
  cases.push(makeCase(fullPath, 'manifest', exists, msg));
  if (exists) { console.log(`OK   ${fullPath}`); }
  else        { console.error(`FAIL ${fullPath}  (listed in manifest but missing)`); }
}

// assets.js walks these four sections and reads the `src` field of each entry.
for (const section of ['sheets', 'tiles', 'ui', 'backgrounds']) {
  if (!manifest[section]) continue;
  for (const entry of Object.values(manifest[section])) {
    if (entry?.src) check(entry.src);
  }
}

const failed = cases.filter(c => !c.passed).length;
writeJunit('Manifest Check', cases, 'tests/results/manifest.xml');
console.log(`\n${cases.length - failed} passed  ${failed} failed`);
process.exit(failed ? 1 : 0);
