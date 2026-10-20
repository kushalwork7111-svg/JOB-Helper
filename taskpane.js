/* global Office, PowerPoint, Rules */
const VERSION = '0.4.0';
const TEXT_TYPES = ['GeometricShape', 'TextBox', 'Placeholder', 'Callout'];
const NOT_IN_POWERPOINT = 'This page is the add-in. It only works inside PowerPoint: Home → Add-ins → Client-Ready.';
const SEV = { must: 'Must fix', should: 'Should fix', check: 'Check' };
const SEV_ORDER = { must: 0, should: 1, check: 2 };
const CAT_COLOR = { title: '#E81A3B', font: '#98002E', colour: '#D67900', text: '#5B6E7F', layout: '#008FD2', cleanup: '#009966', content: '#333333' };
const COLOR_NAMES = { '#E81A3B': 'BDO red', '#333333': 'Charcoal', '#5B6E7F': 'Slate', '#98002E': 'Burgundy', '#E7E7E7': 'Pale charcoal',
  '#D67900': 'Gold', '#009966': 'Jade', '#008FD2': 'Ocean', '#FFFFFF': 'White', '#000000': 'Black', '#404040': 'Light charcoal',
  '#666666': 'Mid charcoal', '#F2F2F2': 'Light grey', '#ADADAD': 'Footer grey', '#0062B8': 'Cobalt' };

let BRAND = null;
const state = {
  scope: 'all', scan: null, images: {}, imagesOk: false, ignored: new Set(), open: new Set(),
  filter: { cat: 'all', sev: 'all', view: 'slide', code: null, showIgnored: false }, activity: [], busy: false
};

/* ---------- start-up ---------- */
document.getElementById('ver').textContent = 'v' + VERSION;
if (typeof Office === 'undefined') {
  toast('Could not load Microsoft\'s Office library (appsforoffice.microsoft.com). Check your connection, or ask IT whether it is blocked.', 0);
} else {
  const notReady = setTimeout(() => showHero(NOT_IN_POWERPOINT), 5000);
  Office.onReady(info => { clearTimeout(notReady); return start(info); });
}

async function start(info) {
  if (info.host !== Office.HostType.PowerPoint) return showHero(NOT_IN_POWERPOINT);
  try {
    BRAND = await (await fetch('brand.json', { cache: 'no-store' })).json();
  } catch (e) {
    return showHero('Could not load the brand rules (brand.json). Check your connection and reopen the pane.');
  }
  try { (JSON.parse(localStorage.getItem('cr.ignored') || '[]')).forEach(id => state.ignored.add(id)); } catch (e) { /* storage unavailable */ }
  state.imagesOk = supports('1.8');
  if (!BRAND.approved) $('#draft').hidden = false;
  $('#fontHeading').value = BRAND.fonts.heading;
  $('#fontBody').value = BRAND.fonts.body;
  $('#titleCase').value = BRAND.title.case || 'sentence';
  document.querySelectorAll('[data-brand]').forEach(el => { el.textContent = el.dataset.brand.split('.').reduce((o, k) => o[k], BRAND); });
  renderRules();
  wire();
}

function wire() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
  segment('.toolbar .seg', 'scope', v => { state.scope = v; });
  segment('#sevSeg', 'sev', v => { state.filter.sev = v; renderList(); });
  segment('#viewSeg', 'view', v => { state.filter.view = v; state.filter.code = null; renderList(); });
  if (!supports('1.5')) { const b = document.querySelector('[data-scope="selected"]'); b.disabled = true; b.title = 'Needs a newer PowerPoint'; }
  $('#showIgnored').onchange = e => { state.filter.showIgnored = e.target.checked; renderList(); };
  $('#titleCase').onchange = () => { if (state.scan) scan(); };
  busyButton('#btnScan', scan);
  busyButton('#btnFixAll', () => applyFixes(activeIssues().filter(i => i.safe && i.fix), 'Fix all safe issues'));
  busyButton('#btnBody', bulkBodySize);
  busyButton('#btnFont', bulkFonts);
  busyButton('#btnEmpty', async () => { await ensureScan(); const list = activeIssues().filter(i => i.code === 'empty');
    if (!list.length) return toast('No empty text boxes or placeholders found.');
    confirmSheet('Delete ' + plural(list.length, 'empty box', 'empty boxes') + ' on slide(s) ' + uniq(list.map(i => i.slide)).join(', ') + '?\nCtrl+Z brings them back.',
      () => applyFixes(list, 'Removed empty boxes')); });
  busyButton('#btnTerms', async () => { await ensureScan(); showTab('review'); state.filter.view = 'type'; state.filter.code = 'term';
    setSeg('#viewSeg', 'type'); renderList(); });
  $('#list').addEventListener('click', onListClick);
}

