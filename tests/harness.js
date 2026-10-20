// Local stand-ins for the Google services the app uses, so src/*.gs can run in Node.
// Nothing here talks to Google: sheets, emails and files live in memory and are inspected by tests.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

function formatDate(date, tz, fmt) {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(date.getTime())).forEach(p => { parts[p.type] = p.value; });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return fmt.replace(/yyyy|MMM|MM|dd|d|HH|mm|ss/g, t => ({ yyyy: parts.year, MMM: MON[+parts.month - 1], MM: parts.month, dd: parts.day,
    d: String(+parts.day), HH: parts.hour, mm: parts.minute, ss: parts.second }[t]));
}

/* ---------- Sheets ---------- */
class Range {
  constructor(sheet, row, col, nRows, nCols) { Object.assign(this, { sheet, row, col, nRows, nCols }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nRows; r++) {
      const src = this.sheet.data[this.row - 1 + r] || [];
      const line = [];
      for (let c = 0; c < this.nCols; c++) { const v = src[this.col - 1 + c]; line.push(v === undefined ? '' : v); }
      out.push(line);
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(values) {
    if (this.col < 1 || this.row < 1) throw new Error('Range out of bounds: row ' + this.row + ', column ' + this.col);
    values.forEach((line, r) => line.forEach((v, c) => {
      const i = this.row - 1 + r;
      while (this.sheet.data.length <= i) this.sheet.data.push([]);
      this.sheet.data[i][this.col - 1 + c] = v;
    }));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  appendRow(row) { this.data.push(row.slice()); return this; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
  getRange(row, col, nRows, nCols) { return new Range(this, row, col, nRows || 1, nCols || 1); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
}

class Spreadsheet {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = [new Sheet('Sheet1')]; }
  getId() { return this.id; }
  getName() { return this.name; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheets() { return this.sheets.slice(); }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

/* ---------- Docs and Drive ---------- */
class Body {
  constructor(text) { this.text = text; }
  getText() { return this.text; }
  replaceText(pattern, replacement) { this.text = this.text.replace(new RegExp(pattern, 'g'), () => replacement); return this; }
  appendPageBreak() { this.text += '\n[page break]\n'; }
  appendParagraph(p) { this.text += '\n' + p; const el = { setHeading: () => el, setGlyphType: () => el }; return el; }
  appendListItem(p) { return this.appendParagraph('• ' + p); }
}

function blob(name, contentType, bytes) {
  return { name, contentType, bytes, setName(n) { this.name = n; return this; }, getName() { return this.name; },
    getDataAsString() { return Buffer.from(this.bytes || []).toString('utf8'); } };
}

function createEnv(opts) {
  opts = opts || {};
  const state = { now: opts.now || Date.parse('2026-10-19T03:30:00Z'), emails: [], triggers: [], logs: [],
    spreadsheets: {}, docs: {}, folders: {}, props: {}, cache: {}, activeUser: 'owner@example.com', fetches: [], ids: 0, me: 'owner@example.com' };
  state.activeUser = state.me;
  const newId = p => p + (++state.ids);

  // Date that follows the test clock when no arguments are given.
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { a.length ? super(...a) : super(state.now); }
    static now() { return state.now; }
  }

  const SpreadsheetApp = {
    create(name) { const s = new Spreadsheet(newId('sheet-'), name); state.spreadsheets[s.id] = s; return s; },
    openById(id) { const s = state.spreadsheets[id]; if (!s) throw new Error('No spreadsheet ' + id); return s; }
  };

  const doc = (id, name, text) => {
    const d = { id, name, body: new Body(text), getId: () => id, getName: () => name,
      getUrl: () => 'https://docs.google.com/document/d/' + id + '/edit', getBody: () => d.body, saveAndClose() {} };
    state.docs[id] = d;
    return d;
  };
  const DocumentApp = {
    ParagraphHeading: { TITLE: 'TITLE', HEADING1: 'H1', HEADING2: 'H2', HEADING3: 'H3' },
    GlyphType: { BULLET: 'BULLET' },
    create: name => doc(newId('doc-'), name, ''),
    openById(id) { const d = state.docs[id]; if (!d) throw new Error('No document ' + id); return d; }
  };
  const folder = (id, name) => (state.folders[id] = state.folders[id] || { id, name, files: [], getId: () => id, getName: () => name });
  const DriveApp = {
    getFileById(id) {
      const d = DocumentApp.openById(id);
      return {
        getId: () => id, getName: () => d.name,
        getAs: mime => blob(d.name, mime),
        makeCopy: name => doc(newId('doc-'), name, d.body.getText()),
        moveTo: f => { f.files.push(id); }
      };
    },
    createFolder: name => folder(newId('folder-'), name),
    getFolderById(id) { if (!state.folders[id]) throw new Error('No folder ' + id); return state.folders[id]; }
  };
  // Advanced Drive service: uploading a Word/PDF/text file with a Google Docs type converts it to a Doc.
  const Drive = { Files: { create(meta, b) {
    if (meta.mimeType !== 'application/vnd.google-apps.document') throw new Error('Only conversion to Docs is mocked');
    const d = doc(newId('doc-'), meta.name, b.getDataAsString());
    (meta.parents || []).forEach(pid => DriveApp.getFolderById(pid).files.push(d.id));
    return { id: d.id, name: meta.name };
  } } };

  const store = {
    getProperty: k => (k in state.props ? state.props[k] : null),
    setProperty(k, v) { state.props[k] = String(v); return store; },
    setProperties(o) { Object.keys(o).forEach(k => { state.props[k] = String(o[k]); }); return store; },
    deleteProperty(k) { delete state.props[k]; return store; },
    getProperties: () => Object.assign({}, state.props)
  };

  const triggerBuilder = fn => {
    const t = { fn, spec: [] };
    const b = new Proxy({}, { get: (_, m) => m === 'create'
      ? () => { state.triggers.push(t); return t; }
      : (...a) => { t.spec.push([m].concat(a)); return b; } });
    return b;
  };

  const sandbox = {
    console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseFloat, parseInt,
    Date: FakeDate,
    SpreadsheetApp, DocumentApp, DriveApp, Drive,
    MimeType: { GOOGLE_DOCS: 'application/vnd.google-apps.document', PDF: 'application/pdf' },
    PropertiesService: { getScriptProperties: () => store },
    MailApp: {
      sendEmail(a, subject, body) {
        state.emails.push(typeof a === 'object' ? Object.assign({}, a) : { to: a, subject, body });
      }
    },
    ScriptApp: {
      getProjectTriggers: () => state.triggers.slice(),
      deleteTrigger: t => { state.triggers = state.triggers.filter(x => x !== t); },
      newTrigger: triggerBuilder,
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }),
      getOAuthToken: () => 'test-token'
    },
    UrlFetchApp: {
      fetch(url) { state.fetches.push(url); return { getBlob: () => blob('export', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }; }
    },
    Utilities: {
      formatDate,
      base64Decode: b64 => Array.from(Buffer.from(b64, 'base64')),
      newBlob: (bytes, type, name) => blob(name, type, bytes),
      getUuid: () => require('crypto').randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      // Apps Script returns signed bytes (-128..127)
      computeDigest: (alg, text) => Array.from(require('crypto').createHash(alg).update(text, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b))
    },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = state.cache[k]; return e && e.until > state.now ? e.v : null; },
      put: (k, v, secs) => { state.cache[k] = { v, until: state.now + secs * 1000 }; }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => state.me }), getActiveUser: () => ({ getEmail: () => state.activeUser }) },
    Logger: { log: m => state.logs.push(String(m)) },
    HtmlService: {
      createTemplateFromFile: name => ({ evaluate() { return { name, setTitle() { return this; }, addMetaTag() { return this; } }; } })
    }
  };

