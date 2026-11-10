import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'src/styles.css',
  'src/components/AcademicSetup.css',
  'src/components/PlanningPage.css',
];

// Explicit exceptions are visual artwork only; interactive controls, labels,
// status text, metadata, and other readable UI copy must remain >= 12px.
const decorativeSelectors = new Set([
  '.float-kicker',
  '.float-foot',
  '.stage-coordinate',
  '.play-mark',
  '.universe-label',
  '.universe-coordinate',
  '.home-universe-visual .universe-label',
]);

function px(value, unit) {
  const n = Number(value);
  if (unit === 'px') return n;
  if (unit === 'rem' || unit === 'em') return n * 16;
  return Infinity;
}

test('readable UI typography stays at least 12px; smaller sizes are explicit artwork only', async () => {
  const violations = [];
  for (const file of files) {
    const source = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    for (const match of source.matchAll(rule)) {
      const selectors = match[1].trim().split(',').map(s => s.trim()).filter(Boolean);
      const declarations = match[2];
      const sizes = [...declarations.matchAll(/font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*(px|rem|em)\b/gi)];
      for (const size of sizes) {
        const value = px(size[1], size[2].toLowerCase());
        if (value >= 12) continue;
        const nonDecorative = selectors.filter(selector => !decorativeSelectors.has(selector));
        if (nonDecorative.length) {
          violations.push(`${file}: ${nonDecorative.join(', ')} uses ${size[0]}`);
        }
      }
    }
  }
  assert.deepEqual(violations, [], violations.join('\n'));
});
