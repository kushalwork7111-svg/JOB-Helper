/* ---------- data and actions for the dashboard page (every public function checks the PIN unlock) ---------- */

const JOB_STATUSES_ = ['New', 'Shortlisted', 'Tailored', 'Applied', 'Not interested', 'Closed'];
const APP_STATUSES_ = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'No response', 'Withdrawn'];

/** Sheet cells can hold Date objects, which the page bridge cannot carry: always send text. */
function day_(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? String(v) : Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
}
function stamp_(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? String(v) : Utilities.formatDate(d, 'Asia/Kolkata', 'd MMM yyyy, HH:mm');
}
function ageDays_(v) {
  const d = v instanceof Date ? v : new Date(v);
  return !v || isNaN(d) ? null : Math.max(0, Math.floor((Date.now() - d.getTime()) / 864e5));
}

/** A semicolon list from the Profile tab, keeping the owner's capitals. */
function asWritten_(v) { return String(v || '').split(';').map(x => x.trim()).filter(Boolean); }

/** Everything the page shows, in one call. */
function getDashboard(token) {
  auth_(token);
  const c = cfg_(), p = profile_(), has = skillMatcher_(p), props = PropertiesService.getScriptProperties();
  const strong = num_(c['Strong Score']) || 75, good = num_(c['Good Score']) || 55;
  const band = s => s >= strong ? 'Strong' : s >= good ? 'Good' : 'Stretch';
  const reqs = rows_('Tailor Requests'), tailorBy = {};
  reqs.forEach(r => { tailorBy[r['Job ID']] = { status: r.Status, docUrl: r['Doc URL'] || '', note: String(r['Completed At'] || '').indexOf('Not used') === 0 ? r['Completed At'] : '' }; });
  const jobs = rows_('Jobs').map(j => {
    const score = num_(j['Fit Score']), parts = String(j['Score Breakdown'] || '').split(' · ').map(x => {
      const m = x.match(/^(\w+) (\d+)\/(\d+)$/); return m ? { name: m[1], got: +m[2], of: +m[3] } : null; }).filter(Boolean);
    return { id: String(j['Job ID']), title: j.Title, company: j.Company, location: j.Location, mode: j['Work Mode'], exp: j['Experience Asked'],
      salary: j.Salary, source: j.Source, url: j['Apply URL'], email: j['Apply Email'], description: j.Description,
      must: list_(j['Must Have']).map(t => ({ t, ok: has(t) })), nice: list_(j['Nice To Have']).map(t => ({ t, ok: has(t) })),
      score, scored: j['Fit Score'] !== '', band: band(score), parts, status: j.Status || 'New', posted: day_(j['Posted On']),
      age: ageDays_(j['Posted On']), found: day_(j['Found On']), emailed: day_(j['Emailed On']), tailor: tailorBy[j['Job ID']] || null };
  }).sort((a, b) => b.score - a.score);
  const jobById = {}; jobs.forEach(j => { jobById[j.id] = j; });
  const today = today_();
  const applications = rows_('Applications').map(a => {
    const j = jobById[String(a['Job ID'])] || {};
    const follow = day_(a['Follow-up On']);
    return { jobId: String(a['Job ID']), title: j.title || '', company: j.company || '', url: j.url || '', appliedOn: day_(a['Applied On']),
      method: a.Method, cvFile: a['CV File'], status: a.Status || 'Applied', next: a['Next Step'], followUp: follow, notes: a.Notes,
      due: !!follow && follow <= today && ['Applied', 'No response', 'Interviewing'].indexOf(a.Status || 'Applied') >= 0 };
  }).sort((a, b) => (b.appliedOn > a.appliedOn ? 1 : -1));
  const runs = rows_('Run Log'), last = runs[runs.length - 1];
  return {
    version: APP_VERSION, today,
    jobStatuses: JOB_STATUSES_, appStatuses: APP_STATUSES_,
    profile: { name: p.Name || '', headline: p.Headline || '', city: p['Current City'] || '', email: p.Email || '', years: c['Experience Years'] || '',
      skills: asWritten_(p['Core Skills']), tools: asWritten_(p.Tools), certifications: asWritten_(p.Certifications),
      education: asWritten_(p.Education),
      cvUrl: c['Master CV Doc ID'] ? 'https://docs.google.com/document/d/' + c['Master CV Doc ID'] + '/edit' : '' },
    health: {
      hasCv: !!c['Master CV Doc ID'], hasEmail: !!c['Email To'], hasRuns: runs.length > 0, paused: String(c['Research Paused']).toUpperCase() === 'YES',
      lastRun: last ? { when: stamp_(last['Run Date']), found: last['Jobs Found'], fresh: last['New Jobs'], status: last.Status } : null,
      waitingTailor: reqs.filter(r => r.Status === 'QUEUED').length, lastAlert: stamp_(props.getProperty('LAST_ALERT')),
      minScore: num_(c['Min Fit Score']), strong, good
    },
    jobs, applications
  };
}

/** Shortlist, Not interested, back to New, etc. */
function setStatus(token, jobId, status) {
  auth_(token);
  if (JOB_STATUSES_.indexOf(status) < 0) throw new Error('Unknown status');
  const j = rows_('Jobs').find(r => String(r['Job ID']) === String(jobId));
  if (!j) throw new Error('Job not found');
  setCell_('Jobs', j._row, 'Status', status);
  return status;
}

/** For portal applications: the owner applied on the company site and wants it tracked. */
function markApplied(token, jobId) {
  auth_(token);
  const j = rows_('Jobs').find(r => String(r['Job ID']) === String(jobId));
  if (!j) throw new Error('Job not found');
  if (!rows_('Applications').some(a => String(a['Job ID']) === String(jobId))) {
    const tr = rows_('Tailor Requests').filter(r => r['Job ID'] === j['Job ID'] && r['Doc URL']).pop();
    append_('Applications', { 'Job ID': j['Job ID'], 'Applied On': new Date(), 'Method': 'Portal', 'CV File': tr ? tr['Doc URL'] : '',
      'Status': 'Applied', 'Next Step': 'Wait for a reply', 'Follow-up On': new Date(Date.now() + 7 * 864e5) });
  }
  setCell_('Jobs', j._row, 'Status', 'Applied');
  return true;
}

/** Saves tracker edits for one application. Only these four fields can change. */
function updateApplication(token, jobId, changes) {
  auth_(token);
  const a = rows_('Applications').find(r => String(r['Job ID']) === String(jobId));
  if (!a) throw new Error('Application not found');
  changes = changes || {};
  if ('status' in changes) {
    if (APP_STATUSES_.indexOf(changes.status) < 0) throw new Error('Unknown status');
    setCell_('Applications', a._row, 'Status', changes.status);
  }
  if ('next' in changes) setCell_('Applications', a._row, 'Next Step', String(changes.next || '').slice(0, 200));
  if ('notes' in changes) setCell_('Applications', a._row, 'Notes', String(changes.notes || '').slice(0, 1000));
  if ('followUp' in changes) {
    const f = String(changes.followUp || '');
    if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new Error('Follow-up date must look like 2026-11-05');
    setCell_('Applications', a._row, 'Follow-up On', f);
  }
  return true;
}
