/* global Office, PowerPoint, Rules */
const VERSION = '0.1.0';
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
  on('btnTitles', unifyTitles);
  on('btnBody', unifyBody);
  on('btnFont', changeFonts);
  on('btnCheck', brandCheck);
});

function supports(v) { return Office.context.requirements.isSetSupported('PowerPointApi', v); }
function on(id, fn) {
  const b = document.getElementById(id);
  b.onclick = async () => {
    b.disabled = true; log('Working…');
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

/**
 * Slides in scope with their text shapes loaded.
 * Returns { items: [{ slide, index, shape, info }], slideCount, skipped: [text] }.
 * info is a plain object for Rules: { name, top, left, width, height, size, hasText, placeholderType }.
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

  const out = [];
  slides.items.forEach(s => s.shapes.items
    .filter(sh => TEXT_TYPES.indexOf(sh.type) >= 0)
    .forEach(sh => out.push({ slide: s, index: number[s.id], shape: sh })));

  const usePh = supports('1.8');
  const want = x => {
    x.shape.textFrame.load('hasText,autoSizeSetting');
    x.shape.textFrame.textRange.load('text');
    x.shape.textFrame.textRange.font.load('size,name,color');
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
    const sh = x.shape, tf = sh.textFrame, f = tf.textRange.font;
    let phType = null;
    try { if (usePh && sh.type === 'Placeholder') phType = sh.placeholderFormat.type; } catch (e) { /* not loaded */ }
    x.info = { name: sh.name, top: sh.top, left: sh.left, width: sh.width, height: sh.height,
      size: f.size, font: f.name, color: f.color, hasText: tf.hasText, text: tf.textRange.text,
      autoSize: tf.autoSizeSetting, placeholderType: phType };
  });
  return { items: ok, slideCount: slides.items.length, skipped };
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

async function unifyTitles() {
  await PowerPoint.run(async ctx => {
    const { items, slideCount, skipped } = await textShapes(ctx);
    const titles = pickTitles(items), T = BRAND.title, caseMode = document.getElementById('titleCase').value;
    let recased = 0;
    titles.forEach(x => {
      const sh = x.shape, tr = sh.textFrame.textRange;
      if (caseMode !== 'none' && x.info.text) {
        const t = Rules.applyCase(x.info.text, caseMode, BRAND.keepWords);
        if (t !== x.info.text) { tr.text = t; recased++; }
      }
      sh.left = T.leftPt; sh.top = T.topPt; sh.width = T.widthPt; sh.height = T.heightPt;
      tr.font.name = BRAND.fonts.heading; tr.font.size = T.sizePt; tr.font.bold = T.bold; tr.font.color = T.color;
      tr.paragraphFormat.horizontalAlignment = T.align;
    });
    await ctx.sync();
    const missing = slidesWithout(items, titles);
    const lines = ['Titles unified on ' + titles.size + ' of ' + plural(slideCount, 'slide') + '.'];
    if (recased) lines.push('Case changed on ' + plural(recased, 'title') + ' (acronyms like BDO and FY26 kept).');
    if (missing.length) lines.push('No title found on slide(s) ' + missing.join(', ') + ': left unchanged.');
    skipped.forEach(s => lines.push('Skipped ' + s + '.'));
    lines.push('Press Ctrl+Z to undo.');
    log(lines.join('\n'));
  });
}

async function unifyBody() {
  await PowerPoint.run(async ctx => {
    const { items, skipped } = await textShapes(ctx), titles = pickTitles(items);
    let footers = 0, autofit = 0, changed = 0;
    items.forEach(x => {
      if (titles.has(x) || !x.info.hasText) return;
      if (Rules.isFooterLike(x.info, BRAND)) { footers++; return; }
      if (x.info.autoSize === 'AutoSizeTextToFitShape') { autofit++; return; }
      const f = x.shape.textFrame.textRange.font;
      f.size = BRAND.body.sizePt; f.name = BRAND.fonts.body;
      changed++;
    });
    await ctx.sync();
    const lines = ['Body text set to ' + BRAND.body.sizePt + ' pt ' + BRAND.fonts.body + ' in ' + plural(changed, 'box', 'boxes') + '.'];
    if (footers) lines.push('Left ' + plural(footers, 'footer/source line') + ' unchanged.');
    if (autofit) lines.push('Skipped ' + plural(autofit, 'box', 'boxes') + ' set to "Shrink text on overflow": check these by hand (run Brand check).');
    skipped.forEach(s => lines.push('Skipped ' + s + '.'));
    lines.push('Press Ctrl+Z to undo.');
    log(lines.join('\n'));
  });
}