/* ---------- scanning ---------- */
async function ensureScan() { if (!state.scan) await scan(); }

async function scan() {
  $('#empty-state').hidden = true;
  if (!state.scan) $('#list').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  await PowerPoint.run(async ctx => {
    const data = await collect(ctx);
    const res = Rules.findIssues(data.slides, BRAND, { caseMode: $('#titleCase').value });
    state.scan = Object.assign(data, res);
  });
  render();
  loadImages();
}

/** Everything the rules need about the slides in scope, as plain objects. */
async function collect(ctx) {
  const all = ctx.presentation.slides;
  all.load('items/id');
  let slides = all;
  if (state.scope === 'selected') {
    slides = ctx.presentation.getSelectedSlides();
    slides.load('items/id');
  }
  await ctx.sync();
  if (!slides.items.length) throw new Error('No slides are selected.');
  const number = {};
  all.items.forEach((s, i) => (number[s.id] = i + 1));
  slides.items.forEach(s => s.shapes.load('items/type,items/name,items/left,items/top,items/width,items/height,items/id'));
  await ctx.sync();

  const usePh = supports('1.8'), out = [], textShapes = [], fillShapes = [];
  slides.items.forEach(s => {
    const sl = { index: number[s.id], id: s.id, shapes: [] };
    s.shapes.items.forEach(sh => {
      const info = { id: sh.id, name: sh.name, type: sh.type, left: sh.left, top: sh.top, width: sh.width, height: sh.height, isText: false };
      sl.shapes.push(info);
      if (TEXT_TYPES.indexOf(sh.type) >= 0) textShapes.push({ sh, info });
      if (sh.type === 'GeometricShape' || sh.type === 'Callout') fillShapes.push({ sh, info });
    });
    out.push(sl);
  });

  const wantText = x => {
    const tf = x.sh.textFrame, tr = tf.textRange;
    tf.load('hasText,autoSizeSetting'); tr.load('text'); tr.font.load('size,name,color,bold'); tr.paragraphFormat.load('horizontalAlignment');
    if (usePh && x.sh.type === 'Placeholder') x.sh.placeholderFormat.load('type');
  };
  const okText = await loadEach(ctx, textShapes, wantText);
  okText.forEach(x => {
    const tf = x.sh.textFrame, tr = tf.textRange, f = tr.font;
    let ph = null;
    try { if (usePh && x.sh.type === 'Placeholder') ph = x.sh.placeholderFormat.type; } catch (e) { /* not loaded */ }
    Object.assign(x.info, { isText: true, hasText: tf.hasText, text: tr.text || '', font: f.name, size: f.size, color: f.color,
      bold: f.bold, align: tr.paragraphFormat.horizontalAlignment, autoSize: tf.autoSizeSetting, placeholderType: ph });
  });
  const okFill = await loadEach(ctx, fillShapes, x => x.sh.fill.load('type,foregroundColor'));
  okFill.forEach(x => { if (x.sh.fill.type === 'Solid' && x.sh.fill.foregroundColor) x.info.fill = x.sh.fill.foregroundColor; });
  return { slides: out, slideCount: out.length, skippedText: textShapes.length - okText.length };
}

/** Load for every item in one round trip; if one fails (e.g. a picture placeholder), retry one by one. */
async function loadEach(ctx, list, want) {
  try { list.forEach(want); await ctx.sync(); return list; } catch (e) { /* fall through */ }
  const ok = [];
  for (const x of list) { try { want(x); await ctx.sync(); ok.push(x); } catch (e) { /* skip */ } }
  return ok;
}

/* ---------- slide pictures (PowerPoint 1.8+); otherwise a scale drawing is shown ---------- */
async function loadImages() {
  if (!state.imagesOk || !state.scan) return;
  const ids = uniq(activeIssues().map(i => i.slideId)).filter(id => !state.images[id]);
  for (const id of ids) {
    try {
      let data = null;
      await PowerPoint.run(async ctx => {
        const r = ctx.presentation.slides.getItem(id).getImageAsBase64({ width: 720 });
        await ctx.sync();
        data = 'data:image/png;base64,' + r.value;
      });
      state.images[id] = data;
      document.querySelectorAll('image[data-slide="' + cssEsc(id) + '"]').forEach(img => {
        img.setAttribute('href', data); img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', data);
        const g = img.parentNode.querySelector('.schematic'); if (g) g.style.display = 'none';
      });
    } catch (e) { state.imagesOk = false; return; }
  }
}

