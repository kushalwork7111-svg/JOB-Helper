// Run with: node tests/run.js   (must pass before every deploy)
const assert = require('assert');
const vm = require('vm');
const { createEnv } = require('./harness');
const accuracy = require('./cv_accuracy');

// A plain CV with no special markers: the app must work from any CV layout.
const MASTER_CV = [
  'Kushal Example', 'Mumbai | kushal@example.com | +91 98200 00000',
  'SUMMARY', 'Chartered Accountant focused on deal advisory.',
  'EXPERIENCE',
  'Manager, Deal Advisory - Acme Advisors LLP (2021 - present)',
  '• Led 12 due diligence projects worth INR 1,200 crore.',
  'Senior Analyst - Beta Consulting (2017 - 2021)',
  '• Cut reporting time by 30%.',
  'SKILLS', 'Financial due diligence, Valuation, Excel'
].join('\n');

/** A ready-to-use app: sheet created, Config and Profile filled, master CV in place. */
function seeded(opts) {
  const env = createEnv(opts);
  env.app.setup();
  const cvId = env.makeDoc('Master CV', MASTER_CV);
  env.setConfig({
    'Email To': 'owner@example.com',
    'Target Titles': 'Manager - Deal Advisory; Value Creation Manager',
    'Locations': 'Mumbai; Bengaluru; Remote',
    'Experience Years': '8',
    'Master CV Doc ID': cvId
  });
  env.setProfile({ 'Name': 'Kushal Example', 'Core Skills': 'Financial due diligence; Valuation; Financial modelling',
    'Tools': 'Excel; Power BI', 'Certifications': 'CA' });
  return env;
}

let n = 0;
function job(env, over) {
  n++;
  const row = Object.assign({ 'Job ID': 'JOB-20261019-' + n, 'Found On': '2026-10-19', 'Posted On': '2026-10-18',
    'Title': 'Manager - Deal Advisory', 'Company': 'Company ' + n, 'Location': 'Mumbai', 'Work Mode': 'On-site',
    'Experience Asked': '6-10 years', 'Source': 'LinkedIn', 'Apply URL': 'https://example.com/job/' + n,
    'Must Have': 'Financial due diligence; Valuation', 'Nice To Have': 'Power BI', 'Status': 'New' }, over || {});
  env.app.append_('Jobs', row);
  return row['Job ID'];
}
const runDone = (env, id, date) => env.app.append_('Run Log', { 'Run ID': id, 'Run Date': date || '2026-10-19', 'Status': 'DONE' });
const jobRow = (env, id) => env.app.rows_('Jobs').find(j => j['Job ID'] === id);

const GOOD_RESULT = {
  summary: 'Chartered Accountant with 12 due diligence projects.',
  skills: ['Financial due diligence', 'Valuation'],
  experience: [{ role: 'Manager, Deal Advisory', company: 'Acme Advisors LLP', bullets: ['Led 12 due diligence projects worth INR 1,200 crore.'] }],
  coverLetter: 'Dear team,\nI cut reporting time by 30%.',
  changes: ['Moved due diligence up because the job asks for it'], keywordsCovered: ['Valuation'], keywordsMissing: ['SAP'],
  portalAnswers: [{ q: 'Why this role?', a: 'Deal work is my focus.' }]
};

