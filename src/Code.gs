const APP_VERSION = '0.6';
const SHEET_TITLE = 'Job Finder Data';
const TRIGGER_SUBJECT = 'Job Finder: tailoring requested';
const TABS = {
  'Config': ['Key', 'Value', 'Note'],
  'Profile': ['Field', 'Value'],
  'Jobs': ['Job ID','Found On','Posted On','Title','Company','Location','Work Mode','Experience Asked','Salary','Source',
           'Apply URL','Apply Email','Description','Must Have','Nice To Have','Fit Score','Score Breakdown','Status','Emailed On'],
  'Tailor Requests': ['Request ID','Requested At','Job ID','Status','Instructions','Result JSON','Doc URL','Completed At','Notified At'],
  'Applications': ['Job ID','Applied On','Method','CV File','Status','Next Step','Follow-up On','Notes'],
  'Run Log': ['Run ID','Run Date','Window From','Window To','Jobs Found','New Jobs','Status','Notes']
};
const CONFIG_DEFAULTS = [
  ['Email To', '', 'Where job alerts go'],
  ['Min Fit Score', '60', 'Only jobs at or above this are emailed'],
  ['Max Jobs Per Email', '15', ''],
  ['Target Titles', '', 'Semicolon list, e.g. Manager - Deal Advisory; Value Creation Manager'],
  ['Locations', '', 'Semicolon list of preferred cities; add Remote if wanted'],
  ['Experience Years', '', 'Your total years of experience'],
  ['Work Modes', 'On-site; Hybrid; Remote', 'Semicolon list of work modes to search for'],
  ['Min Salary (LPA)', '', 'Lowest salary to consider, in lakh per annum; blank means any'],
  ['Exclude Companies', '', 'Semicolon list of companies to skip'],
  ['Weight Skills', '40', ''], ['Weight Title', '20', ''], ['Weight Experience', '15', ''],
  ['Weight Location', '15', ''], ['Weight Recency', '10', ''],
  ['Strong Score', '75', ''], ['Good Score', '55', ''],
  ['Master CV Doc ID', '', 'Filled in when you upload your CV on the dashboard'],
  ['Alert Time If No Run', '10:30', 'IST; one email if research has not arrived'],
  ['Research Paused', 'NO', 'YES stops alerts']
];

/* ---------- setup (run once from the editor) ---------- */
function setup() {
  if (!isOwnerSignedIn_()) throw new Error('setup can only be run by the owner from the Apps Script editor');
  const props = PropertiesService.getScriptProperties();
  let ss = props.getProperty('SHEET_ID') ? SpreadsheetApp.openById(props.getProperty('SHEET_ID')) : null;
  if (!ss) { ss = SpreadsheetApp.create(SHEET_TITLE); props.setProperty('SHEET_ID', ss.getId()); }
  Object.keys(TABS).forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(TABS[name]);
  });
  ensureConfig_();
  const first = ss.getSheetByName('Sheet1'); if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pollTick').timeBased().everyMinutes(5).create();
  Logger.log('Sheet: ' + ss.getUrl());
}

/** Adds any default setting missing from the Config tab (e.g. after an update adds a new one). Never changes existing values. */
function ensureConfig_() {
  const have = rows_('Config').map(r => r.Key);
  CONFIG_DEFAULTS.filter(r => have.indexOf(r[0]) < 0).forEach(r => ss_().getSheetByName('Config').appendRow(r));
}