/* ---------- applying fixes ---------- */
async function applyFixes(list, label) {
  list = list.filter(i => i.fix && i.shapeId);
  if (!list.length) return toast('Nothing to fix here.');
  let applied = 0, skipped = 0;
  await PowerPoint.run(async ctx => {
    const groups = new Map();
    list.forEach(i => {
      const k = i.slideId + '|' + i.shapeId;
      if (!groups.has(k)) groups.set(k, { slideId: i.slideId, shapeId: i.shapeId, issues: [] });
      groups.get(k).issues.push(i);
    });
    const entries = [...groups.values()];
    entries.forEach(e => {
      const shapes = ctx.presentation.slides.getItem(e.slideId).shapes;
      e.shape = shapes.getItemOrNullObject ? shapes.getItemOrNullObject(e.shapeId) : shapes.getItem(e.shapeId);
      e.shape.load('id');
      if (e.issues.some(i => i.fix.kind === 'text')) e.shape.textFrame.textRange.load('text');
    });
    await ctx.sync();
    entries.forEach(e => {
      if (e.shape.isNullObject) { skipped += e.issues.length; return; }
      const tr = () => e.shape.textFrame.textRange;
      const texts = e.issues.filter(i => i.fix.kind === 'text');
      if (texts.length) {
        if (tr().text !== texts[0].fix.text) skipped += texts.length; // edited since the scan
        else {
          Rules.mergeOps([].concat(...texts.map(i => i.fix.ops))).forEach(o => { tr().getSubstring(o.start, o.length).text = o.to; });
          applied += texts.length;
        }
      }
      e.issues.filter(i => i.fix.kind !== 'text').forEach(i => {
        const f = i.fix, s = e.shape;
        if (f.kind === 'font') tr().font.name = f.name;
        else if (f.kind === 'color') tr().font.color = f.color;
        else if (f.kind === 'size') tr().font.size = f.size;
        else if (f.kind === 'bold') tr().font.bold = f.bold;
        else if (f.kind === 'align') tr().paragraphFormat.horizontalAlignment = f.value;
        else if (f.kind === 'fill') s.fill.setSolidColor(f.color);
        else if (f.kind === 'box') { s.left = f.box.left; s.top = f.box.top; s.width = f.box.width; s.height = f.box.height; }
        else if (f.kind === 'move') { s.left = f.left; s.top = f.top; }
        else if (f.kind === 'delete') s.delete();
        applied++;
      });
    });
    await ctx.sync();
  });
  uniq(list.map(i => i.slideId)).forEach(id => delete state.images[id]);
  logActivity(label + ': ' + plural(applied, 'change') + (skipped ? ', ' + skipped + ' skipped (edited since the scan)' : '') +
    ' on slide(s) ' + uniq(list.map(i => i.slide)).join(', '));
  toast('✓ ' + label + ': ' + plural(applied, 'change') + ' applied.' + (skipped ? '\n' + skipped + ' skipped because the text changed since the scan.' : '') + '\nCtrl+Z undoes it.');
  await scan();
}

async function selectShape(issue) {
  Office.context.document.goToByIdAsync(issue.slide, Office.GoToType.Index, () => {});
  if (!issue.shapeId || !supports('1.5')) return;
  try {
    await PowerPoint.run(async ctx => { ctx.presentation.slides.getItem(issue.slideId).setSelectedShapes([issue.shapeId]); await ctx.sync(); });
  } catch (e) { /* selecting is a convenience only */ }
}

/* ---------- bulk tools ---------- */
async function bulkBodySize() {
  await ensureScan();
  const titles = new Set(state.scan.slides.map(sl => {
    const t = sl.shapes.filter(s => s.isText), i = Rules.pickTitleIndex(t, BRAND.slide.heightPt);
    return i >= 0 ? sl.id + '|' + t[i].id : null;
  }));
  const list = [];
  let footers = 0, autofit = 0;
  state.scan.slides.forEach(sl => sl.shapes.forEach(s => {
    if (!s.isText || !s.hasText || titles.has(sl.id + '|' + s.id)) return;
    if (Rules.isFooterLike(s, BRAND)) { footers++; return; }
    if (s.autoSize === 'AutoSizeTextToFitShape') { autofit++; return; }
    if (s.size === BRAND.body.sizePt && s.font === BRAND.fonts.body) return;
    list.push({ slide: sl.index, slideId: sl.id, shapeId: s.id, fix: { kind: 'size', size: BRAND.body.sizePt } },
      { slide: sl.index, slideId: sl.id, shapeId: s.id, fix: { kind: 'font', name: BRAND.fonts.body } });
  }));
  if (!list.length) return toast('Body text is already ' + BRAND.body.sizePt + ' pt everywhere.' + (footers ? '\n' + footers + ' footer/source lines left as they are.' : ''));
  await applyFixes(list, 'Body text set to ' + BRAND.body.sizePt + ' pt' + (autofit ? ' (' + autofit + ' shrink-to-fit boxes skipped)' : ''));
}

