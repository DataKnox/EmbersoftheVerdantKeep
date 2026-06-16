// Headless browser smoke test using Playwright + Chromium.
// Loads the game at http://localhost:8080, waits for the title screen,
// then asserts: no uncaught JS errors, canvas has been painted.
//
// Prerequisites (installed by the CI stage, not part of the game source):
//   npm install playwright  (inside tests/)
//   npx playwright install chromium
//
// Run with: node tests/headless.js
//   (start python3 -m http.server 8080 from the repo root first)
'use strict';
const { chromium }           = require('playwright');
const { makeCase, writeJunit } = require('./junit.js');

(async () => {
  const browser = await chromium.launch();
  const page    = await browser.newPage();
  const cases   = [];

  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('console',   msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });

  try {
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.error(`FAIL could not load page: ${e.message}`);
    cases.push(makeCase('page load', 'headless', false, e.message));
    cases.push(makeCase('canvas painted', 'headless', false, 'page did not load'));
    writeJunit('Headless Browser', cases, 'tests/results/headless.xml');
    await browser.close();
    process.exit(1);
  }

  // Give the game loop two seconds to paint the title screen.
  await page.waitForTimeout(2000);

  // Check canvas has non-zero pixel data in the top-left 200×200 region.
  const hasPaint = await page.evaluate(() => {
    const canvas = document.getElementById('game');
    if (!canvas) return false;
    const data = canvas.getContext('2d').getImageData(0, 0, 200, 200).data;
    return data.some(v => v !== 0);
  });

  await browser.close();

  const noErrors = jsErrors.length === 0;
  if (noErrors) {
    console.log('OK   no uncaught JS errors');
  } else {
    console.error('FAIL uncaught JS errors:');
    jsErrors.forEach(m => console.error(`       ${m}`));
  }
  cases.push(makeCase('no uncaught JS errors', 'headless', noErrors, jsErrors.join('; ')));

  if (hasPaint) { console.log('OK   canvas painted'); }
  else          { console.error('FAIL canvas appears empty after 2 s'); }
  cases.push(makeCase('canvas painted', 'headless', hasPaint, hasPaint ? '' : 'canvas empty after 2 s'));

  writeJunit('Headless Browser', cases, 'tests/results/headless.xml');

  const failed = cases.filter(c => !c.passed).length;
  process.exit(failed ? 1 : 0);
})();
