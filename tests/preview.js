// Renders the real dashboard page against the local harness with fictional demo data and saves screenshots.
// Run with: node tests/preview.js <output folder>
const fs = require('fs');
const path = require('path');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), '/opt/node22/lib/node_modules'] }));
const { createEnv } = require('./harness');
const { SETS } = require('./cv_accuracy');

const OUT = process.argv[2] || path.join(__dirname, '..', 'previews');
fs.mkdirSync(OUT, { recursive: true });

function demoEnv() {
  const env = createEnv({ now: Date.parse('2026-10-20T04:00:00Z') });
  env.app.setup();
  const t = env.unlock();
  env.app.applyCv(t, env.app.importCv(t, 'cv.txt', 'text/plain', Buffer.from(SETS.tuning[0].text).toString('base64')).docId);
  env.app.saveSettings(t, { 'Email To': 'demo@example.com', 'Locations': 'Mumbai; Bengaluru; Remote', 'Experience Years': '12' });
  const jobs = [
    ['Manager – Transaction Advisory', 'Northbridge Advisory LLP', 'Mumbai', 'Hybrid', '10-14 years', '35-45 LPA', 'LinkedIn', 'Financial due diligence; Valuation; Quality of earnings', 'Capital IQ', 1],
    ['Senior Manager – Deal Advisory', 'Harbour & Co', 'Mumbai', 'On-site', '10-15 years', '', 'Naukri', 'Financial due diligence; Working capital; Buy-side', 'Power BI', 2],
    ['Value Creation Manager', 'Crestline Capital', 'Bengaluru', 'Hybrid', '8-12 years', '40 LPA', 'iimjobs', 'Valuation; Financial modelling; Operational due diligence', '', 4],
    ['AVP – Corporate Finance', 'Meridian Bank Ltd', 'Mumbai', 'On-site', '9-13 years', '', 'Company site', 'Financial modelling; Credit analysis; Valuation', 'Excel', 6],
    ['Manager – FP&A', 'Lattice Consumer Pvt Ltd', 'Pune', 'Hybrid', '7-10 years', '28 LPA', 'Indeed', 'Budgeting; Forecasting; SAP', 'Power BI', 3],
    ['Due Diligence Lead', 'Orbit Partners', 'Remote', 'Remote', '12-16 years', '', 'LinkedIn', 'Financial due diligence; Quality of earnings', 'Alteryx', 9],
    ['Finance Business Partner', 'Kestrel Retail Ltd', 'Delhi', 'On-site', '5-8 years', '20 LPA', 'Foundit', 'Business partnering; SAP; Retail', '', 12]
  ];
  jobs.forEach((j, i) => env.app.append_('Jobs', { 'Job ID': 'JOB-20261020-' + (i + 1), 'Found On': '2026-10-20',
    'Posted On': new Date(Date.parse('2026-10-20T04:00:00Z') - j[9] * 864e5), 'Title': j[0], 'Company': j[1], 'Location': j[2], 'Work Mode': j[3],
    'Experience Asked': j[4], 'Salary': j[5], 'Source': j[6], 'Apply URL': 'https://example.com/jobs/' + (i + 1), 'Must Have': j[7], 'Nice To Have': j[8],
    'Status': 'New', 'Description': 'Fictional demo posting.\n\nYou will lead buy-side diligence workstreams, review quality of earnings and net working capital, and present findings to private equity clients.' }));
  env.app.append_('Run Log', { 'Run ID': 'RUN-20261020-1', 'Run Date': new Date(), 'Jobs Found': 23, 'New Jobs': 7, 'Status': 'DONE' });
  env.app.pollTick();
  env.app.setStatus(t, 'JOB-20261020-3', 'Shortlisted');
  env.app.append_('Tailor Requests', { 'Request ID': 'TR-1', 'Job ID': 'JOB-20261020-2', 'Status': 'QUEUED' });
  env.app.markApplied(t, 'JOB-20261020-4');
  env.app.updateApplication(t, 'JOB-20261020-4', { status: 'Interviewing', next: 'Partner round on Friday', followUp: '2026-10-19' });
  env.app.markApplied(t, 'JOB-20261020-6');
  return { env, token: t };
}

(async () => {
  const { env, token } = demoEnv();
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8').replace('<?= version ?>', '0.6');
  const browser = await chromium.launch();
  const shots = [];
  for (const [label, viewport] of [['laptop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
    await page.route('**/*', r => r.request().url() === 'https://preview.local/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort());
    // Fake google.script.run backed by the harness; results pass through JSON like the real bridge.
    await page.exposeFunction('gsr', (fn, args) => {
      try { const v = env.app[fn].apply(null, args); return { value: JSON.parse(JSON.stringify(v == null ? null : v)) }; }
      catch (e) { return { error: e.message }; }
    });
    await page.addInitScript(tok => {
      sessionStorage.setItem('jf', tok);
      const runner = () => { let ok = () => {}, no = () => {}; const r = new Proxy({}, { get: (_, k) => k === 'withSuccessHandler' ? f => { ok = f; return r; }
        : k === 'withFailureHandler' ? f => { no = f; return r; } : (...a) => window.gsr(k, a).then(x => x.error ? no(new Error(x.error)) : ok(x.value)) }); return r; };
      window.google = { script: { get run() { return runner(); } } };
    }, token);
    await page.goto('https://preview.local/', { waitUntil: 'domcontentloaded' });
    const snap = async name => { await page.waitForTimeout(250); const f = path.join(OUT, label + '-' + name + '.png'); await page.screenshot({ path: f, fullPage: label === 'laptop' }); shots.push(f); };
    await page.waitForSelector('.stats'); await snap('1-overview');
    await page.evaluate(() => go('jobs')); await page.waitForSelector('.job'); await snap('2-jobs');
    await page.click('.job h3'); await page.waitForSelector('.modal'); await snap('3-job-detail'); await page.keyboard.press('Escape');
    await page.evaluate(() => go('apps')); await snap('4-applications');
    if (label === 'laptop') { await page.evaluate(() => go('cv')); await snap('5-my-cv'); await page.evaluate(() => go('settings')); await page.waitForSelector('#set0'); await snap('6-settings'); }
    await page.close();
  }
  await browser.close();
  console.log(shots.join('\n'));
})();