async function bulkFonts() {
  const heading = $('#fontHeading').value.trim(), body = $('#fontBody').value.trim();
  if (!heading || !body) return toast('Type both a heading font and a body font first.');
  await ensureScan();
  const list = [];
  state.scan.slides.forEach(sl => {
    const t = sl.shapes.filter(s => s.isText && s.hasText), ti = Rules.pickTitleIndex(t, BRAND.slide.heightPt);
    t.forEach((s, k) => {
      const want = k === ti ? heading : body;
      if (Rules.normalizeFont(s.font) !== want) list.push({ slide: sl.index, slideId: sl.id, shapeId: s.id, fix: { kind: 'font', name: want } });
    });
  });
  if (!list.length) return toast('All text already uses ' + heading + (heading === body ? '' : ' / ' + body) + '.');
  await applyFixes(list, 'Fonts set to ' + heading + (heading === body ? '' : ' / ' + body));
}

/* ---------- rendering ---------- */
function activeIssues() { return state.scan ? state.scan.issues.filter(i => !state.ignored.has(i.id)) : []; }

function visibleIssues(withIgnored) {
  if (!state.scan) return [];
  const f = state.filter;
  return state.scan.issues.filter(i => (withIgnored || !state.ignored.has(i.id)) &&
    (f.cat === 'all' || i.category === f.cat) && (f.sev === 'all' || i.severity === f.sev) && (!f.code || i.code === f.code));
}

function render() {
  const sc = state.scan, act = activeIssues();
  $('#summary').hidden = false; $('#filters').hidden = false;
  const dirty = new Set(act.map(i => i.slideId)), clean = sc.slideCount - dirty.size;
  const score = Math.round(100 * clean / Math.max(1, sc.slideCount));
  $('#scoreNum').textContent = score + '%';
  const ring = $('#ringFg');
  ring.style.strokeDashoffset = String(314.16 * (1 - score / 100));
  ring.style.stroke = score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--should)' : 'var(--red)';
  $('#stIssues').textContent = act.length;
  const safe = act.filter(i => i.safe && i.fix);
  $('#stFixable').textContent = safe.length;
  $('#stClean').textContent = clean + '/' + sc.slideCount;
  $('#btnFixAll').textContent = safe.length ? 'Fix all safe issues (' + safe.length + ')' : 'No safe fixes left';
  $('#btnFixAll').disabled = !safe.length;

  const byCat = {};
  act.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
  const max = Math.max(1, ...Object.values(byCat));
  $('#catBars').innerHTML = Object.keys(Rules.CATEGORIES).filter(c => byCat[c]).map(c =>
    '<div class="catbar" data-cat="' + c + '"><span>' + Rules.CATEGORIES[c] + '</span><div class="track"><i style="width:' + (100 * byCat[c] / max) +
    '%;background:' + CAT_COLOR[c] + '"></i></div><b>' + byCat[c] + '</b></div>').join('');
  $('#catBars').querySelectorAll('.catbar').forEach(b => b.onclick = () => { state.filter.cat = b.dataset.cat; renderList(); });

  const notes = [];
  const fonts = Object.keys(sc.foreignFonts);
  if (fonts.length) notes.push('Off-brand fonts in use: <b>' + fonts.map(esc).join(', ') + '</b>. If the deck was not started from the BDO 2023 template, theme text shows in these fonts.');
  if (sc.skippedText) notes.push(plural(sc.skippedText, 'placeholder') + ' holding a picture, chart or table were not checked.');
  notes.push('Also check by hand: page numbers (Insert → Header &amp; Footer), hidden slides, speaker notes, tables and charts.');
  $('#deckNotes').innerHTML = notes.map(n => '<div>' + n + '</div>').join('');
  renderList();
}

