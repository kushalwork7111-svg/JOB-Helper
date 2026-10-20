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

test('isTintOf recognises tints of a colour', () => {
  assert.ok(R.isTintOf('#ADB7BF', '#5B6E7F'));  // ~50% slate
  assert.ok(R.isTintOf('#5B6E7F', '#5B6E7F'));
  assert.ok(!R.isTintOf('#1E90FF', '#5B6E7F'));
  assert.ok(!R.isTintOf('#4A5A68', '#5B6E7F')); // a shade (darker), not a tint
});

test('isBrandColor: palette, allowed tints, and no tints of red/burgundy', () => {
  assert.ok(R.isBrandColor('#e81a3b', brand.palette));
  assert.ok(R.isBrandColor('#ADB7BF', brand.palette));
  assert.ok(!R.isBrandColor('#F38D9D', brand.palette), 'pink tint of BDO red is not allowed');
  assert.ok(R.isBrandColor(null, brand.palette));
});

test('snapColor fixes the colours found in real proposals', () => {
  assert.strictEqual(R.snapColor('#ED1A3B', brand.palette), '#E81A3B'); // previous BDO red
  assert.strictEqual(R.snapColor('#EC1A3A', brand.palette), '#E81A3B');
  assert.strictEqual(R.snapColor('#FF0000', brand.palette), '#E81A3B'); // Office "Red"
  assert.strictEqual(R.snapColor('#262626', brand.palette), '#333333');
  assert.ok(R.snapColor('#002060', brand.palette));                      // Office navy → some brand colour
  assert.strictEqual(R.snapColor('#333333', brand.palette), null);
});

test('findLeftovers catches drafting text but not normal words', () => {
  const p = brand.leftoverPatterns;
  assert.deepStrictEqual(R.findLeftovers('Fee of INR XX lakh, start date TBD', p), ['XX', 'TBD']);
  assert.deepStrictEqual(R.findLeftovers('[Insert client name] DRAFT', p), ['[Insert client name]', 'DRAFT']);
  assert.deepStrictEqual(R.findLeftovers('A draft agreement for Xbox and Max', p), []);
});

test('doubleSpaceRanges skips indentation at the start of a line', () => {
  assert.deepStrictEqual(R.doubleSpaceRanges('a  b'), [[1, 2]]);
  assert.deepStrictEqual(R.doubleSpaceRanges('  indented\nx   y'), [[12, 3]]);
  assert.deepStrictEqual(R.doubleSpaceRanges('one two'), []);
});

test('normalizeFont strips theme labels', () => {
  assert.strictEqual(R.normalizeFont('Trebuchet MS (Headings)'), 'Trebuchet MS');
  assert.strictEqual(R.normalizeFont('+mn-lt'), null);
  assert.strictEqual(R.normalizeFont('Aptos'), 'Aptos');
});

test('findTerms applies the ₹ … Cr / lakh house style', () => {
  const apply = s => { let out = s; R.findTerms(s, brand.terms).reverse().forEach(h => { out = out.slice(0, h.start) + h.to + out.slice(h.start + h.length); }); return out; };
  assert.strictEqual(apply('Fee of INR 5 crore'), 'Fee of ₹5 Cr');
  assert.strictEqual(apply('Rs. 20 lakhs and Rs 3 lacs'), '₹20 lakh and ₹3 lakh');
  assert.strictEqual(apply('Revenue (INR Cr)'), 'Revenue (₹ Cr)');
  assert.strictEqual(apply('₹5 Crores; 12 Cr. in FY26'), '₹5 Cr; 12 Cr in FY26');
  assert.strictEqual(apply('Total 40 Cr.'), 'Total 40 Cr.', 'full stop at the end of a sentence is kept');
  assert.strictEqual(apply('Already ₹5 Cr and 2 lakh'), 'Already ₹5 Cr and 2 lakh');
  assert.strictEqual(apply('Microsoft scrolls'), 'Microsoft scrolls');
});

