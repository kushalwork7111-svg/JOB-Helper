/* global Office, PowerPoint, Rules */
const VERSION = '0.2.0';
let BRAND = null;
const TEXT_TYPES = ['GeometricShape', 'TextBox', 'Placeholder', 'Callout'];

Office.onReady(async info => {
  document.getElementById('ver').textContent = 'Version ' + VERSION;
  if (info.host !== Office.HostType.PowerPoint) return log('Open this add-in in PowerPoint.');
  try {
    BRAND = await (await fetch('brand.json', { cache: 'no-store' })).json();
  } catch (e) {
    return log('Could not load the brand rules (brand.json). Check your connection and reopen the pane.');
  }
  if (!BRAND.approved) document.getElementById('draft').hidden = false;
  document.getElementById('fontHeading').value = BRAND.fonts.heading;
  document.getElementById('fontBody').value = BRAND.fonts.body;
  document.getElementById('titleCase').value = BRAND.title.case || 'none';
  if (!supports('1.5')) document.querySelector('#scope option[value="selected"]').disabled = true;
  on('btnFixAll', fixAll);
  on('btnTitles', () => runPlan(planTitles));
  on('btnBody', () => runPlan(planBody));
  on('btnFont', () => runPlan(planFonts));
  on('btnColors', () => runPlan(planColors));
  on('btnTidy', () => runPlan(planTidyText));
  on('btnEmpty', findEmpty);
  on('btnCheck', brandCheck);
});

function supports(v) { return Office.context.requirements.isSetSupported('PowerPointApi', v); }
function on(id, fn) {
  const b = document.getElementById(id);
  b.onclick = async () => {
    b.disabled = true; hideConfirm(); log('Working…');
    try { await fn(); } catch (e) { log('Could not finish: ' + e.message + '\nNothing was changed by the step that failed.'); }
    b.disabled = false;
  };
}
function log(text, links) {
  const el = document.getElementById('log');
  el.textContent = text;
  (links || []).forEach(l => {
    const a = document.createElement('a');
    a.href = '#'; a.textContent = l.label; a.className = 'goto';
    a.onclick = e => { e.preventDefault(); Office.context.document.goToByIdAsync(l.slide, Office.GoToType.Index); };
    el.appendChild(a);
  });
}
function scope() { return document.getElementById('scope').value; }
function plural(n, word, many) { return n + ' ' + (n === 1 ? word : many || word + 's'); }
function caseMode() { return document.getElementById('titleCase').value; }

/**
 * Slides in scope with their text shapes loaded.
 * Returns { items: [{ slide, index, shape, info }], shapes: [{ slide, index, shape }], slideCount, skipped: [text] }.
 * info is a plain object for Rules (position, size, font, colour, text, alignment, placeholder type).
 */
async function textShapes(ctx) {
  const all = ctx.presentation.slides;
  all.load('items/id');
  let slides = all;
  if (scope() === 'selected') {
    if (!supports('1.5')) throw new Error('"Selected slides" needs a newer PowerPoint. Choose "Whole presentation".');
    slides = ctx.presentation.getSelectedSlides();
    slides.load('items/id');
  }
  await ctx.sync();
  const number = {};
  all.items.forEach((s, i) => (number[s.id] = i + 1));
  if (!slides.items.length) throw new Error('No slides are selected.');

  slides.items.forEach(s => s.shapes.load('items/type,items/name,items/left,items/top,items/width,items/height,items/id'));
  await ctx.sync();

  const shapes = [], out = [];
  slides.items.forEach(s => s.shapes.items.forEach(sh => {
    const x = { slide: s, index: number[s.id], shape: sh };
    shapes.push(x);
    if (TEXT_TYPES.indexOf(sh.type) >= 0) out.push(x);
  }));

  const usePh = supports('1.8');
  const want = x => {
    const tf = x.shape.textFrame, tr = tf.textRange;
    tf.load('hasText,autoSizeSetting');
    tr.load('text');
    tr.font.load('size,name,color,bold');
    tr.paragraphFormat.load('horizontalAlignment');
    if (usePh && x.shape.type === 'Placeholder') x.shape.placeholderFormat.load('type');
  };
  let ok = out;
  try {
    out.forEach(want); await ctx.sync();
  } catch (e) {
    // Some placeholder holds a chart, table or picture: check one by one.
    ok = [];
    for (const x of out) {
      try { want(x); await ctx.sync(); ok.push(x); } catch (e2) { /* not a text shape */ }
    }
  }
  const skipped = [];
  if (ok.length < out.length) skipped.push(plural(out.length - ok.length, 'placeholder') + ' holding a picture, chart or table');

  ok.forEach(x => {
    const sh = x.shape, tf = sh.textFrame, tr = tf.textRange, f = tr.font;
    let phType = null;
    try { if (usePh && sh.type === 'Placeholder') phType = sh.placeholderFormat.type; } catch (e) { /* not loaded */ }
    x.info = { name: sh.name, top: sh.top, left: sh.left, width: sh.width, height: sh.height,
      size: f.size, font: f.name, color: f.color, bold: f.bold, hasText: tf.hasText, text: tr.text || '',
      align: tr.paragraphFormat.horizontalAlignment, autoSize: tf.autoSizeSetting, placeholderType: phType };
  });
  return { items: ok, shapes, slideCount: slides.items.length, skipped };
}