function renderList() {
  if (!state.scan) return;
  const all = activeIssues(), f = state.filter;
  const cats = {};
  all.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
  $('#catChips').innerHTML = '<button class="fchip' + (f.cat === 'all' ? ' on' : '') + '" data-cat="all">All<i>' + all.length + '</i></button>' +
    Object.keys(Rules.CATEGORIES).filter(c => cats[c]).map(c => '<button class="fchip' + (f.cat === c ? ' on' : '') + '" data-cat="' + c + '">' +
      Rules.CATEGORIES[c] + '<i>' + cats[c] + '</i></button>').join('');
  $('#catChips').querySelectorAll('.fchip').forEach(b => b.onclick = () => { state.filter.cat = b.dataset.cat; state.filter.code = null; renderList(); });
  $('#ignoredCount').textContent = state.ignored.size ? '(' + state.scan.issues.filter(i => state.ignored.has(i.id)).length + ')' : '';

  const list = visibleIssues(f.showIgnored);
  const y = window.scrollY;
  if (!list.length) {
    $('#list').innerHTML = '<div class="card hero"><h2>' + (all.length ? 'Nothing matches these filters' : '🎉 No brand issues found') + '</h2><p>' +
      (all.length ? 'Change the filters above to see the rest.' : 'Every slide in scope follows the BDO rules the add-in checks.') + '</p></div>';
  } else if (f.view === 'slide') {
    const bySlide = groupBy(list, i => i.slideId);
    $('#list').innerHTML = [...bySlide.values()].sort((a, b) => a[0].slide - b[0].slide).map(slideCard).join('');
  } else {
    const byCode = groupBy(list, i => i.code);
    $('#list').innerHTML = (f.code ? '<button class="btn ghost small" data-act="allcodes">← All issue types</button>' : '') +
      [...byCode.values()].sort((a, b) => SEV_ORDER[a[0].severity] - SEV_ORDER[b[0].severity] || b.length - a.length).map(groupCard).join('');
  }
  window.scrollTo(0, y);
  $('#activity').hidden = !state.activity.length;
  loadImages();
}

function slideCard(issues) {
  const sl = slideOf(issues[0].slideId);
  issues.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const counts = { must: 0, should: 0, check: 0 };
  issues.forEach(i => counts[i.severity]++);
  const fixable = issues.filter(i => i.safe && i.fix && !state.ignored.has(i.id));
  if (!issues.some(i => state.open.has(i.id))) state.open.add(issues[0].id);
  return '<article class="card slide-card"><div class="slide-head"><h4>Slide ' + sl.index + '</h4><div class="sev-pills">' +
    ['must', 'should', 'check'].filter(s => counts[s]).map(s => '<span class="pill ' + s + '" title="' + SEV[s] + '">' + counts[s] + '</span>').join('') +
    '</div><button class="btn ghost small" data-act="go" data-slide="' + sl.index + '">Go to</button>' +
    (fixable.length ? '<button class="btn small" data-act="fixslide" data-slide-id="' + esc(sl.id) + '">Fix slide (' + fixable.length + ')</button>' : '') +
    '</div><div class="preview">' + slideSvg(sl, issues) + '</div><ul class="issues">' +
    issues.map((i, k) => issueRow(i, k + 1)).join('') + '</ul></article>';
}

function groupCard(issues) {
  const first = issues[0], fixable = issues.filter(i => i.fix && !i.destructive && !state.ignored.has(i.id));
  return '<article class="card slide-card"><div class="group-head"><span class="num ' + first.severity + '">' + issues.length + '</span><h4>' +
    esc(groupTitle(first)) + '</h4>' + (!state.filter.code ? '<button class="btn ghost small" data-act="code" data-code="' + first.code + '">Only these</button>' : '') +
    (fixable.length ? '<button class="btn small" data-act="fixcode" data-code="' + first.code + '">Apply all (' + fixable.length + ')</button>' : '') +
    '</div><ul class="issues">' + issues.sort((a, b) => a.slide - b.slide).map((i, k) => issueRow(i, k + 1, true)).join('') + '</ul></article>';
}

function groupTitle(i) {
  return { term: 'House style (₹ … Cr / lakh)', leftover: 'Leftover draft text', case: 'Titles not in the chosen case' }[i.code] || i.title;
}

function issueRow(i, n, showSlide) {
  const open = state.open.has(i.id), ign = state.ignored.has(i.id);
  return '<li class="issue' + (open ? ' open' : '') + (ign ? ' ignored' : '') + '" data-id="' + esc(i.id) + '">' +
    '<div class="issue-head" data-act="toggle"><span class="num ' + i.severity + '">' + n + '</span><div class="issue-title">' +
    (showSlide ? '<span class="slide-tag">Slide ' + i.slide + '</span>' : '') + esc(i.title) +
    '<small>' + SEV[i.severity] + ' · ' + Rules.CATEGORIES[i.category] + (i.shapeName ? ' · ' + esc(i.shapeName) : '') + '</small></div><span class="caret">›</span></div>' +
    '<div class="issue-body">' + (open ? issueBody(i) : '') + '</div></li>';
}

function issueBody(i) {
  const sl = slideOf(i.slideId);
  let h = '';
  if (i.rect) h += '<div class="zoom">' + zoomSvg(sl, i) + '<span class="zlabel">Zoomed in' + (i.target ? ' · dashed = target' : '') + '</span></div>';
  h += sampleHtml(i, sl) + changeHtml(i);
  if (i.detail) h += '<p class="detail">' + esc(i.detail) + '</p>';
  h += '<div class="actions">';
  if (i.fix && i.destructive) h += '<button class="btn small" data-act="delete">Delete box</button>';
  else if (i.fix) h += '<button class="btn small primary" data-act="fix">' + (i.code === 'term' ? 'Apply' : 'Fix') + '</button>';
  if (i.shapeId) h += '<button class="btn small" data-act="select">Select on slide</button>';
  else h += '<button class="btn small" data-act="go" data-slide="' + i.slide + '">Go to slide</button>';
  h += '<button class="btn ghost small" data-act="ignore">' + (state.ignored.has(i.id) ? 'Restore' : 'Ignore') + '</button></div>';
  return h;
}