test('caseOps / applyOps / mergeOps', () => {
  const from = 'OUR UNDERSTANDING OF PMI', to = R.sentenceCase(from, brand.keepWords);
  assert.strictEqual(R.applyOps(from, R.caseOps(from, to)), to);
  assert.deepStrictEqual(R.mergeOps([{ start: 0, length: 3, to: 'x' }, { start: 2, length: 2, to: 'y' }, { start: 5, length: 1, to: 'z' }]).map(o => o.start), [5, 2]);
});

test('diffSegments shows deleted and inserted text with context', () => {
  const segs = R.diffSegments('Fee of INR 5 crore', [{ start: 7, length: 4, to: '₹' }, { start: 13, length: 5, to: 'Cr' }]);
  assert.deepStrictEqual(segs, [
    { t: 'same', s: 'Fee of ' }, { t: 'del', s: 'INR ' }, { t: 'ins', s: '₹' }, { t: 'same', s: '5 ' },
    { t: 'del', s: 'crore' }, { t: 'ins', s: 'Cr' }]);
});

test('findIssues reports every planted problem with an exact fix', () => {
  const t = (id, o) => Object.assign({ id, name: 'TextBox ' + id, type: 'TextBox', isText: true, hasText: true, size: 12,
    font: 'Trebuchet MS', color: '#333333', bold: false, align: 'Left', autoSize: 'AutoSizeNone', width: 400, height: 40 }, o);
  const slides = [
    { index: 1, id: 's1', shapes: [
      t('1', { left: 60, top: 30, width: 700, text: 'OUR UNDERSTANDING OF THE PMI SCOPE', size: 22, color: '#FF0000', bold: true }),
      t('2', { left: 38, top: 135, text: 'Body in Aptos', font: 'Aptos', size: 11 }),
      t('3', { left: 38, top: 300, text: 'Fee:  INR 45 lakhs, TBD', color: '#002060', align: 'Justify' }),
      t('4', { left: 38, top: 380, text: '', hasText: false }),
      { id: '5', name: 'Rect', type: 'GeometricShape', isText: false, left: 800, top: 200, width: 300, height: 100, fill: '#C00000' }] },
    { index: 2, id: 's2', shapes: [t('9', { left: 38, top: 300, text: 'Only body text' })] }];
  const { issues, foreignFonts } = R.findIssues(slides, brand);
  const codes = issues.map(i => i.slide + ':' + i.shapeId + ':' + i.code).sort();
  assert.deepStrictEqual(codes, ['1:1:case', '1:1:titleBold', '1:1:titleColour', '1:1:titlePos', '1:1:titleSize',
    '1:2:font', '1:3:justified', '1:3:leftover', '1:3:spaces', '1:3:term', '1:3:term', '1:3:textColour',
    '1:4:empty', '1:5:fill', '1:5:offSlide', '2:null:noTitle'].sort());
  assert.deepStrictEqual(foreignFonts, { Aptos: 1 });
  const get = c => issues.find(i => i.code === c);
  assert.strictEqual(R.applyOps(get('case').fix.text, get('case').fix.ops), 'Our understanding of the PMI scope');
  assert.deepStrictEqual(get('titlePos').fix.box, { left: 38.3, top: 46.8, width: 883.7, height: 28.4 });
  assert.strictEqual(get('fill').to, '#98002E');
  assert.strictEqual(get('offSlide').fix.left, 660);
  assert.ok(get('empty').destructive && !get('empty').safe);
  assert.ok(get('term').fix && !get('term').safe, 'house terms are applied on request, not by Fix all');
  assert.ok(!get('leftover').fix, 'draft text needs a person');
});

test('brand.json has the required keys', () => {
  ['slide', 'fonts', 'title', 'body', 'palette', 'margins', 'footer'].forEach(k => assert.ok(brand[k], 'missing ' + k));
  assert.ok(brand.fonts.allowed.indexOf(brand.fonts.heading) >= 0, 'heading font must be allowed');
  assert.ok(brand.fonts.allowed.indexOf(brand.fonts.body) >= 0, 'body font must be allowed');
  R.paletteColors(brand.palette).forEach(c => assert.ok(R.hexToRgb(c), 'bad colour ' + c));
});

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
