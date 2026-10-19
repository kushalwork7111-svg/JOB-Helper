// Unit tests for src/rules.js. Run: node tests/run.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const R = require('../src/rules.js');
const brand = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'brand.json'), 'utf8'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); }
}

test('hexToRgb', () => {
  assert.deepStrictEqual(R.hexToRgb('#FF8000'), [255, 128, 0]);
  assert.deepStrictEqual(R.hexToRgb('ff8000'), [255, 128, 0]);
  assert.strictEqual(R.hexToRgb('red'), null);
});

test('nearestColor snaps to the palette', () => {
  const pal = { primary: ['#E81A3B'], secondary: ['#333333'], neutrals: ['#000000', '#FFFFFF'] };
  assert.strictEqual(R.nearestColor('#D0102A', pal), '#E81A3B');
  assert.strictEqual(R.nearestColor('#F5F5F5', pal), '#FFFFFF');
  assert.strictEqual(R.nearestColor('#3A3A3A', pal), '#333333');
});

test('inPalette ignores case', () => {
  assert.ok(R.inPalette('#ffffff', brand.palette));
  assert.ok(!R.inPalette('#123456', brand.palette));
  assert.ok(!R.inPalette(null, brand.palette));
});

test('sentenceCase keeps acronyms and numbers', () => {
  assert.strictEqual(R.sentenceCase('MARKET Overview For BDO In FY26'), 'MARKET overview for BDO in FY26');
  assert.strictEqual(R.sentenceCase('executive summary'), 'Executive summary');
});

test('sentenceCase handles ALL-CAPS titles using keepWords', () => {
  assert.strictEqual(R.sentenceCase('MARKET OVERVIEW FOR BDO IN FY26', ['BDO']), 'Market overview for BDO in FY26');
  assert.strictEqual(R.sentenceCase('M&A PIPELINE', ['M&A']), 'M&A pipeline');
});

test('titleCase keeps small words lower', () => {
  assert.strictEqual(R.titleCase('the scope of work and EBITDA bridge'), 'The Scope of Work and EBITDA Bridge');
});

test('applyCase none leaves text alone', () => {
  assert.strictEqual(R.applyCase('mIxEd', 'none'), 'mIxEd');
});

test('pickTitleIndex prefers Title placeholder type', () => {
  const shapes = [{ name: 'Box', top: 10, size: 40, hasText: true }, { name: 'X', top: 100, size: 12, hasText: true, placeholderType: 'Title' }];
  assert.strictEqual(R.pickTitleIndex(shapes, 540), 1);
});

test('pickTitleIndex uses name "Title…"', () => {
  const shapes = [{ name: 'TextBox 3', top: 10, size: 40, hasText: true }, { name: 'Title 1', top: 200, size: 12, hasText: true }];
  assert.strictEqual(R.pickTitleIndex(shapes, 540), 1);
});

test('pickTitleIndex falls back to largest font in the top quarter', () => {
  const shapes = [
    { name: 'a', top: 20, size: 14, hasText: true },
    { name: 'b', top: 40, size: 28, hasText: true },
    { name: 'c', top: 300, size: 60, hasText: true },
    { name: 'd', top: 5, size: 28, hasText: false }
  ];
  assert.strictEqual(R.pickTitleIndex(shapes, 540), 1);
});

test('pickTitleIndex tie goes to the higher box; none found gives -1', () => {
  assert.strictEqual(R.pickTitleIndex([{ top: 60, size: 20, hasText: true }, { top: 30, size: 20, hasText: true }], 540), 1);
  assert.strictEqual(R.pickTitleIndex([{ top: 400, size: 20, hasText: true }], 540), -1);
});

test('offPosition respects tolerance', () => {
  const T = { leftPt: 36, topPt: 28, tolerancePt: 4 };
  assert.ok(!R.offPosition({ left: 39, top: 25 }, T));
  assert.ok(R.offPosition({ left: 45, top: 28 }, T));
});

test('isFooterLike catches only the bottom band', () => {
  assert.ok(R.isFooterLike({ top: 505, size: 9 }, brand));
  assert.ok(!R.isFooterLike({ top: 330, size: 8 }, brand));
  assert.ok(!R.isFooterLike({ top: 200, size: 14 }, brand));
});

test('mostCommon', () => {
  assert.strictEqual(R.mostCommon([12, 14, 14, null, 12, 14]), 14);
  assert.strictEqual(R.mostCommon([]), null);
});

test('brand.json has the required keys', () => {
  ['slide', 'fonts', 'title', 'body', 'palette', 'margins', 'footer'].forEach(k => assert.ok(brand[k], 'missing ' + k));
  assert.ok(brand.fonts.allowed.indexOf(brand.fonts.heading) >= 0, 'heading font must be allowed');
  assert.ok(brand.fonts.allowed.indexOf(brand.fonts.body) >= 0, 'body font must be allowed');
  R.paletteColors(brand.palette).forEach(c => assert.ok(R.hexToRgb(c), 'bad colour ' + c));
});

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