function changeHtml(i) {
  if (i.kind === 'colour') return '<div class="change">' + swatch(i.from) + '<span class="arrow">→</span>' + swatch(i.to) + '</div>';
  if (i.kind === 'font') return '<div class="change"><span class="val from" style="font-family:\'' + esc(i.from) + '\'">' + esc(i.from) +
    '</span><span class="arrow">→</span><span class="val to" style="font-family:\'' + esc(i.to) + '\'">' + esc(i.to) + '</span></div>';
  if (i.kind === 'value') return '<div class="change"><span class="val from">' + esc(i.from) + '</span><span class="arrow">→</span><span class="val to">' + esc(i.to) + '</span></div>';
  if (i.kind === 'text' && i.segments && i.code !== 'case') return '<div class="textdiff">' + i.segments.map(g => {
    if (g.t === 'same') return esc(g.s);
    if (g.t === 'flag') return '<mark>' + esc(g.s) + '</mark>';
    if (g.t === 'del') return /^\s+$/.test(g.s) ? '<span class="ws" title="extra space">' + '·'.repeat(g.s.length) + '</span>' : '<del>' + esc(g.s) + '</del>';
    return '<ins>' + esc(g.s) + '</ins>';
  }).join('') + '</div>';
  return '';
}

/** The real words, styled as they are now and as they will be after the fix. */
const SAMPLE_CODES = ['font', 'mixedFont', 'textColour', 'titleColour', 'titleSize', 'titleBold', 'small', 'case'];
function sampleHtml(i, sl) {
  if (SAMPLE_CODES.indexOf(i.code) < 0) return '';
  const s = sl.shapes.find(x => x.id === i.shapeId);
  if (!s || !s.text) return '';
  const now = { font: Rules.normalizeFont(s.font) || 'Trebuchet MS', size: s.size || 12, color: s.color || '#333333', bold: !!s.bold };
  const after = Object.assign({}, now), f = i.fix || {};
  if (f.kind === 'font') after.font = f.name;
  if (f.kind === 'color') after.color = f.color;
  if (f.kind === 'size') after.size = f.size;
  if (f.kind === 'bold') after.bold = f.bold;
  const text = s.text.replace(/\s+/g, ' ').trim(), cut = t => t.length > 70 ? t.slice(0, 70) + '…' : t;
  const afterText = f.kind === 'text' ? Rules.applyOps(s.text, f.ops).replace(/\s+/g, ' ').trim() : text;
  const line = (st, t) => '<span style="font-family:\'' + esc(st.font) + '\',sans-serif;font-size:' + Math.max(10, Math.min(22, st.size * 0.8)) +
    'px;color:' + esc(st.color) + ';font-weight:' + (st.bold ? 700 : 400) + '">' + esc(cut(t)) + '</span>';
  const meta = st => esc(st.font) + ' · ' + st.size + ' pt' + (st.bold ? ' · bold' : '');
  return '<div class="sample"><div class="srow"><span class="tag">Now</span><div>' + line(now, text) + '<small>' + meta(now) + '</small></div></div>' +
    '<div class="srow"><span class="tag ok">After</span><div>' + line(after, afterText) + '<small>' + meta(after) + '</small></div></div></div>';
}

function swatch(hex) {
  const name = COLOR_NAMES[String(hex).toUpperCase()];
  return '<span class="sw"><i style="background:' + esc(hex) + '"></i><span>' + esc(hex) + (name ? '<small>' + name + '</small>' : '<small>off-palette</small>') + '</span></span>';
}