/** Solid fill colours of plain shapes (rectangles, arrows, callouts). Pictures, charts and tables are never touched. */
async function loadFills(ctx, shapes) {
  const geo = shapes.filter(x => x.shape.type === 'GeometricShape' || x.shape.type === 'Callout');
  const ok = [];
  try {
    geo.forEach(x => x.shape.fill.load('type,foregroundColor')); await ctx.sync(); ok.push(...geo);
  } catch (e) {
    for (const x of geo) { try { x.shape.fill.load('type,foregroundColor'); await ctx.sync(); ok.push(x); } catch (e2) { /* no fill */ } }
  }
  return ok.filter(x => x.shape.fill.type === 'Solid' && x.shape.fill.foregroundColor);
}

/** One title per slide (a Set of items). */
function pickTitles(items) {
  const bySlide = {};
  items.forEach(x => (bySlide[x.index] = bySlide[x.index] || []).push(x));
  const titles = new Set();
  Object.keys(bySlide).forEach(k => {
    const list = bySlide[k], i = Rules.pickTitleIndex(list.map(x => x.info), BRAND.slide.heightPt);
    if (i >= 0) titles.add(list[i]);
  });
  return titles;
}

function slidesWithout(items, titles) {
  const have = new Set([...titles].map(x => x.index));
  return [...new Set(items.map(x => x.index))].filter(n => !have.has(n));
}

/*
 * Planners queue changes on the loaded shapes without syncing, and return result lines.
 * runPlan / fixAll sync once at the end, so one Ctrl+Z (or a few) undoes the whole action.
 */
async function runPlan(plan) {
  await PowerPoint.run(async ctx => {
    const data = await textShapes(ctx);
    data.titles = pickTitles(data.items);
    const lines = await plan(ctx, data);
    await ctx.sync();
    data.skipped.forEach(s => lines.push('Skipped ' + s + '.'));
    lines.push('Press Ctrl+Z to undo.');
    log(lines.join('\n'));
  });
}

function planTitles(ctx, { items, titles, slideCount }) {
  const T = BRAND.title, mode = caseMode();
  let recased = 0;
  titles.forEach(x => {
    const sh = x.shape, tr = sh.textFrame.textRange;
    if (mode !== 'none' && x.info.text) {
      const t = Rules.applyCase(x.info.text, mode, BRAND.keepWords);
      if (t !== x.info.text) { tr.text = t; recased++; }
    }
    sh.left = T.leftPt; sh.top = T.topPt; sh.width = T.widthPt; sh.height = T.heightPt;
    tr.font.name = BRAND.fonts.heading; tr.font.size = T.sizePt; tr.font.bold = T.bold; tr.font.color = T.color;
    tr.paragraphFormat.horizontalAlignment = T.align;
  });
  const missing = slidesWithout(items, titles);
  const lines = ['Titles unified on ' + titles.size + ' of ' + plural(slideCount, 'slide') + ' (' + T.sizePt + ' pt ' + BRAND.fonts.heading + ', BDO red, not bold).'];
  if (recased) lines.push('Case changed on ' + plural(recased, 'title') + ' (acronyms like BDO, PMI and FY26 kept).');
  if (missing.length) lines.push('No title found on slide(s) ' + missing.join(', ') + ': left unchanged.');
  return lines;
}