/* ---------- sheet helpers ---------- */
let SS_ = null;
function ss_() { return SS_ || (SS_ = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'))); }
function rows_(tab) {
  const v = ss_().getSheetByName(tab).getDataRange().getValues(), h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = r[j]); return o; });
}
function setCell_(tab, row, key, value) {
  const sh = ss_().getSheetByName(tab), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(row, h.indexOf(key) + 1).setValue(value);
}
function append_(tab, obj) {
  const sh = ss_().getSheetByName(tab), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(h.map(k => obj[k] == null ? '' : obj[k]));
}
function cfg_() { const c = {}; rows_('Config').forEach(r => c[r.Key] = String(r.Value).trim()); return c; }
function profile_() { const p = {}; rows_('Profile').forEach(r => p[r.Field] = String(r.Value).trim()); return p; }
function list_(s) { return String(s || '').split(/[;,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean); }
function num_(v) { return parseFloat(String(v || '').replace(/[^\d.]/g, '')) || 0; }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

/* ---------- scoring (the app scores; the research engine only records facts) ---------- */
/** True for a job requirement the owner's profile covers (skills, tools or certifications). */
function skillMatcher_(p) {
  const mine = list_([p['Core Skills'], p['Tools'], p['Certifications']].join(';'));
  return term => { term = String(term).toLowerCase().trim(); return mine.some(s => s && (term.indexOf(s) >= 0 || s.indexOf(term) >= 0)); };
}

function scoreJob_(j, p, c) {
  const w = k => num_(c['Weight ' + k]);
  const has = skillMatcher_(p);
  const must = list_(j['Must Have']), nice = list_(j['Nice To Have']);
  const skills = must.length || nice.length
    ? (must.filter(has).length + 0.5 * nice.filter(has).length) / (must.length + 0.5 * nice.length) : 0.4;
  const words = s => String(s).toLowerCase().split(/[^a-z]+/).filter(x => x.length > 2);
  const tw = words(j.Title);
  const title = Math.max(0, ...list_(c['Target Titles']).map(t => { const a = words(t); return a.length ? a.filter(x => tw.indexOf(x) >= 0).length / a.length : 0; }));
  const yrs = num_(c['Experience Years']), m = String(j['Experience Asked']).match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  const exp = !m || !yrs ? 0.5 : (yrs >= +m[1] && yrs <= +m[2] ? 1 : Math.max(0, 1 - 0.2 * Math.min(Math.abs(yrs - m[1]), Math.abs(yrs - m[2]))));
  const loc = String(j.Location + ' ' + j['Work Mode']).toLowerCase(), cities = list_(c.Locations);
  const location = cities.some(x => loc.indexOf(x) >= 0) ? 1 : /remote/.test(loc) && cities.indexOf('remote') >= 0 ? 1 : /hybrid/.test(loc) ? 0.5 : 0;
  const posted = j['Posted On'] instanceof Date ? j['Posted On'] : new Date(j['Posted On']);
  const age = isNaN(posted) ? 7 : (Date.now() - posted.getTime()) / 864e5;
  const recency = age <= 2 ? 1 : age <= 7 ? 0.6 : age <= 14 ? 0.3 : 0;
  const parts = [['Skills', skills], ['Title', title], ['Experience', exp], ['Location', location], ['Recency', recency]]
    .map(([k, f]) => [k, Math.round(f * w(k)), w(k)]);
  const score = parts.reduce((s, x) => s + x[1], 0);
  return { score, breakdown: parts.map(x => x[0] + ' ' + x[1] + '/' + x[2]).join(' · ') };
}

/* ---------- every 5 minutes ---------- */
function pollTick() {
  ensureConfig_();
  const c = cfg_(), p = profile_(), paused = String(c['Research Paused']).toUpperCase() === 'YES';
  rows_('Jobs').filter(j => j['Fit Score'] === '').forEach(j => {
    const s = scoreJob_(j, p, c); setCell_('Jobs', j._row, 'Fit Score', s.score); setCell_('Jobs', j._row, 'Score Breakdown', s.breakdown);
  });
  // Runs are marked as seen even while paused, so un-pausing does not send a backlog of alerts.
  const props = PropertiesService.getScriptProperties(), done = JSON.parse(props.getProperty('RUNS_SEEN') || '[]');
  const fresh = rows_('Run Log').filter(r => r.Status === 'DONE' && done.indexOf(String(r['Run ID'])) < 0);
  if (fresh.length) { if (!paused) sendAlert_(c); props.setProperty('RUNS_SEEN', JSON.stringify(done.concat(fresh.map(r => String(r['Run ID']))).slice(-200))); }
  // Tailoring the owner asked for is still delivered while alerts are paused.
  rows_('Tailor Requests').filter(r => r.Status === 'DONE' && !r['Notified At']).forEach(r => deliverTailored_(r, c));
  if (!paused) missingRunCheck_(c);
}

function sendAlert_(c) {
  const jobs = rows_('Jobs').filter(j => !j['Emailed On'] && num_(j['Fit Score']) >= num_(c['Min Fit Score']))
    .sort((a, b) => num_(b['Fit Score']) - num_(a['Fit Score'])).slice(0, num_(c['Max Jobs Per Email']) || 15);
  if (!jobs.length || !c['Email To']) return;
  const band = s => s >= num_(c['Strong Score']) ? 'Strong' : s >= num_(c['Good Score']) ? 'Good' : 'Stretch';
  const cards = jobs.map(j => '<tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-family:Arial,sans-serif">' +
    '<div style="font-size:15px;font-weight:bold;color:#111827">' + esc_(j.Title) + ' · ' + esc_(j.Company) + '</div>' +
    '<div style="font-size:13px;color:#4B5563">' + esc_(j.Location) + ' · ' + esc_(j['Experience Asked']) + ' · ' + esc_(j.Salary || 'Salary not stated') + '</div>' +
    '<div style="font-size:12px;color:#6B7280;margin-top:4px">Fit ' + j['Fit Score'] + ' (' + band(num_(j['Fit Score'])) + ') · ' + esc_(j['Score Breakdown']) + '</div>' +
    (j['Apply URL'] ? '<a href="' + esc_(j['Apply URL']) + '" style="font-size:13px;color:#1D4ED8">Open the posting</a>' : '') + '</td></tr>').join('');
  const url = ScriptApp.getService().getUrl();
  MailApp.sendEmail({ to: c['Email To'], subject: 'Job Finder: ' + jobs.length + ' new job(s), ' + today_(),
    htmlBody: '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">' + cards +
      '<tr><td style="padding:16px;font-family:Arial,sans-serif"><a href="' + url + '" style="color:#1D4ED8">Open the dashboard to tailor or apply</a></td></tr></table>', name: 'Job Finder' });
  jobs.forEach(j => setCell_('Jobs', j._row, 'Emailed On', today_()));
  PropertiesService.getScriptProperties().setProperty('LAST_ALERT', new Date().toISOString());
}

function missingRunCheck_(c) {
  const now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'HH:mm'), props = PropertiesService.getScriptProperties();
  if (now < (c['Alert Time If No Run'] || '10:30') || props.getProperty('MISSED_DAY') === today_() || !c['Email To']) return;
  const ran = rows_('Run Log').some(r => { const d = new Date(r['Run Date']); return !isNaN(d) && Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd') === today_(); });
  if (ran) return;
  props.setProperty('MISSED_DAY', today_());
  MailApp.sendEmail(c['Email To'], 'Job Finder: today\'s search has not arrived', 'No search results were saved today. Open the Gemini app → Tasks and check the daily search task ran and did not stop to ask a question.');
}

/* ---------- web page (public link, locked by a PIN: see Access.gs) ---------- */
function doGet() { const t = HtmlService.createTemplateFromFile('Index'); t.version = APP_VERSION; return t.evaluate().setTitle('Job Finder').addMetaTag('viewport', 'width=device-width, initial-scale=1'); }

/* ---------- tailoring ---------- */
function requestTailor(token, jobId, instructions) {
  auth_(token);
  const id = 'TR-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
  append_('Tailor Requests', { 'Request ID': id, 'Requested At': new Date(), 'Job ID': jobId, 'Status': 'QUEUED', 'Instructions': instructions || '' });
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(me, TRIGGER_SUBJECT, 'Request ' + id + ' for job ' + jobId + ' is waiting in the Tailor Requests tab.');
  return id;
}

function deliverTailored_(r, c) {
  let res;
  try { res = JSON.parse(r['Result JSON']); } catch (e) { return failTailor_(r, 'Result is not readable'); }
  try {
    const master = DocumentApp.openById(c['Master CV Doc ID']).getBody().getText();
    const bad = groundingProblems_(res, master);
    if (bad.length) return failTailor_(r, bad.join('; '));
    const job = rows_('Jobs').find(j => j['Job ID'] === r['Job ID']) || {};
    const doc = buildCvDoc_(res, job, c);
    const pdf = DriveApp.getFileById(doc.getId()).getAs('application/pdf').setName(doc.getName() + '.pdf');
    const docx = UrlFetchApp.fetch('https://docs.google.com/document/d/' + doc.getId() + '/export?format=docx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(doc.getName() + '.docx');
    MailApp.sendEmail({ to: c['Email To'], subject: 'Tailored CV ready: ' + job.Title + ' · ' + job.Company,
      htmlBody: '<p>Your tailored CV and cover letter are attached.</p><p><b>What changed</b><br>' + (res.changes || []).map(esc_).join('<br>') +
        '</p><p><b>Job keywords still missing</b><br>' + (esc_((res.keywordsMissing || []).join(', ')) || 'None') + '</p>',
      attachments: [pdf, docx], name: 'Job Finder' });
    setCell_('Tailor Requests', r._row, 'Doc URL', doc.getUrl());
    setCell_('Tailor Requests', r._row, 'Notified At', new Date());
    if (job._row) setCell_('Jobs', job._row, 'Status', 'Tailored');
  } catch (e) { failTailor_(r, 'Could not build the files: ' + e.message); }
}
function failTailor_(r, why) { setCell_('Tailor Requests', r._row, 'Status', 'FAILED'); setCell_('Tailor Requests', r._row, 'Notified At', new Date()); setCell_('Tailor Requests', r._row, 'Completed At', 'Not used: ' + why); }

/** Every number and every role/company in the tailored text must already exist in the master CV. */
function groundingProblems_(res, master) {
  const out = [], text = JSON.stringify([res.summary, res.experience, res.coverLetter]), m = master.toLowerCase();
  (text.match(/\d[\d,.]*%?/g) || []).map(n => n.replace(/[.,]+$/, ''))
    .forEach(n => { if (m.indexOf(n.toLowerCase()) < 0) out.push('number not in CV: ' + n); });
  (res.experience || []).forEach(e => {
    if (m.indexOf(String(e.company).toLowerCase()) < 0) out.push('company not in CV: ' + e.company);
    if (m.indexOf(String(e.role).toLowerCase()) < 0) out.push('role not in CV: ' + e.role);
  });
  return out.slice(0, 5);
}

/** Builds the tailored CV as a new Google Doc from the master CV facts plus the tailored wording. Works with any CV layout. */
function buildCvDoc_(res, job, c) {
  const cv = cvData_(c), H = DocumentApp.ParagraphHeading;
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const doc = DocumentApp.create('CV - ' + job.Company + ' - ' + job.Title), body = doc.getBody();
  body.appendParagraph(cv.name || '').setHeading(H.TITLE);
  body.appendParagraph([cv.city, cv.phone, cv.email, cv.linkedin].filter(Boolean).join(' · '));
  if (res.summary) { body.appendParagraph('Summary').setHeading(H.HEADING2); body.appendParagraph(res.summary); }
  if ((res.skills || []).length) { body.appendParagraph('Skills').setHeading(H.HEADING2); body.appendParagraph(res.skills.join(' · ')); }
  if ((cv.experience || []).length) body.appendParagraph('Experience').setHeading(H.HEADING2);
  (cv.experience || []).forEach(e => {
    const t = (res.experience || []).find(x => same(x.company, e.company) && same(x.role, e.role));
    body.appendParagraph(e.role + ' · ' + e.company).setHeading(H.HEADING3);
    body.appendParagraph([e.start, e.end].filter(Boolean).join(' – ') + (e.location ? ' · ' + e.location : ''));
    (t && t.bullets && t.bullets.length ? t.bullets : e.bullets || []).forEach(b => body.appendListItem(b).setGlyphType(DocumentApp.GlyphType.BULLET));
  });
  if ((cv.education || []).length) {
    body.appendParagraph('Education').setHeading(H.HEADING2);
    cv.education.forEach(e => body.appendParagraph([e.degree, e.institution, e.year].filter(Boolean).join(', ')));
  }
  if ((cv.certifications || []).length) { body.appendParagraph('Certifications').setHeading(H.HEADING2); body.appendParagraph(cv.certifications.join(' · ')); }
  body.appendPageBreak(); body.appendParagraph('Cover letter').setHeading(H.HEADING2);
  String(res.coverLetter || '').split(/\n+/).forEach(p => body.appendParagraph(p));
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(folder_());
  return doc;
}

/* ---------- apply ---------- */
function applyJob(token, jobId, confirmed) {
  auth_(token);
  const job = rows_('Jobs').find(j => j['Job ID'] === jobId); if (!job) throw new Error('Job not found');
  const tr = rows_('Tailor Requests').filter(r => r['Job ID'] === jobId && r['Doc URL']).pop();
  if (!job['Apply Email']) return { open: job['Apply URL'], note: 'The application page opens in a new tab. Attach your tailored CV there, then click "I\'ve applied" to track it.' };
  if (!tr) return { needTailor: true };
  if (!confirmed) return { confirm: 'Send your application to ' + job['Apply Email'] + ' from your Gmail?' };
  const p = profile_(), id = tr['Doc URL'].match(/\/d\/([^/]+)/)[1];
  const pdf = DriveApp.getFileById(id).getAs('application/pdf').setName((p.Name || 'CV') + ' - CV.pdf');
  const letter = esc_(JSON.parse(tr['Result JSON']).coverLetter || '').replace(/\n/g, '<br>');
  MailApp.sendEmail({ to: job['Apply Email'], subject: 'Application: ' + job.Title + ' - ' + (p.Name || ''), htmlBody: letter, attachments: [pdf], name: p.Name || '' });
  append_('Applications', { 'Job ID': jobId, 'Applied On': new Date(), 'Method': 'Email', 'CV File': tr['Doc URL'], 'Status': 'Applied', 'Follow-up On': new Date(Date.now() + 7 * 864e5) });
  setCell_('Jobs', job._row, 'Status', 'Applied');
  return { sent: true };
}
