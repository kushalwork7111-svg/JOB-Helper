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

  const api = { hexToRgb, colorDistance, paletteColors, nearestColor, inPalette, sentenceCase, titleCase, applyCase, pickTitleIndex, offPosition, isFooterLike, mostCommon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof self !== 'undefined' ? self : this);