  const ctx = vm.createContext(sandbox);
  // Local.gs holds the owner's one-time setup code hash: tests must not depend on it.
  fs.readdirSync(SRC).filter(f => f.endsWith('.gs') && f !== 'Local.gs').sort()
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f }));

  return {
    app: ctx,
    state,
    // Test helpers
    setNow(iso) { state.now = Date.parse(iso); },
    makeDoc(name, text) { return doc(newId('doc-'), name, text).id; },
    sheet(tab) { return SpreadsheetApp.openById(state.props.SHEET_ID).getSheetByName(tab); },
    setConfig(values) {
      Object.keys(values).forEach(k => {
        const r = ctx.rows_('Config').find(x => x.Key === k);
        if (!r) throw new Error('Unknown Config key ' + k);
        ctx.setCell_('Config', r._row, 'Value', values[k]);
      });
    },
    /** Sets a PIN and unlocks, as the owner would on the page. Returns the session token. */
    unlock(pin) { pin = pin || '246810'; if (!state.props.PIN_HASH) ctx.setPin_(pin); return ctx.unlock(pin).token; },
    setProfile(values) { Object.keys(values).forEach(k => ctx.append_('Profile', { Field: k, Value: values[k] })); }
  };
}

module.exports = { createEnv, formatDate };