/* ---------- slide drawings ---------- */
let svgSeq = 0;
function slideLayer(sl, uid) {
  const W = BRAND.slide.widthPt, H = BRAND.slide.heightPt, img = state.images[sl.id];
  let g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>';
  g += '<image data-slide="' + esc(sl.id) + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="none"' + (img ? ' href="' + img + '"' : '') + '/>';
  g += '<g class="schematic"' + (img ? ' style="display:none"' : '') + '>';
  sl.shapes.forEach((s, k) => {
    const fill = s.fill || (s.type === 'Picture' ? '#E4E7EC' : 'none');
    g += '<rect x="' + s.left + '" y="' + s.top + '" width="' + Math.max(1, s.width) + '" height="' + Math.max(1, s.height) + '" fill="' + fill +
      '" stroke="#D0D5DD" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    if (s.isText && s.hasText) {
      const fs = Math.max(6, Math.min(s.size || 12, 30)), id = 'c' + uid + '_' + k;
      g += '<clipPath id="' + id + '"><rect x="' + s.left + '" y="' + s.top + '" width="' + Math.max(1, s.width) + '" height="' + Math.max(1, s.height) + '"/></clipPath>' +
        '<text clip-path="url(#' + id + ')" x="' + (s.left + 3) + '" y="' + (s.top + fs + 1) + '" font-size="' + fs + '" fill="' + (s.color || '#333') +
        '" font-family="' + esc(Rules.normalizeFont(s.font) || 'Trebuchet MS') + '"' + (s.bold ? ' font-weight="bold"' : '') + '>' + esc(s.text.replace(/\s+/g, ' ').slice(0, 90)) + '</text>';
    }
  });
  return g + '</g>';
}

function slideSvg(sl, issues) {
  const uid = ++svgSeq, W = BRAND.slide.widthPt, H = BRAND.slide.heightPt;
  let g = '<svg viewBox="-12 -12 ' + (W + 24) + ' ' + (H + 24) + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="background:#E9ECF0">' + slideLayer(sl, uid);
  const seen = {};
  issues.forEach((i, k) => {
    if (!i.rect || state.ignored.has(i.id)) return;
    const key = i.shapeId, c = 'var(--' + i.severity + ')';
    if (!seen[key]) {
      seen[key] = 0;
      g += '<rect x="' + i.rect.left + '" y="' + i.rect.top + '" width="' + Math.max(2, i.rect.width) + '" height="' + Math.max(2, i.rect.height) +
        '" fill="none" stroke="' + c + '" stroke-width="2.5" vector-effect="non-scaling-stroke" rx="2"/>';
    }
    const bx = i.rect.left + 10 + 26 * seen[key]++, by = Math.max(10, i.rect.top);
    g += '<circle cx="' + bx + '" cy="' + by + '" r="11" fill="' + c + '"/><text x="' + bx + '" y="' + (by + 4.5) + '" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">' + (k + 1) + '</text>';
  });
  return g + '</svg>';
}

function zoomSvg(sl, i) {
  const uid = ++svgSeq, r = i.rect, t = i.target;
  // Wide boxes (titles, banners): focus on where the text starts so it stays readable.
  let x0 = r.left, y0 = r.top, x1 = r.left + (t ? r.width : Math.min(r.width, 420)), y1 = r.top + r.height;
  if (t) { x0 = Math.min(x0, t.left); y0 = Math.min(y0, t.top); x1 = Math.max(x1, t.left + t.width); y1 = Math.max(y1, t.top + t.height); }
  const pad = Math.max(18, 0.12 * Math.max(x1 - x0, y1 - y0));
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0;
  const A = 2.2; // keep zooms a consistent, readable shape
  if (w / h < A) { const nw = h * A; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / A; y0 -= (nh - h) / 2; h = nh; }
  const c = 'var(--' + i.severity + ')';
  let g = '<svg viewBox="' + x0 + ' ' + y0 + ' ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="background:#E9ECF0">' + slideLayer(sl, uid);
  g += '<rect x="' + r.left + '" y="' + r.top + '" width="' + Math.max(2, r.width) + '" height="' + Math.max(2, r.height) + '" fill="' + c +
    '" fill-opacity=".08" stroke="' + c + '" stroke-width="2.5" vector-effect="non-scaling-stroke" rx="2"/>';
  if (t) g += '<rect x="' + t.left + '" y="' + t.top + '" width="' + t.width + '" height="' + t.height + '" fill="none" stroke="var(--ok)" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>';
  return g + '</svg>';
}

function renderRules() {
  const B = BRAND, P = B.palette;
  const sw = list => '<div class="palette">' + list.map(c => '<div><i style="background:' + c + '"></i>' + (COLOR_NAMES[c.toUpperCase()] || c) + '<br>' + c + '</div>').join('') + '</div>';
  $('#rulesBody').innerHTML = '<h3>BDO rules in use</h3><p>From the BDO 2023 guidelines and PowerPoint template' + (B.approved ? '.' : ', awaiting approval.') + '</p>' +
    '<dl class="kv"><dt>Font</dt><dd>' + esc(B.fonts.heading) + '</dd><dt>Titles</dt><dd>' + B.title.sizePt + ' pt, BDO red, not bold, at ' + B.title.leftPt + ' / ' + B.title.topPt + ' pt</dd>' +
    '<dt>Body</dt><dd>' + B.body.sizePt + ' pt charcoal, left aligned</dd><dt>Smallest</dt><dd>' + B.body.minSizePt + ' pt (footers exempt)</dd>' +
    '<dt>House style</dt><dd>₹ … Cr / lakh</dd></dl><h3 style="margin-top:12px">Primary palette</h3>' + sw(P.primary) +
    '<h3>Secondary (highlights)</h3>' + sw(P.secondary) + '<h3>Also allowed</h3>' + sw(P.neutrals) +
    '<p>Tints of every colour are allowed except BDO red and burgundy.</p>';
}

