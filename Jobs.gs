function assessJob_(id) {
  var job = find_('jobs', id), profile = getProfile_(), prefs = getSettings_();
  if (!job) throw new Error('Job not found.');
  if (!profile.cvText) throw new Error('Save your CV before matching jobs.');
  var facts = approvedFacts_(), local = localAssessment_(job, facts, prefs);
  job.assessment = local; job.assessedAt = new Date().toISOString(); put_('jobs', job);
  if (!prefs.features.ai || !prefs.externalAiConsent) return local;
  if (!facts.length) throw new Error('Approve candidate facts before optional AI matching.');
  var approvedText = facts.map(function (fact) { return fact.statement; }).join('\n');
  var raw = geminiJson_('Assess this specific job against the CV and user preferences. '
    + 'Return JSON {score:0..100,fit:"strong|stretch|weak",confidence:"high|medium|low",summary,matchedSkills:string[],gaps:string[], '
    + 'evidence:[{cvQuote,jobQuote,explanation}],questions:string[],preparation:[{topic,action,practice,materials:[{title,url}]}]}. '
    + 'Quote exact short excerpts from BOTH source documents for each fit argument. Distinguish requirements from nice-to-haves. '
    + 'Include a stretch fit where transferable financial analysis, valuation, audit, or transaction skills may compensate for missing FDD experience. '
    + 'A mandatory license, legal work authorization, or essential experience gap must be stated; do not assume it away. '
    + 'Scores estimate suitability and are not probabilities of hiring. Give targeted preparation and interview drills for ALL assessed jobs, '
    + 'including practical financial due diligence exercises when relevant. Materials must be real official or established educational URLs; '
    + 'omit URLs you cannot identify reliably. Do not infer salary or open status.',
    {cv: approvedText, job: {title: job.title, company: job.company, location: job.location,
      description: job.description, salary: job.salary}, preferences: prefs});
  job.assessment = sanitizeAssessment_(raw, job, {cvText: approvedText});
  job.assessment.requirementMap = local.requirementMap;
  job.assessedAt = new Date().toISOString();
  if (getProfile_().cvText !== profile.cvText || find_('jobs', id).description !== job.description) {
    throw new Error('Your CV or this posting changed during assessment. Re-assess using the updated documents.');
  }
  put_('jobs', job);
  return job.assessment;
}
function scanJobs_() {
  var lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) throw new Error('A scan is already running. Refresh after it finishes.');
  try { return scanJobsUnlocked_(); } finally { lock.releaseLock(); }
}
function scanJobsUnlocked_() {
  var start = Date.now(), prefs = getSettings_(), profile = getProfile_();
  if (!prefs.sources.length) throw new Error('Add employer boards in Settings, or use Discover employers first.');
  if (!profile.cvText) throw new Error('Save your CV first.');
  var errors = [], fetched = [], successful = {}, incomplete = [], boardsChecked = 0;
  prefs.sources.forEach(function (source) {
    if (Date.now() - start > 160000) { errors.push(source.company + ': postponed to the next scan (runtime budget).'); return; }
    try {
      var result = sourceJobs_(source); fetched = fetched.concat(result.jobs); boardsChecked++;
      if (result.complete) successful[sourceKey_(source)] = true;
      else incomplete.push(source.company + ': board exceeds pagination limit; missing jobs are not marked closed.');
    } catch (e) { errors.push(source.company + ': ' + e.message); }
  });
  var existing = rows_('jobs'), byId = {};
  existing.forEach(function (job) { byId[job.id] = job; });
  var seen = {};
  fetched.forEach(function (job) { seen[job.id] = true; });
  // Prioritize role-title matches for new imports. Existing saved jobs are always refreshed.
  var newJobs = fetched.filter(function (job) { return !byId[job.id]; }).map(function (job) {
    job.assessment = localAssessment_(job, approvedFacts_(), prefs); return job;
  }).filter(function (job) { return !jobGates_(job, prefs, Date.now()).rejected; })
    .sort(function (a, b) { return b.assessment.score - a.assessment.score; });
  var identities = {};
  existing.forEach(function (job) { identities[jobIdentity_(job)] = job; });
  newJobs = newJobs.filter(function (job) {
    var key = jobIdentity_(job), old = identities[key];
    if (old && sourceKey_(old.source) !== sourceKey_(job.source)) {
      old.alternateSources = (old.alternateSources || []).concat([job.url]).filter(function (url, i, all) { return all.indexOf(url) === i; }).slice(-10);
      put_('jobs', old); return false;
    }
    identities[key] = job; return true;
  });
  var selected = newJobs.slice(0, JH.MAX_JOBS_PER_SCAN), newIds = {};
  selected.forEach(function (job) { newIds[job.id] = true; });
  locked_(function () {
    fetched.forEach(function (job) {
      var old = byId[job.id];
      if (!old && !newIds[job.id]) return;
      if (old) {
        job.firstSeenAt = old.firstSeenAt;
        job.decision = old.decision || 'shortlist'; job.alternateSources = old.alternateSources || [];
        if (old.description === job.description && old.title === job.title && old.location === job.location) {
          job.assessment = old.assessment; job.assessedAt = old.assessedAt;
        }
      }
      if (!job.assessment) job.assessment = localAssessment_(job, approvedFacts_(), prefs);
      putUnlocked_('jobs', job);
    });
    existing.forEach(function (old) {
      if (!seen[old.id] && successful[sourceKey_(old.source)]) {
        old.openState = 'closed'; old.verifiedAt = new Date().toISOString(); putUnlocked_('jobs', old);
      } else if (!seen[old.id] && !successful[sourceKey_(old.source)] &&
          Date.now() - Date.parse(old.verifiedAt || '') > JH.OPEN_TTL_MS) {
        old.openState = 'unknown'; putUnlocked_('jobs', old);
      }
    });
  });
  var pending = rows_('jobs').filter(function (job) {
    return !jobGates_(job, prefs, Date.now()).rejected && (!job.assessment || job.assessment.assessedBy !== 'gemini');
  }).sort(function (a, b) { return (b.assessment || {}).score - (a.assessment || {}).score; });
  var assessed = 0, aiAvailable = prefs.features.ai && prefs.externalAiConsent && !!(props_().getProperty('GEMINI_API_KEY') || props_().getProperty('AI_GATEWAY_URL'));
  if (aiAvailable) {
    for (var i = 0; i < pending.length && assessed < 10 && Date.now() - start < 230000; i++) {
      try { assessJob_(pending[i].id); assessed++; }
      catch (e) { errors.push('AI matching stopped: ' + e.message); break; }
    }
  }
  if (boardsChecked) props_().setProperty('LAST_SCAN', new Date().toISOString());
  var result = {imported: selected.length, boardsChecked: boardsChecked, assessed: assessed,
    remainingAssessments: Math.max(0, pending.length - assessed),
    additionalBoardJobs: Math.max(0, newJobs.length - selected.length), errors: errors, warnings: incomplete,
    aiConnected: aiAvailable};
  activity_('scan', 'Checked ' + boardsChecked + ' boards; imported ' + selected.length + '; AI-assessed ' + assessed + '. '
    + errors.join(' ').slice(0, 500));
  return result;
}
function verifyOpen_(id) {
  var job = find_('jobs', id);
  if (!job) throw new Error('Job not found.');
  if (job.source.type === 'manual') {
    var checked = Date.parse(job.verifiedAt || '');
    if (job.closingAt && Date.parse(job.closingAt) < Date.now()) throw new Error('The recorded closing date has passed. No application was sent.');
    if (job.openState !== 'open' || !Number.isFinite(checked) || Date.now() - checked > JH.OPEN_TTL_MS || checked > Date.now() + 300000) {
      throw new Error('Manually imported job: open the official employer posting and confirm it is still open before proceeding.');
    }
    return job;
  }
  var result;
  try { result = sourceJobs_(job.source); }
  catch (e) { throw new Error('Cannot verify whether this application is open: ' + e.message); }
  var current = result.jobs.find(function (j) { return j.id === id; });
  if (!current) {
    if (result.complete) { job.openState = 'closed'; job.verifiedAt = new Date().toISOString(); put_('jobs', job); }
    throw new Error(result.complete ? 'This job is no longer listed on the employer board. No application was sent.' : 'Open status is inconclusive on this large board. No application was sent.');
  }
  current.firstSeenAt = job.firstSeenAt;
  if (current.description !== job.description || current.title !== job.title) {
    put_('jobs', current);
    throw new Error('The employer updated this posting. Re-assess it and regenerate the application before sending.');
  }
  current.assessment = job.assessment; current.assessedAt = job.assessedAt;
  put_('jobs', current);
  return current;
}