function planBody(ctx, { items, titles }) {
  let footers = 0, autofit = 0, changed = 0;
  items.forEach(x => {
    if (titles.has(x) || !x.info.hasText) return;
    if (Rules.isFooterLike(x.info, BRAND)) { footers++; return; }
    if (x.info.autoSize === 'AutoSizeTextToFitShape') { autofit++; return; }
    const f = x.shape.textFrame.textRange.font;
    f.size = BRAND.body.sizePt; f.name = BRAND.fonts.body;
    changed++;
  });
  const lines = ['Body text set to ' + BRAND.body.sizePt + ' pt ' + BRAND.fonts.body + ' in ' + plural(changed, 'box', 'boxes') + '.'];
  if (footers) lines.push('Left ' + plural(footers, 'footer/source line') + ' unchanged.');
  if (autofit) lines.push('Skipped ' + plural(autofit, 'box', 'boxes') + ' set to "Shrink text on overflow": check these by hand (run Brand check).');
  return lines;
}

function planFonts(ctx, { items, titles }, fixed) {
  const heading = fixed ? BRAND.fonts.heading : document.getElementById('fontHeading').value.trim();
  const body = fixed ? BRAND.fonts.body : document.getElementById('fontBody').value.trim();
  if (!heading || !body) throw new Error('Type both a heading font and a body font first.');
  let changed = 0;
  items.forEach(x => {
    if (!x.info.hasText) return;
    const want = titles.has(x) ? heading : body;
    if (Rules.normalizeFont(x.info.font) === want) return;
    x.shape.textFrame.textRange.font.name = want;
    changed++;
  });
  return ['Fonts set to ' + heading + (heading === body ? '' : ' (titles) and ' + body + ' (other text)') + ' in ' + plural(changed, 'box', 'boxes') + '.',
    'Tables, charts and SmartArt are not changed by this button.'];
}

/** Snap off-brand text colours and shape fills to the nearest BDO colour. Tints of non-red colours are kept. */
async function planColors(ctx, { items, shapes }) {
  const map = {}, note = (from, to) => { const k = from.toUpperCase() + ' → ' + to; map[k] = (map[k] || 0) + 1; };
  let mixed = 0;
  items.forEach(x => {
    if (!x.info.hasText) return;
    if (!x.info.color) { mixed++; return; }
    const to = Rules.snapColor(x.info.color, BRAND.palette);
    if (to) { x.shape.textFrame.textRange.font.color = to; note(x.info.color, to); }
  });
  (await loadFills(ctx, shapes)).forEach(x => {
    const c = x.shape.fill.foregroundColor, to = Rules.snapColor(c, BRAND.palette);
    if (to) { x.shape.fill.setSolidColor(to); note(c, to); }
  });
  const keys = Object.keys(map);
  const lines = [keys.length ? 'Colours snapped to the BDO palette:' : 'All text and shape colours are already on the BDO palette.'];
  keys.sort((a, b) => map[b] - map[a]).forEach(k => lines.push('  ' + k + '  (' + map[k] + ')'));
  if (mixed) lines.push(plural(mixed, 'box', 'boxes') + ' with mixed colours skipped: check by hand.');
  lines.push('Pictures, charts and tables are not changed. Tints of slate, charcoal and the secondary colours are allowed and kept.');
  return lines;
}

/** Justified → left aligned (guidelines p.18) and double spaces → single. */
function planTidyText(ctx, { items }) {
  let aligned = 0, spaces = 0, boxes = 0;
  items.forEach(x => {
    if (!x.info.hasText) return;
    const tr = x.shape.textFrame.textRange;
    if (/^Justify|^Distributed/.test(x.info.align || '')) { tr.paragraphFormat.horizontalAlignment = 'Left'; aligned++; }
    const ranges = Rules.doubleSpaceRanges(x.info.text);
    if (ranges.length) {
      // Work from the end so earlier positions stay valid.
      ranges.reverse().forEach(r => { tr.getSubstring(r[0], r[1]).text = ' '; });
      spaces += ranges.length; boxes++;
    }
  });
  return ['Left-aligned ' + plural(aligned, 'justified box', 'justified boxes') + ' (BDO guidelines: larger text blocks are left aligned).',
    'Replaced ' + plural(spaces, 'double space') + ' in ' + plural(boxes, 'box', 'boxes') + '.'];
}

