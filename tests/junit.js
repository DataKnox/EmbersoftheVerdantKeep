// Shared JUnit XML writer for the Node-based test scripts.
// Usage:
//   const { makeCase, writeJunit } = require('./junit.js');
//   const cases = [];
//   cases.push(makeCase('my test', 'classname', passed, errorMessage));
//   writeJunit('Suite Name', cases, 'tests/results/suite.xml');
'use strict';
const fs   = require('fs');
const path = require('path');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/[\r\n]+/g, ' ');
}

function makeCase(name, classname, passed, message) {
  return { name, classname, passed, message: message ?? '' };
}

function writeJunit(suiteName, cases, outPath) {
  const failures = cases.filter(c => !c.passed).length;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${esc(suiteName)}" tests="${cases.length}" failures="${failures}" errors="0">`,
  ];
  for (const c of cases) {
    if (c.passed) {
      lines.push(`  <testcase name="${esc(c.name)}" classname="${esc(c.classname)}"/>`);
    } else {
      lines.push(`  <testcase name="${esc(c.name)}" classname="${esc(c.classname)}">`);
      lines.push(`    <failure message="${esc(c.message)}"/>`);
      lines.push(`  </testcase>`);
    }
  }
  lines.push('</testsuite>');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
}

module.exports = { makeCase, writeJunit };
