/* Pure helper logic: no Office.js here, so it can be unit-tested in Node (tests/run.js). */
(function (root) {
  'use strict';

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Perceptual-ish RGB distance ("redmean"); good enough to snap to a small palette. */
  function colorDistance(a, b) {
    const x = hexToRgb(a), y = hexToRgb(b);
    if (!x || !y) return Infinity;
    const r = (x[0] + y[0]) / 2, dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2];
    return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
  }

  function paletteColors(palette) {
    const all = [].concat(palette.primary || [], palette.secondary || [], palette.neutrals || []);
    return all.map(c => c.toUpperCase()).filter((c, i, a) => a.indexOf(c) === i);
  }

  function nearestColor(hex, palette) {
    let best = null, bestD = Infinity;
    paletteColors(palette).forEach(c => { const d = colorDistance(hex, c); if (d < bestD) { bestD = d; best = c; } });
    return best;
  }

  function inPalette(hex, palette) {
    return !!hex && paletteColors(palette).indexOf(String(hex).toUpperCase()) >= 0;
  }

  /**
   * Words kept as typed when changing case: listed words (BDO, EBITDA), words with digits (FY26, Q3),
   * and in mixed-case text any word with two capitals. In ALL-CAPS text only the first two apply.
   */
  function keeper(text, keepWords) {
    const list = (keepWords || []).map(w => w.toUpperCase());
    const allCaps = !/[a-z]/.test(text);
    return w => {
      const bare = w.replace(/[^A-Za-z0-9&]/g, '').toUpperCase();
      return list.indexOf(bare) >= 0 || /\d/.test(w) || (!allCaps && /[A-Z].*[A-Z]/.test(w));
    };
  }
  const SMALL = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'with'];

  function sentenceCase(text, keepWords) {
    const keep = keeper(String(text), keepWords);
    let first = true;
    return String(text).replace(/[^\s]+/g, w => {
      const out = keep(w) ? w : first ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
      first = false;
      return out;
    });
  }

  function titleCase(text, keepWords) {
    const keep = keeper(String(text), keepWords);
    let i = 0;
    return String(text).replace(/[^\s]+/g, w => {
      const idx = i++;
      if (keep(w)) return w;
      const lower = w.toLowerCase();
      return idx > 0 && SMALL.indexOf(lower) >= 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    });
  }

  function applyCase(text, mode, keepWords) {
    if (mode === 'sentence') return sentenceCase(text, keepWords);
    if (mode === 'title') return titleCase(text, keepWords);
    return text;
  }

  /**
   * Pick the title on one slide. Each candidate: { name, top, size, hasText, placeholderType? }.
   * Returns the index of the title, or -1. Order: Title placeholder type → name "Title…" →
   * largest font among text boxes in the top quarter (ties: the higher one).
   */
  function pickTitleIndex(shapes, slideHeightPt) {
    let i = shapes.findIndex(s => s.placeholderType === 'Title' || s.placeholderType === 'CenterTitle');
    if (i >= 0) return i;
    i = shapes.findIndex(s => /^title/i.test(s.name || ''));
    if (i >= 0) return i;
    let best = -1;
    shapes.forEach((s, k) => {
      if (!s.hasText || s.top >= slideHeightPt * 0.25) return;
      if (best < 0) { best = k; return; }
      const b = shapes[best], ds = (s.size || 0) - (b.size || 0);
      if (ds > 0 || (ds === 0 && s.top < b.top)) best = k;
    });
    return best;
  }

  function offPosition(shape, title) {
    return Math.abs(shape.left - title.leftPt) > title.tolerancePt || Math.abs(shape.top - title.topPt) > title.tolerancePt;
  }

  /** True for text in the bottom band of the slide: source lines, footers, page numbers. Left alone by body sizing. */
  function isFooterLike(shape, brand) {
    return shape.top >= brand.slide.heightPt - brand.margins.bottomPt - 20;
  }

  function mostCommon(values) {
    const counts = {};
    let best = null;
    values.filter(v => v != null).forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
      if (best === null || counts[v] > counts[best]) best = v;
    });
    return best;
  }

  /**
   * True if hex is a tint (mix with white) of base, e.g. 50% Slate. The guidelines allow tints of every
   * palette colour except those in palette.noTints (BDO red and burgundy).
   */
  function isTintOf(hex, base) {
    const c = hexToRgb(hex), b = hexToRgb(base);
    if (!c || !b) return false;
    let k = null;
    for (let i = 0; i < 3; i++) {
      if (b[i] === 255) { if (c[i] !== 255) return false; continue; }
      const t = (c[i] - b[i]) / (255 - b[i]);
      if (t < -0.02 || t > 1) return false;
      if (k === null) k = t; else if (Math.abs(t - k) > 0.04) return false;
    }
    return true;
  }

  function isBrandColor(hex, palette) {
    if (!hex) return true;
    if (inPalette(hex, palette)) return true;
    const noTints = (palette.noTints || []).map(c => c.toUpperCase());
    return paletteColors(palette).some(c => noTints.indexOf(c) < 0 && c !== '#FFFFFF' && c !== '#000000' && isTintOf(hex, c));
  }

  /** The brand colour to use instead of hex, or null when hex is already fine. */
  function snapColor(hex, palette) {
    return isBrandColor(hex, palette) ? null : nearestColor(hex, palette);
  }

  /** Leftover drafting text such as XX, TBD, [ ], DRAFT. Returns the distinct matches. */
  function findLeftovers(text, patterns) {
    const found = [];
    (patterns || []).forEach(p => {
      const m = String(text).match(new RegExp(p, p === '\\bDRAFT\\b' ? 'g' : 'gi'));
      (m || []).forEach(x => { if (found.indexOf(x) < 0) found.push(x); });
    });
    return found;
  }

  /** [start, length] of each run of 2+ spaces inside a line (indentation at the start of a line is left alone). */
  function doubleSpaceRanges(text) {
    const out = [], rx = / {2,}/g;
    let m;
    while ((m = rx.exec(text))) {
      const before = text.charAt(m.index - 1);
      if (m.index > 0 && before !== '\n' && before !== '\r' && before !== '\v') out.push([m.index, m[0].length]);
    }
    return out;
  }

  /** "Trebuchet MS (Headings)" → "Trebuchet MS"; theme references (+mj-lt) → null (unknown). */
  function normalizeFont(name) {
    if (!name) return null;
    if (/^\+m[jn]-/.test(name)) return null;
    return name.replace(/\s*\((Headings|Body)\)$/, '');
  }

  /**
   * House-style replacements in text. terms: [{ label, find, replace, flags }].
   * Returns non-overlapping [{ start, length, from, to, label }] sorted by position.
   */
  function findTerms(text, terms) {
    const hits = [];
    (terms || []).forEach(t => {
      const rx = new RegExp(t.find, (t.flags || '').indexOf('g') >= 0 ? t.flags : (t.flags || '') + 'g');
      let m;
      while ((m = rx.exec(text))) {
        if (!m[0].length) { rx.lastIndex++; continue; }
        const to = t.replace.replace(/\$(\d)/g, (_, d) => m[d] || '');
        if (to !== m[0]) hits.push({ start: m.index, length: m[0].length, from: m[0], to, label: t.label });
      }
    });
    hits.sort((a, b) => a.start - b.start);
    return hits.filter((h, i) => !hits.slice(0, i).some(p => p.start + p.length > h.start));
  }

  /** Text edits that turn `from` into `to` when only letter case differs: [{ start, length, to }]. */
  function caseOps(from, to) {
    if (from.length !== to.length) return [{ start: 0, length: from.length, to }];
    const ops = [];
    for (let i = 0; i < from.length; i++) {
      if (from[i] === to[i]) continue;
      let j = i;
      while (j < from.length && from[j] !== to[j]) j++;
      ops.push({ start: i, length: j - i, to: to.slice(i, j) });
      i = j;
    }
    return ops;
  }

  /** Apply non-overlapping text edits (positions refer to the original text). */
  function applyOps(text, ops) {
    let out = text;
    mergeOps(ops).forEach(o => { out = out.slice(0, o.start) + o.to + out.slice(o.start + o.length); });
    return out;
  }

  /** Sort edits from the end of the text backwards and drop any that overlap an edit already kept. */
  function mergeOps(ops) {
    const kept = [];
    ops.slice().sort((a, b) => b.start - a.start || b.length - a.length).forEach(o => {
      if (!kept.some(k => o.start < k.start + k.length && k.start < o.start + o.length)) kept.push(o);
    });
    return kept;
  }

  /**
   * Before/after segments for showing a text change, trimmed to some context around the edits:
   * [{ t: 'same' | 'del' | 'ins', s }].
   */
  function diffSegments(text, ops, context) {
    const c = context == null ? 28 : context, sorted = mergeOps(ops).reverse();
    if (!sorted.length) return [{ t: 'same', s: text }];
    const segs = [], first = sorted[0].start, last = sorted[sorted.length - 1];
    let pos = Math.max(0, first - c);
    if (pos > 0) segs.push({ t: 'same', s: '…' });
    sorted.forEach(o => {
      if (o.start > pos) segs.push({ t: 'same', s: text.slice(pos, o.start) });
      if (o.length) segs.push({ t: 'del', s: text.substr(o.start, o.length) });
      if (o.to) segs.push({ t: 'ins', s: o.to });
      pos = o.start + o.length;
    });
    const end = Math.min(text.length, last.start + last.length + c);
    if (end > pos) segs.push({ t: 'same', s: text.slice(pos, end) });
    if (end < text.length) segs.push({ t: 'same', s: '…' });
    return segs;
  }

  const CATEGORIES = {
    title: 'Titles', font: 'Fonts', colour: 'Colours', text: 'Text', layout: 'Layout', cleanup: 'Clean-up', content: 'Draft text'
  };

  /**
   * Every brand issue in the deck, each with exactly what would change.
   * slides: [{ index, id, shapes: [{ id, name, type, left, top, width, height, hasText, text, font, size,
   *            color, bold, align, autoSize, placeholderType, fill, isText }] }]
   * Returns { issues, foreignFonts } where each issue is
   * { id, slide, slideId, shapeId, shapeName, code, category, severity: must|should|check, title, detail,
   *   rect, target?, from?, to?, kind?, segments?, fix?, safe, destructive? }.
   */
  function findIssues(slides, brand, opts) {
    const o = opts || {}, T = brand.title, caseMode = o.caseMode || T.case || 'none';
    const H = brand.slide.heightPt, W = brand.slide.widthPt;
    const issues = [], foreignFonts = {};
    const r1 = n => Math.round(n * 10) / 10;
    slides.forEach(sl => {
      const texts = sl.shapes.filter(s => s.isText);
      const ti = pickTitleIndex(texts, H), title = ti >= 0 ? texts[ti] : null;
      const add = (s, code, category, severity, titleText, extra) => issues.push(Object.assign({
        id: sl.id + '|' + (s ? s.id : '-') + '|' + code + (extra && extra.key ? '|' + extra.key : ''),
        slide: sl.index, slideId: sl.id, shapeId: s ? s.id : null, shapeName: s ? s.name : null,
        code, category, severity, title: titleText, safe: false,
        rect: s ? { left: s.left, top: s.top, width: s.width, height: s.height } : null
      }, extra || {}));

      sl.shapes.forEach(s => {
        const isTitle = s === title, contentTitle = isTitle && s.top < H * 0.25;
        if (s.isText && s.hasText) {
          const font = normalizeFont(s.font), want = isTitle ? brand.fonts.heading : brand.fonts.body;
          if (font && brand.fonts.allowed.indexOf(font) < 0) {
            foreignFonts[font] = (foreignFonts[font] || 0) + 1;
            add(s, 'font', 'font', 'must', 'Font is not a brand font', {
              detail: 'BDO uses ' + want + ' for all text (guidelines p.16–17).',
              kind: 'font', from: font, to: want, fix: { kind: 'font', name: want }, safe: true });
          } else if (!s.font) {
            add(s, 'mixedFont', 'font', 'should', 'Box mixes several fonts', {
              detail: 'One font per box keeps the slide consistent.',
              kind: 'font', from: 'Mixed', to: want, fix: { kind: 'font', name: want }, safe: true });
          }
          if (!isTitle && s.color && !isBrandColor(s.color, brand.palette)) {
            const to = nearestColor(s.color, brand.palette);
            add(s, 'textColour', 'colour', 'should', 'Text colour is off-palette', {
              detail: 'Nearest BDO colour shown. Tints are allowed except red and burgundy.',
              kind: 'colour', from: s.color.toUpperCase(), to, fix: { kind: 'color', color: to }, safe: true });
          }
          if (/^Justify|^Distributed/.test(s.align || '')) {
            add(s, 'justified', 'text', 'should', 'Justified text', {
              detail: 'Larger blocks of text are left aligned (guidelines p.18).',
              kind: 'value', from: 'Justified', to: 'Left aligned', fix: { kind: 'align', value: 'Left' }, safe: true });
          }
          const spaces = doubleSpaceRanges(s.text).map(r => ({ start: r[0], length: r[1], to: ' ' }));
          if (spaces.length) {
            add(s, 'spaces', 'text', 'should', spaces.length === 1 ? 'Double space' : spaces.length + ' double spaces', {
              detail: 'Shown in red: the extra spaces that will be removed.',
              kind: 'text', segments: diffSegments(s.text, spaces), fix: { kind: 'text', ops: spaces, text: s.text }, safe: true });
          }
          findTerms(s.text, brand.terms).forEach((h, k) => {
            const ops = [{ start: h.start, length: h.length, to: h.to }];
            add(s, 'term', 'text', 'should', 'House style: ' + h.label, {
              key: String(k), detail: 'House style is ₹ … Cr / lakh.',
              kind: 'text', segments: diffSegments(s.text, ops), fix: { kind: 'text', ops, text: s.text }, safe: false });
          });
          if (s.size && s.size < brand.body.minSizePt && !isFooterLike(s, brand)) {
            add(s, 'small', 'text', 'check', 'Text is very small', {
              detail: 'Below the ' + brand.body.minSizePt + ' pt minimum. Raising it may make the text overflow, so check after fixing.',
              kind: 'value', from: s.size + ' pt', to: brand.body.minSizePt + ' pt', fix: { kind: 'size', size: brand.body.minSizePt }, safe: false });
          }
          if (s.autoSize === 'AutoSizeTextToFitShape') {
            add(s, 'shrink', 'text', 'check', 'Text shrinks to fit its box', {
              detail: 'PowerPoint is shrinking the text, so its real size differs from the rest of the slide. Shorten the text or enlarge the box.' });
          }
          findLeftovers(s.text, brand.leftoverPatterns).forEach((m, k) => {
            const at = s.text.indexOf(m);
            add(s, 'leftover', 'content', 'must', 'Leftover draft text "' + m + '"', {
              key: String(k), detail: 'Fill this in before the deck goes to the client.',
              kind: 'text', segments: at >= 0 ? diffSegments(s.text, [{ start: at, length: m.length, to: '' }], 36).map(g => g.t === 'del' ? { t: 'flag', s: g.s } : g) : null });
          });
        }
        if (s.isText && !s.hasText && (s.type === 'TextBox' || s.type === 'Placeholder')) {
          add(s, 'empty', 'cleanup', 'should', s.type === 'TextBox' ? 'Empty text box' : 'Empty placeholder', {
            detail: 'Invisible in the slideshow but clutters editing and can show "Click to add text".',
            fix: { kind: 'delete' }, destructive: true });
        }
        if (s.fill && !isBrandColor(s.fill, brand.palette)) {
          const to = nearestColor(s.fill, brand.palette);
          add(s, 'fill', 'colour', 'should', 'Shape fill is off-palette', {
            detail: 'Nearest BDO colour shown.', kind: 'colour', from: s.fill.toUpperCase(), to, fix: { kind: 'fill', color: to }, safe: true });
        }
        if (s.left < -2 || s.top < -2 || s.left + s.width > W + 2 || s.top + s.height > H + 2) {
          const left = Math.max(0, Math.min(s.left, W - s.width)), top = Math.max(0, Math.min(s.top, H - s.height));
          add(s, 'offSlide', 'layout', 'should', 'Shape runs off the slide', {
            detail: 'Part of it is cut off in the slideshow. The fix moves it back inside the slide edge.',
            target: { left, top, width: s.width, height: s.height },
            kind: 'value', from: r1(s.left) + ', ' + r1(s.top) + ' pt', to: r1(left) + ', ' + r1(top) + ' pt',
            fix: { kind: 'move', left, top }, safe: false });
        }
        if (isTitle && s.hasText) {
          if (caseMode !== 'none') {
            const cased = applyCase(s.text, caseMode, brand.keepWords);
            if (cased !== s.text) {
              const ops = caseOps(s.text, cased);
              add(s, 'case', 'title', 'should', caseMode === 'sentence' ? 'Title is not in sentence case' : 'Title is not in Title Case', {
                detail: caseMode === 'sentence' ? 'Page titles are sentence case (guidelines p.18). Acronyms are kept.' : 'Chosen in Rules.',
                kind: 'text', segments: diffSegments(s.text, ops, 60), fix: { kind: 'text', ops, text: s.text }, safe: true });
            }
          }
          if (contentTitle) {
            const tgt = { left: T.leftPt, top: T.topPt, width: T.widthPt, height: T.heightPt };
            if (offPosition(s, T) || Math.abs(s.width - T.widthPt) > T.tolerancePt) {
              add(s, 'titlePos', 'title', 'should', 'Title is not in the standard position', {
                detail: 'Dashed outline: where the BDO template puts the title.', target: tgt,
                kind: 'value', from: r1(s.left) + ', ' + r1(s.top) + ' pt', to: T.leftPt + ', ' + T.topPt + ' pt',
                fix: { kind: 'box', box: tgt }, safe: true });
            }
            if (s.size && Math.round(s.size) !== T.sizePt) {
              add(s, 'titleSize', 'title', 'should', 'Title size', { detail: 'BDO titles are ' + T.sizePt + ' pt.',
                kind: 'value', from: s.size + ' pt', to: T.sizePt + ' pt', fix: { kind: 'size', size: T.sizePt }, safe: true });
            }
            if (s.color && s.color.toUpperCase() !== T.color.toUpperCase()) {
              add(s, 'titleColour', 'title', 'must', 'Title colour is not BDO red', { detail: 'Titles use BDO red ' + T.color + '.',
                kind: 'colour', from: s.color.toUpperCase(), to: T.color, fix: { kind: 'color', color: T.color }, safe: true });
            }
            if (s.bold === true && !T.bold) {
              add(s, 'titleBold', 'title', 'should', 'Title is bold', { detail: 'BDO titles are not bold.',
                kind: 'value', from: 'Bold', to: 'Regular', fix: { kind: 'bold', bold: false }, safe: true });
            }
          }
        }
      });
      if (!title) add(null, 'noTitle', 'title', 'check', 'No title found', { detail: 'Every content slide should have a title.' });
    });
    return { issues, foreignFonts };
  }

  const api = { findTerms, caseOps, applyOps, mergeOps, diffSegments, findIssues, CATEGORIES, hexToRgb, colorDistance, paletteColors, nearestColor, inPalette, isTintOf, isBrandColor, snapColor,
    sentenceCase, titleCase, applyCase, pickTitleIndex, offPosition, isFooterLike, mostCommon,
    findLeftovers, doubleSpaceRanges, normalizeFont };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof self !== 'undefined' ? self : this);
