/* ---------- settings the owner edits on the dashboard ---------- */

const SETTINGS_ = [
  { group: 'Alerts', key: 'Email To', label: 'Send job alerts to', type: 'emails', help: 'One or more email addresses, separated by commas' },
  { group: 'Alerts', key: 'Min Fit Score', label: 'Only email jobs scoring at least', type: 'number', min: 0, max: 100 },
  { group: 'Alerts', key: 'Max Jobs Per Email', label: 'Most jobs in one email', type: 'number', min: 1, max: 50 },
  { group: 'Alerts', key: 'Alert Time If No Run', label: 'Warn me if no search has arrived by (IST)', type: 'time' },
  { group: 'Alerts', key: 'Research Paused', label: 'Pause job alerts', type: 'yesno' },
  { group: 'What to look for', key: 'Target Titles', label: 'Job titles', type: 'list', help: 'Separate with semicolons' },
  { group: 'What to look for', key: 'Locations', label: 'Cities', type: 'list', help: 'Separate with semicolons; add Remote if wanted' },
  { group: 'What to look for', key: 'Work Modes', label: 'Work modes', type: 'list', help: 'On-site; Hybrid; Remote' },
  { group: 'What to look for', key: 'Experience Years', label: 'My years of experience', type: 'number', min: 0, max: 60, decimals: true },
  { group: 'What to look for', key: 'Min Salary (LPA)', label: 'Minimum salary (lakh per annum)', type: 'number', min: 0, max: 1000, decimals: true, optional: true },
  { group: 'What to look for', key: 'Exclude Companies', label: 'Companies to skip', type: 'list', help: 'Separate with semicolons' },
  { group: 'Scoring', key: 'Weight Skills', label: 'Points for skills match', type: 'number', min: 0, max: 100 },
  { group: 'Scoring', key: 'Weight Title', label: 'Points for job title match', type: 'number', min: 0, max: 100 },
  { group: 'Scoring', key: 'Weight Experience', label: 'Points for experience match', type: 'number', min: 0, max: 100 },
  { group: 'Scoring', key: 'Weight Location', label: 'Points for location match', type: 'number', min: 0, max: 100 },
  { group: 'Scoring', key: 'Weight Recency', label: 'Points for a fresh posting', type: 'number', min: 0, max: 100 },
  { group: 'Scoring', key: 'Strong Score', label: '"Strong" match from', type: 'number', min: 0, max: 100 },
  { group: 'Scoring', key: 'Good Score', label: '"Good" match from', type: 'number', min: 0, max: 100 }
];

/** Settings for the dashboard form, with current values from the Config tab. */
function getSettings(token) {
  auth_(token);
  const c = cfg_(), defaults = {};
  CONFIG_DEFAULTS.forEach(r => { defaults[r[0]] = r[1]; });
  return SETTINGS_.map(s => Object.assign({}, s, { value: c[s.key] != null ? c[s.key] : (defaults[s.key] || '') }));
}

/** Checks and saves edited settings. Saves nothing if any value is wrong. */
function saveSettings(token, changes) {
  auth_(token);
  const byKey = {}, errors = [], clean = {};
  SETTINGS_.forEach(s => { byKey[s.key] = s; });
  Object.keys(changes || {}).forEach(k => {
    const s = byKey[k];
    if (!s) { errors.push(k + ' cannot be changed here'); return; }
    let v = String(changes[k] == null ? '' : changes[k]).trim();
    if (s.type === 'emails') {
      const list = v.split(/[,;\s]+/).filter(Boolean);
      if (list.some(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) errors.push(s.label + ': "' + v + '" is not a valid email address');
      v = list.join(', ');
    } else if (s.type === 'number') {
      if (v === '' && s.optional) { clean[k] = ''; return; }
      const n = Number(v);
      if (v === '' || isNaN(n) || n < s.min || n > s.max || (!s.decimals && n % 1)) errors.push(s.label + ': enter a ' + (s.decimals ? '' : 'whole ') + 'number from ' + s.min + ' to ' + s.max);
      v = String(n);
    } else if (s.type === 'time') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) errors.push(s.label + ': use the 24-hour format HH:MM, e.g. 10:30');
    } else if (s.type === 'yesno') {
      v = v.toUpperCase();
      if (v !== 'YES' && v !== 'NO') errors.push(s.label + ': choose Yes or No');
    } else {
      v = v.split(/\s*[;\n]\s*/).filter(Boolean).join('; ');
    }
    clean[k] = v;
  });
  const before = cfg_(), after = Object.assign({}, before, clean), num = k => Number(after[k] || 0);
  const weights = ['Skills', 'Title', 'Experience', 'Location', 'Recency'].reduce((t, w) => t + num('Weight ' + w), 0);
  if (weights !== 100) errors.push('The five scoring points must add up to 100 (they now add up to ' + weights + ')');
  if (num('Strong Score') <= num('Good Score')) errors.push('"Strong" must start above "Good"');
  if (errors.length) return { ok: false, errors };
  const saved = Object.keys(clean).filter(k => String(before[k] == null ? '' : before[k]) !== clean[k]);
  saved.forEach(k => setConfig_(k, clean[k]));
  return { ok: true, saved };
}

/** Sends one sample alert to the alert address, so the owner can see it arrives. Only runs when the owner clicks the button. */
function sendTestAlert(token) {
  auth_(token);
  const c = cfg_();
  if (!c['Email To']) throw new Error('Set "Send job alerts to" first');
  MailApp.sendEmail({ to: c['Email To'], subject: 'Job Finder: test alert',
    htmlBody: '<p style="font-family:Arial,sans-serif">This is a test from your Job Finder. Real alerts arrive here after each daily search, best jobs first.</p>',
    name: 'Job Finder' });
  return c['Email To'];
}