/* ---------- events ---------- */
async function onListClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || state.busy) return;
  const act = el.dataset.act, li = el.closest('.issue'), issue = li ? state.scan.issues.find(i => i.id === li.dataset.id) : null;
  if (act === 'toggle') {
    if (state.open.has(issue.id)) state.open.delete(issue.id); else state.open.add(issue.id);
    li.classList.toggle('open');
    li.querySelector('.issue-body').innerHTML = state.open.has(issue.id) ? issueBody(issue) : '';
    return;
  }
  if (act === 'go') return Office.context.document.goToByIdAsync(Number(el.dataset.slide), Office.GoToType.Index, () => {});
  if (act === 'select') return selectShape(issue);
  if (act === 'ignore') {
    if (state.ignored.has(issue.id)) state.ignored.delete(issue.id); else state.ignored.add(issue.id);
    try { localStorage.setItem('cr.ignored', JSON.stringify([...state.ignored])); } catch (err) { /* storage unavailable */ }
    return render();
  }
  if (act === 'code') { state.filter.code = el.dataset.code; return renderList(); }
  if (act === 'allcodes') { state.filter.code = null; return renderList(); }
  if (act === 'delete') {
    if (!el.classList.contains('armed')) {
      el.classList.add('armed'); el.textContent = 'Click again to delete';
      setTimeout(() => { el.classList.remove('armed'); el.textContent = 'Delete box'; }, 3500);
      return;
    }
  }
  let list = null, label = '';
  if (act === 'fix' || act === 'delete') { list = [issue]; label = issue.title + ' (slide ' + issue.slide + ')'; }
  if (act === 'fixslide') { list = activeIssues().filter(i => i.slideId === el.dataset.slideId && i.safe && i.fix); label = 'Slide ' + (list[0] && list[0].slide) + ' fixed'; }
  if (act === 'fixcode') { list = visibleIssues(false).filter(i => i.code === el.dataset.code && i.fix && !i.destructive); label = groupTitle(list[0]); }
  if (list) await runBusy(el, () => applyFixes(list, label));
}

/* ---------- small helpers ---------- */
function $(s) { return document.querySelector(s); }
function supports(v) { return Office.context.requirements.isSetSupported('PowerPointApi', v); }
function plural(n, w, many) { return n + ' ' + (n === 1 ? w : many || w + 's'); }
function uniq(a) { return [...new Set(a)]; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
function groupBy(list, key) { const m = new Map(); list.forEach(x => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }
function slideOf(id) { return state.scan.slides.find(s => s.id === id); }
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p.id !== 'tab-' + name; });
}
function showHero(text) { $('#empty-state').hidden = false; $('#empty-state p').textContent = text; }
function segment(sel, key, onChange) {
  const box = $(sel);
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.disabled) return;
    box.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    onChange(b.dataset[key]);
  });
}
function setSeg(sel, value) { $(sel).querySelectorAll('button').forEach(b => b.classList.toggle('on', Object.values(b.dataset).indexOf(value) >= 0)); }
function busyButton(sel, fn) { const b = $(sel); b.onclick = () => runBusy(b, fn); }
async function runBusy(btn, fn) {
  if (state.busy) return;
  state.busy = true; const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + label;
  try { await fn(); } catch (e) { toast('Could not finish: ' + e.message + '\nNothing was changed by the step that failed.', 6000); }
  btn.disabled = false; btn.innerHTML = label; state.busy = false;
  if (btn.id === 'btnFixAll' && state.scan) render();
}
function confirmSheet(text, onYes) {
  $('#confirmText').textContent = text; $('#confirm').hidden = false;
  $('#confirmNo').onclick = () => { $('#confirm').hidden = true; toast('Cancelled. Nothing was changed.'); };
  $('#confirmYes').onclick = () => { $('#confirm').hidden = true; runBusy($('#btnEmpty'), onYes); };
}
let toastTimer = null;
function toast(text, ms) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); if (ms !== 0) toastTimer = setTimeout(() => t.classList.remove('show'), ms || 4000);
}
function logActivity(text) {
  state.activity.unshift(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + text);
  $('#actList').innerHTML = state.activity.map(a => '<li>' + esc(a) + '</li>').join('');
  $('#actCount').textContent = state.activity.length;
}