async function fixAll() {
  await PowerPoint.run(async ctx => {
    const data = await textShapes(ctx);
    data.titles = pickTitles(data.items);
    const lines = ['Fix all: safe fixes applied.', ''];
    lines.push(...planFonts(ctx, data, true));
    lines.push(...planTitles(ctx, data));
    lines.push(...await planColors(ctx, data));
    lines.push(...planTidyText(ctx, data));
    await ctx.sync();
    data.skipped.forEach(s => lines.push('Skipped ' + s + '.'));
    lines.push('', 'Not changed by Fix all: body text size, empty boxes (use their own buttons), pictures, charts, tables.', 'Press Ctrl+Z to undo.');
    log(lines.join('\n'));
  });
}

/* ---- Remove empty boxes: list first, delete only after the user confirms ---- */
let pendingEmpty = [];
async function findEmpty() {
  await PowerPoint.run(async ctx => {
    const { items } = await textShapes(ctx);
    pendingEmpty = items.filter(x => !x.info.hasText && (x.shape.type === 'TextBox' || x.shape.type === 'Placeholder'))
      .map(x => ({ slideId: x.slide.id, shapeId: x.shape.id, index: x.index, type: x.shape.type }));
    if (!pendingEmpty.length) return log('No empty text boxes or placeholders found.');
    const slides = [...new Set(pendingEmpty.map(e => e.index))];
    const boxes = pendingEmpty.filter(e => e.type === 'TextBox').length;
    log('Found ' + plural(boxes, 'empty text box', 'empty text boxes') + ' and ' + plural(pendingEmpty.length - boxes, 'empty placeholder') +
      ' on slide(s) ' + slides.join(', ') + '.\nNothing is deleted until you confirm.', slides.map(n => ({ slide: n, label: String(n) })));
    showConfirm('Delete ' + plural(pendingEmpty.length, 'empty box', 'empty boxes') + '?', deleteEmpty);
  });
}
async function deleteEmpty() {
  const list = pendingEmpty; pendingEmpty = [];
  await PowerPoint.run(async ctx => {
    list.forEach(e => ctx.presentation.slides.getItem(e.slideId).shapes.getItem(e.shapeId).delete());
    await ctx.sync();
  });
  log('Deleted ' + plural(list.length, 'empty box', 'empty boxes') + '. Press Ctrl+Z to undo.');
}
function showConfirm(text, onYes) {
  const box = document.getElementById('confirm');
  document.getElementById('confirmText').textContent = text;
  box.hidden = false;
  document.getElementById('confirmYes').onclick = async () => {
    hideConfirm();
    try { await onYes(); } catch (e) { log('Could not finish: ' + e.message); }
  };
  document.getElementById('confirmNo').onclick = () => { hideConfirm(); pendingEmpty = []; log('Cancelled. Nothing was deleted.'); };
}
function hideConfirm() { document.getElementById('confirm').hidden = true; }