async function changeFonts() {
  const heading = document.getElementById('fontHeading').value.trim();
  const body = document.getElementById('fontBody').value.trim();
  if (!heading || !body) return log('Type both a heading font and a body font first.');
  await PowerPoint.run(async ctx => {
    const { items, skipped } = await textShapes(ctx), titles = pickTitles(items);
    items.forEach(x => (x.shape.textFrame.textRange.font.name = titles.has(x) ? heading : body));
    await ctx.sync();
    const lines = ['Titles set to ' + heading + ' (' + titles.size + '); other text set to ' + body + ' (' + (items.length - titles.size) + ' boxes).'];
    skipped.forEach(s => lines.push('Skipped ' + s + '.'));
    lines.push('Tables, charts and SmartArt are not changed by this button.', 'Press Ctrl+Z to undo.');
    log(lines.join('\n'));
  });
}

async function brandCheck() {
  await PowerPoint.run(async ctx => {
    const { items, slideCount } = await textShapes(ctx), titles = pickTitles(items), T = BRAND.title;
    const bySlide = {};
    const add = (n, msg) => { const m = (bySlide[n] = bySlide[n] || {}); m[msg] = (m[msg] || 0) + 1; };
    items.forEach(x => {
      const i = x.info;
      if (i.hasText && i.font && BRAND.fonts.allowed.indexOf(i.font) < 0) add(x.index, 'font "' + i.font + '" is not a brand font');
      if (i.hasText && !i.font) add(x.index, 'a box mixes several fonts');
      if (i.hasText && i.size && i.size < BRAND.body.minSizePt && !Rules.isFooterLike(i, BRAND)) add(x.index, 'text at ' + i.size + ' pt is below ' + BRAND.body.minSizePt + ' pt');
      if (i.hasText && i.color && !Rules.inPalette(i.color, BRAND.palette)) add(x.index, 'text colour ' + i.color + ' is off-palette (nearest brand colour ' + Rules.nearestColor(i.color, BRAND.palette) + ')');
      if (!i.hasText && x.shape.type === 'Placeholder') add(x.index, 'empty placeholder');
      if (!i.hasText && x.shape.type === 'TextBox') add(x.index, 'empty text box');
      if (i.left < -1 || i.top < -1 || i.left + i.width > BRAND.slide.widthPt + 1 || i.top + i.height > BRAND.slide.heightPt + 1) add(x.index, 'a box runs off the slide');
      if (i.autoSize === 'AutoSizeTextToFitShape') add(x.index, 'a box shrinks its text to fit');
    });
    titles.forEach(x => {
      if (Rules.offPosition(x.info, T)) add(x.index, 'title is not in the standard position');
      if (x.info.size && x.info.size !== T.sizePt) add(x.index, 'title is ' + x.info.size + ' pt, not ' + T.sizePt + ' pt');
    });
    slidesWithout(items, titles).forEach(n => add(n, 'no title found'));

    const nums = Object.keys(bySlide).map(Number).sort((a, b) => a - b);
    if (!nums.length) return log('No brand issues found on ' + plural(slideCount, 'slide') + '.');
    const lines = n => Object.keys(bySlide[n]).map(m => '  • ' + m + (bySlide[n][m] > 1 ? ' (' + bySlide[n][m] + ' boxes)' : ''));
    const total = nums.reduce((s, n) => s + Object.keys(bySlide[n]).length, 0);
    const text = total + ' point(s) to fix on ' + nums.length + ' of ' + plural(slideCount, 'slide') + ':\n\n' +
      nums.map(n => 'Slide ' + n + '\n' + lines(n).join('\n')).join('\n') + '\n\nGo to slide: ';
    log(text, nums.map(n => ({ slide: n, label: String(n) })));
  });
}