const tests = {
  'setup creates the sheet, six tabs, Config defaults and one 5-minute trigger'(env = createEnv()) {
    env.app.setup();
    const ss = env.state.spreadsheets[env.state.props.SHEET_ID];
    assert.strictEqual(ss.getName(), 'Job Finder Data');
    assert.deepStrictEqual(ss.getSheets().map(s => s.getName()), ['Config', 'Profile', 'Jobs', 'Tailor Requests', 'Applications', 'Run Log']);
    assert.strictEqual(env.app.cfg_()['Min Fit Score'], '60');
    assert.strictEqual(env.state.triggers.length, 1);
    assert.strictEqual(env.state.triggers[0].fn, 'pollTick');
  },

  'running setup twice does not duplicate settings or triggers'(env = createEnv()) {
    env.app.setup();
    const before = env.sheet('Config').getLastRow();
    env.app.setup();
    assert.strictEqual(env.sheet('Config').getLastRow(), before);
    assert.strictEqual(env.state.triggers.length, 1);
  },

  'scores spread out: a close match is Strong, a poor match is low'(env = seeded()) {
    const c = env.app.cfg_(), p = env.app.profile_();
    const good = env.app.scoreJob_({ 'Title': 'Manager - Deal Advisory', 'Location': 'Mumbai', 'Work Mode': 'On-site',
      'Experience Asked': '6-10 years', 'Posted On': '2026-10-18', 'Must Have': 'Financial due diligence; Valuation', 'Nice To Have': 'Power BI' }, p, c);
    const poor = env.app.scoreJob_({ 'Title': 'Software Engineer', 'Location': 'Delhi', 'Work Mode': 'On-site',
      'Experience Asked': '1-2 years', 'Posted On': '2026-09-01', 'Must Have': 'Java; Kubernetes', 'Nice To Have': '' }, p, c);
    assert.strictEqual(good.score, 100, good.breakdown);
    assert.ok(poor.score < 20, poor.breakdown);
    assert.strictEqual(good.breakdown, 'Skills 40/40 · Title 20/20 · Experience 15/15 · Location 15/15 · Recency 10/10');
  },

  'hybrid in another city earns half the location points'(env = seeded()) {
    const s = env.app.scoreJob_({ 'Title': 'x', 'Location': 'Pune', 'Work Mode': 'Hybrid', 'Posted On': '' }, env.app.profile_(), env.app.cfg_());
    assert.ok(/Location 8\/15/.test(s.breakdown), s.breakdown);
  },

  'pollTick scores new jobs and emails only those above the cut-off, best first'(env = seeded()) {
    const strong = job(env), weak = job(env, { 'Title': 'Software Engineer', 'Location': 'Delhi', 'Must Have': 'Java' });
    const mid = job(env, { 'Location': 'Delhi', 'Must Have': 'Financial due diligence; SAP' });
    runDone(env, 'RUN-20261019-1');
    env.app.pollTick();
    assert.ok(jobRow(env, weak)['Fit Score'] < 60);
    const alerts = env.state.emails.filter(e => /new job/.test(e.subject));
    assert.strictEqual(alerts.length, 1);
    assert.ok(alerts[0].subject.startsWith('Job Finder: 2 new job(s)'), alerts[0].subject);
    assert.ok(alerts[0].htmlBody.indexOf('Company ' + strong.split('-').pop()) < alerts[0].htmlBody.indexOf(jobRow(env, mid).Company));
    assert.strictEqual(jobRow(env, strong)['Emailed On'], '2026-10-19');
    assert.strictEqual(jobRow(env, weak)['Emailed On'], '');
  },

  'a job is never emailed twice, and a run is only alerted once'(env = seeded()) {
    job(env); runDone(env, 'RUN-1');
    env.app.pollTick(); env.app.pollTick();
    runDone(env, 'RUN-2'); env.app.pollTick();
    assert.strictEqual(env.state.emails.filter(e => /new job/.test(e.subject)).length, 1);
    job(env); runDone(env, 'RUN-3'); env.app.pollTick();
    const alerts = env.state.emails.filter(e => /new job/.test(e.subject));
    assert.strictEqual(alerts.length, 2);
    assert.ok(alerts[1].subject.startsWith('Job Finder: 1 new job(s)'));
  },

  'no alert is sent until the research run is marked DONE'(env = seeded()) {
    job(env); env.app.pollTick();
    assert.strictEqual(env.state.emails.length, 0);
    assert.ok(jobRow(env, 'JOB-20261019-' + n)['Fit Score'] > 0, 'still scored');
  },

  'pause switch stops alerts, and un-pausing does not send a backlog'(env = seeded()) {
    env.setConfig({ 'Research Paused': 'YES' });
    job(env); runDone(env, 'RUN-1'); env.setNow('2026-10-19T08:00:00Z');
    env.app.pollTick();
    assert.strictEqual(env.state.emails.length, 0);
    env.setConfig({ 'Research Paused': 'NO' }); env.app.pollTick();
    assert.strictEqual(env.state.emails.filter(e => /new job/.test(e.subject)).length, 0);
  },

  'missing-run alert: one email after 10:30 IST when no run arrived today'(env = seeded()) {
    runDone(env, 'RUN-old', '2026-10-18');
    env.setNow('2026-10-19T04:30:00Z'); // 10:00 IST
    env.app.pollTick();
    assert.strictEqual(env.state.emails.length, 0);
    env.setNow('2026-10-19T05:05:00Z'); // 10:35 IST
    env.app.pollTick(); env.app.pollTick();
    const missed = env.state.emails.filter(e => /has not arrived/.test(e.subject));
    assert.strictEqual(missed.length, 1);
  },

  'missing-run alert stays quiet when today\'s run arrived'(env = seeded()) {
    runDone(env, 'RUN-1', '2026-10-19');
    env.setNow('2026-10-19T06:00:00Z');
    env.app.pollTick();
    assert.strictEqual(env.state.emails.filter(e => /has not arrived/.test(e.subject)).length, 0);
  },

  'grounding check accepts facts from the CV'(env = seeded()) {
    assert.strictEqual(env.app.groundingProblems_(GOOD_RESULT, MASTER_CV).join('; '), '');
  },

  'grounding check rejects invented numbers, employers and titles'(env = seeded()) {
    const bad = JSON.parse(JSON.stringify(GOOD_RESULT));
    bad.summary = 'Led 25 deals.';
    bad.experience.push({ role: 'Director', company: 'Made Up Capital', bullets: [] });
    const problems = env.app.groundingProblems_(bad, MASTER_CV);
    assert.ok(problems.includes('number not in CV: 25'), problems);
    assert.ok(problems.includes('company not in CV: Made Up Capital'), problems);
    assert.ok(problems.includes('role not in CV: Director'), problems);
  },

  'Tailor my CV queues a request and sends the trigger email to the owner only'(env = seeded()) {
    const id = job(env);
    const req = env.app.requestTailor(env.unlock(), id, 'Stress valuation');
    const row = env.app.rows_('Tailor Requests')[0];
    assert.strictEqual(row['Request ID'], req);
    assert.strictEqual(row.Status, 'QUEUED');
    assert.strictEqual(env.state.emails.length, 1);
    assert.strictEqual(env.state.emails[0].to, env.state.me);
    assert.strictEqual(env.state.emails[0].subject, vm.runInContext('TRIGGER_SUBJECT', env.app));
  },

  'a valid tailoring result is emailed with PDF and Word attached'(env = seeded()) {
    const id = job(env);
    env.app.append_('Tailor Requests', { 'Request ID': 'TR-1', 'Job ID': id, 'Status': 'DONE', 'Result JSON': JSON.stringify(GOOD_RESULT) });
    env.app.pollTick();
    const mail = env.state.emails.find(e => /Tailored CV ready/.test(e.subject));
    assert.ok(mail, 'email sent');
    assert.strictEqual(mail.attachments.map(a => a.getName().split('.').pop()).join(','), 'pdf,docx');
    const tr = env.app.rows_('Tailor Requests')[0];
    assert.ok(tr['Doc URL'] && tr['Notified At']);
    assert.strictEqual(jobRow(env, id).Status, 'Tailored');
    const built = Object.values(env.state.docs).find(d => d.name.startsWith('CV - ')).body.getText();
    assert.ok(built.indexOf('Led 12 due diligence projects worth INR 1,200 crore.') >= 0, 'tailored bullet used');
    assert.ok(built.indexOf('Senior Analyst · Beta Consulting') >= 0 && built.indexOf('Cut reporting time by 30%.') >= 0, 'other jobs kept from the CV');
    assert.ok(built.indexOf('I cut reporting time by 30%.') >= 0, 'cover letter included');
    env.app.pollTick();
    assert.strictEqual(env.state.emails.filter(e => /Tailored CV ready/.test(e.subject)).length, 1, 'sent once');
  },

  'an invented fact marks the request FAILED and sends no file'(env = seeded()) {
    const id = job(env), bad = Object.assign({}, GOOD_RESULT, { summary: 'Closed 40 deals.' });
    env.app.append_('Tailor Requests', { 'Request ID': 'TR-1', 'Job ID': id, 'Status': 'DONE', 'Result JSON': JSON.stringify(bad) });
    env.app.pollTick();
    const tr = env.app.rows_('Tailor Requests')[0];
    assert.strictEqual(tr.Status, 'FAILED');
    assert.ok(/number not in CV: 40/.test(tr['Completed At']));
    assert.strictEqual(env.state.emails.length, 0);
  },

  'a missing master CV fails the request instead of crashing every 5 minutes'(env = seeded()) {
    env.setConfig({ 'Master CV Doc ID': '' });
    env.app.append_('Tailor Requests', { 'Request ID': 'TR-1', 'Job ID': job(env), 'Status': 'DONE', 'Result JSON': JSON.stringify(GOOD_RESULT) });
    env.app.pollTick();
    assert.strictEqual(env.app.rows_('Tailor Requests')[0].Status, 'FAILED');
  },

  'Apply on a portal job opens the posting and sends nothing'(env = seeded()) {
    const r = env.app.applyJob(env.unlock(), job(env), true);
    assert.ok(r.open);
    assert.strictEqual(env.state.emails.length, 0);
  },

  'Apply by email needs a tailored CV, then asks to confirm, then sends'(env = seeded()) {
    const id = job(env, { 'Apply Email': 'hiring@example.com' });
    assert.deepStrictEqual(Object.keys(env.app.applyJob(env.unlock(), id, false)), ['needTailor']);
    env.app.append_('Tailor Requests', { 'Request ID': 'TR-1', 'Job ID': id, 'Status': 'DONE', 'Result JSON': JSON.stringify(GOOD_RESULT) });
    env.app.pollTick();
    const before = env.state.emails.length;
    assert.ok(env.app.applyJob(env.unlock(), id, false).confirm, 'asks first');
    assert.strictEqual(env.state.emails.length, before, 'nothing sent without confirmation');
    assert.strictEqual(env.app.applyJob(env.unlock(), id, true).sent, true);
    const mail = env.state.emails[env.state.emails.length - 1];
    assert.strictEqual(mail.to, 'hiring@example.com');
    assert.strictEqual(mail.attachments.length, 1);
    assert.strictEqual(env.app.rows_('Applications').length, 1);
    assert.strictEqual(jobRow(env, id).Status, 'Applied');
  },

  'alert email stays well under Gmail\'s clipping limit'(env = seeded()) {
    for (let i = 0; i < 20; i++) job(env, { 'Description': 'x'.repeat(1500) });
    runDone(env, 'RUN-1'); env.app.pollTick();
    const mail = env.state.emails[0];
    assert.ok(Buffer.byteLength(mail.htmlBody) < 90 * 1024, 'size ' + mail.htmlBody.length);
    assert.ok(mail.subject.startsWith('Job Finder: 15 new job(s)'));
  },

  'dashboard data lists jobs best first'(env = seeded()) {
    job(env, { 'Location': 'Delhi' }); job(env);
    env.app.pollTick();
    const list = env.app.getJobs(env.unlock());
    assert.ok(list[0].score >= list[1].score);
  },

  'settings form lists every editable setting with its current value'(env = seeded()) {
    const list = env.app.getSettings(env.unlock());
    const email = list.find(s => s.key === 'Email To');
    assert.strictEqual(email.value, 'owner@example.com');
    assert.ok(!list.some(s => s.key === 'Master CV Doc ID'), 'CV link is set by uploading, not typed');
    assert.strictEqual(list.find(s => s.key === 'Work Modes').value, 'On-site; Hybrid; Remote');
  },

  'saving settings validates and writes only changed values'(env = seeded()) {
    const bad = env.app.saveSettings(env.unlock(), { 'Email To': 'not-an-email', 'Min Fit Score': '150', 'Alert Time If No Run': '9am', 'Weight Skills': '50' });
    assert.strictEqual(bad.ok, false);
    assert.strictEqual(bad.errors.length, 4, bad.errors.join(' | '));
    assert.strictEqual(env.app.cfg_()['Email To'], 'owner@example.com', 'nothing saved when anything is wrong');
    const good = env.app.saveSettings(env.unlock(), { 'Email To': 'a@example.com; b@example.com', 'Min Fit Score': '70', 'Locations': 'Pune ;Mumbai',
      'Research Paused': 'yes', 'Experience Years': '8' });
    assert.strictEqual(good.ok, true, (good.errors || []).join(' | '));
    assert.strictEqual(good.saved.join(','), 'Email To,Min Fit Score,Locations,Research Paused');
    const c = env.app.cfg_();
    assert.strictEqual(c['Email To'], 'a@example.com, b@example.com');
    assert.strictEqual(c.Locations, 'Pune; Mumbai');
    assert.strictEqual(c['Research Paused'], 'YES');
  },

  'settings cannot change the CV link or unknown keys'(env = seeded()) {
    const r = env.app.saveSettings(env.unlock(), { 'Master CV Doc ID': 'x', 'Something': 'y' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errors.length, 2);
  },

  'new default settings are added to an older sheet without touching existing values'(env = seeded()) {
    const sh = env.sheet('Config'), row = env.app.rows_('Config').find(r => r.Key === 'Work Modes')._row;
    sh.data.splice(row - 1, 1);
    env.app.pollTick();
    assert.strictEqual(env.app.cfg_()['Work Modes'], 'On-site; Hybrid; Remote');
    assert.strictEqual(env.app.cfg_()['Email To'], 'owner@example.com');
  },

  'test alert goes only to the alert address'(env = seeded()) {
    assert.strictEqual(env.app.sendTestAlert(env.unlock()), 'owner@example.com');
    assert.strictEqual(env.state.emails.length, 1);
    assert.strictEqual(env.state.emails[0].to, 'owner@example.com');
  },

  'without the PIN, page actions are refused and nothing is sent'(env = seeded()) {
    const id = job(env, { 'Apply Email': 'hiring@example.com' });
    env.unlock();
    ['getJobs', 'getSettings', 'sendTestAlert'].forEach(f => assert.throws(() => env.app[f](''), /NEEDS_PIN/, f));
    assert.throws(() => env.app.applyJob('made-up-token', id, true), /NEEDS_PIN/);
    assert.throws(() => env.app.previewCv(undefined, 'some-doc'), /NEEDS_PIN/);
    assert.throws(() => env.app.saveSettings('', { 'Email To': 'thief@example.com' }), /NEEDS_PIN/);
    assert.strictEqual(env.state.emails.length, 0);
    assert.strictEqual(env.app.cfg_()['Email To'], 'owner@example.com');
  },

  'the PIN is stored only as a salted one-way hash'(env = seeded()) {
    env.unlock('739154');
    const all = JSON.stringify(env.state.props);
    assert.ok(all.indexOf('739154') < 0, 'PIN not stored as typed');
    assert.ok(/^[0-9a-f]{64}$/.test(env.state.props.PIN_HASH));
  },

  'five wrong PINs lock the page, email the owner once, and repeat lockouts last longer'(env = seeded()) {
    env.unlock('739154');
    for (let i = 0; i < 4; i++) assert.ok(/tries left/.test(env.app.unlock('000000').message));
    assert.ok(/locked for 15 minutes/.test(env.app.unlock('000000').message));
    assert.strictEqual(env.app.unlock('739154').ok, false, 'even the right PIN waits out the lock');
    assert.strictEqual(env.state.emails.filter(e => /page locked/.test(e.subject)).length, 1);
    env.setNow('2026-10-19T03:46:00Z');
    for (let i = 0; i < 5; i++) env.app.unlock('111111');
    assert.strictEqual(env.app.pinStatus().lockedMinutes, 30);
    env.setNow('2026-10-19T04:17:00Z');
    assert.strictEqual(env.app.unlock('739154').ok, true, 'right PIN works once the lock ends');
  },

  'an unlock lasts 6 hours'(env = seeded()) {
    const t = env.unlock();
    assert.ok(env.app.getJobs(t));
    env.setNow('2026-10-19T09:31:00Z');
    assert.throws(() => env.app.getJobs(t), /NEEDS_PIN/);
  },

  'only the signed-in owner can create the first PIN or run setup'(env = seeded()) {
    env.state.activeUser = '';
    assert.strictEqual(env.app.pinStatus().canCreate, false);
    assert.throws(() => env.app.createPin('123456'), /Only the owner/);
    assert.throws(() => env.app.setup(), /only be run by the owner/);
    env.state.activeUser = env.state.me;
    assert.strictEqual(env.app.createPin('123456').ok, true);
    assert.throws(() => env.app.createPin('654321'), /already exists/, 'cannot be replaced without the old PIN');
  },

  'a visitor without Google sign-in can create the first PIN only with the setup code'(env = seeded()) {
    env.state.activeUser = '';
    env.app.SETUP_CODE_HASH_ = env.app.pinHash_('ABCD2345EF', 'setup');
    const st = env.app.pinStatus();
    assert.ok(st.canCreate && st.needsSetupCode);
    assert.throws(() => env.app.createPin('246810', 'WRONG-CODE'), /setup code is wrong/);
    assert.strictEqual(env.app.createPin('246810', 'abcd-2345-ef').ok, true, 'case and dashes ignored');
    assert.throws(() => env.app.createPin('111111', 'ABCD2345EF'), /already exists/, 'code is useless once a PIN exists');
    assert.strictEqual(env.app.pinStatus().canCreate, false);
  },

  'ten wrong setup codes disable the setup code'(env = seeded()) {
    env.state.activeUser = '';
    env.app.SETUP_CODE_HASH_ = env.app.pinHash_('ABCD2345EF', 'setup');
    for (let i = 0; i < 10; i++) assert.throws(() => env.app.createPin('246810', 'GUESS' + i));
    assert.throws(() => env.app.createPin('246810', 'ABCD2345EF'), /setup code is wrong/);
    assert.strictEqual(env.app.pinStatus().canCreate, false);
  },

  'changing the PIN needs the current PIN'(env = seeded()) {
    const t = env.unlock('739154');
    assert.throws(() => env.app.changePin(t, '000000', '258025'), /Current PIN is wrong/);
    assert.strictEqual(env.app.changePin(t, '739154', '258025'), true);
    assert.strictEqual(env.app.unlock('739154').ok, false);
    assert.strictEqual(env.app.unlock('258025').ok, true);
  },

  'CV reader extracts every expected fact from 18 CV layouts'() {
    const sets = accuracy.SETS.tuning.concat(accuracy.SETS.holdout), misses = [];
    accuracy.score(sets).forEach(r => r.checks.filter(c => !c.ok).forEach(c => misses.push(r.format + ' / ' + c.field + ': got "' + c.got + '"')));
    assert.strictEqual(misses.length, 0, misses.join('\n'));
  },

  'uploading a CV shows a preview and changes nothing until confirmed'(env = createEnv()) {
    env.app.setup();
    const cv = accuracy.SETS.tuning[0].text;
    const res = env.app.importCv(env.unlock(), 'Rahul CV.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from(cv).toString('base64'));
    assert.strictEqual(res.cv.name, 'Rahul Mehta');
    assert.ok(res.plan.find(x => x.field === 'Experience Years' && x.proposed === '12.3' && x.change));
    assert.strictEqual(env.app.cfg_()['Master CV Doc ID'], '', 'nothing saved yet');
    assert.strictEqual(env.app.rows_('Profile').length, 0);
    const folder = Object.values(env.state.folders)[0];
    assert.ok(folder.files.indexOf(res.docId) >= 0, 'converted CV kept in the Job Finder folder');
  },

  'confirming a CV fills Profile and Config, keeping choices already made'(env = createEnv()) {
    env.app.setup();
    env.setConfig({ 'Locations': 'Bengaluru; Remote' });
    const res = env.app.importCv(env.unlock(), 'cv.txt', 'text/plain', Buffer.from(accuracy.SETS.tuning[0].text).toString('base64'));
    const out = env.app.applyCv(env.unlock(), res.docId);
    const c = env.app.cfg_(), p = env.app.profile_();
    assert.strictEqual(c['Master CV Doc ID'], res.docId);
    assert.strictEqual(c['Experience Years'], '12.3');
    assert.strictEqual(c['Target Titles'], 'Manager – Transaction Advisory');
    assert.strictEqual(c.Locations, 'Bengaluru; Remote', 'owner choice kept');
    assert.strictEqual(p.Name, 'Rahul Mehta');
    assert.ok(/Financial Due Diligence/.test(p['Core Skills']) && /Power BI/.test(p.Tools));
    assert.strictEqual(JSON.parse(p['CV Data']).experience.length, 3);
    assert.ok(out.changed.indexOf('Name') >= 0);
  },

  'scoring uses skills read from an uploaded CV'(env = createEnv()) {
    env.app.setup();
    env.app.applyCv(env.unlock(), env.app.importCv(env.unlock(), 'cv.txt', 'text/plain', Buffer.from(accuracy.SETS.tuning[0].text).toString('base64')).docId);
    const s = env.app.scoreJob_({ 'Title': 'Manager - Transaction Advisory', 'Location': 'Mumbai', 'Experience Asked': '10-14 years',
      'Posted On': '2026-10-18', 'Must Have': 'Financial due diligence; Valuation', 'Nice To Have': 'Capital IQ' }, env.app.profile_(), env.app.cfg_());
    assert.strictEqual(s.score, 100, s.breakdown);
  }
};

let failed = 0;
Object.keys(tests).forEach(name => {
  try { tests[name](); console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); }
});
console.log('\n' + (Object.keys(tests).length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