/* ---- Brand check ---- */
async function brandCheck() {
  await PowerPoint.run(async ctx => {
    const { items, shapes, slideCount } = await textShapes(ctx), titles = pickTitles(items), T = BRAND.title;
    const bySlide = {}, foreign = {};
    const add = (n, msg) => { const m = (bySlide[n] = bySlide[n] || {}); m[msg] = (m[msg] || 0) + 1; };
    items.forEach(x => {
      const i = x.info, n = x.index;
      const font = Rules.normalizeFont(i.font);
      if (i.hasText && font && BRAND.fonts.allowed.indexOf(font) < 0) { add(n, 'font "' + font + '" is not a brand font'); foreign[font] = (foreign[font] || 0) + 1; }
      if (i.hasText && !i.font) add(n, 'a box mixes several fonts');
      if (i.hasText && i.size && i.size < BRAND.body.minSizePt && !Rules.isFooterLike(i, BRAND)) add(n, 'text at ' + i.size + ' pt is below ' + BRAND.body.minSizePt + ' pt');
      if (i.hasText && i.color && !titles.has(x) && !Rules.isBrandColor(i.color, BRAND.palette)) add(n, 'text colour ' + i.color + ' is off-palette (nearest: ' + Rules.nearestColor(i.color, BRAND.palette) + ')');
      if (i.hasText && /^Justify|^Distributed/.test(i.align || '')) add(n, 'justified text (should be left aligned)');
      if (i.hasText && Rules.doubleSpaceRanges(i.text).length) add(n, 'double spaces in text');
      Rules.findLeftovers(i.text, BRAND.leftoverPatterns).forEach(m => add(n, 'leftover draft text "' + m + '"'));
      if (!i.hasText && x.shape.type === 'Placeholder') add(n, 'empty placeholder');
      if (!i.hasText && x.shape.type === 'TextBox') add(n, 'empty text box');
      if (i.autoSize === 'AutoSizeTextToFitShape') add(n, 'a box shrinks its text to fit');
    });
    shapes.forEach(x => {
      const s = x.shape;
      if (s.left < -2 || s.top < -2 || s.left + s.width > BRAND.slide.widthPt + 2 || s.top + s.height > BRAND.slide.heightPt + 2) add(x.index, 'a shape runs off the slide');
    });
    (await loadFills(ctx, shapes)).forEach(x => {
      if (!Rules.isBrandColor(x.shape.fill.foregroundColor, BRAND.palette)) add(x.index, 'shape fill ' + x.shape.fill.foregroundColor + ' is off-palette');
    });
    titles.forEach(x => {
      const i = x.info, n = x.index;
      if (i.top > BRAND.slide.heightPt * 0.25) return; // covers and dividers have their own title positions
      if (Rules.offPosition(i, T)) add(n, 'title is not in the standard position');
      if (i.size && Math.round(i.size) !== T.sizePt) add(n, 'title is ' + i.size + ' pt, not ' + T.sizePt + ' pt');
      if (i.color && i.color.toUpperCase() !== T.color.toUpperCase()) add(n, 'title colour ' + i.color + ' is not BDO red ' + T.color);
      if (i.bold === true && !T.bold) add(n, 'title is bold (BDO titles are not bold)');
      if (T.case === 'sentence' && i.text && Rules.sentenceCase(i.text, BRAND.keepWords) !== i.text) add(n, 'title is not in sentence case');
    });
    slidesWithout(items, titles).forEach(n => add(n, 'no title found'));

    const nums = Object.keys(bySlide).map(Number).sort((a, b) => a - b);
    const score = Math.round(100 * (slideCount - nums.length) / slideCount);
    if (!nums.length) return log('Client-ready score: 100%. No brand issues found on ' + plural(slideCount, 'slide') + '.');
    const lines = n => Object.keys(bySlide[n]).map(m => '  • ' + m + (bySlide[n][m] > 1 ? ' (×' + bySlide[n][m] + ')' : ''));
    const total = nums.reduce((s, n) => s + Object.keys(bySlide[n]).length, 0);
    let head = 'Client-ready score: ' + score + '% (' + (slideCount - nums.length) + ' of ' + plural(slideCount, 'slide') + ' clean).\n' +
      total + ' point(s) to fix on ' + plural(nums.length, 'slide') + '.';
    const fonts = Object.keys(foreign);
    if (fonts.length) head += '\nOff-brand fonts: ' + fonts.join(', ') + '. If this deck was not started from the BDO 2023 template, theme text may show in these fonts; "Fix all" sets ' + BRAND.fonts.body + '.';
    head += '\nAlso check by hand: page numbers (Insert → Header & Footer → Slide number), hidden slides and speaker notes.';
    log(head + '\n\n' + nums.map(n => 'Slide ' + n + '\n' + lines(n).join('\n')).join('\n') + '\n\nGo to slide: ', nums.map(n => ({ slide: n, label: String(n) })));
  });
}
