function jobIdentity_(job) {
  return [normalize_(job.company), normalize_(job.title), normalize_(job.location)].join('|');
}
function importJob_(input) {
  var company = cleanText_(input.company, 150), title = cleanText_(input.title, 200), description = cleanText_(input.description, 20000);
  if (!company || !title || description.length < 100 || !validWebUrl_(input.url)) throw new Error('Add employer, role, an HTTPS posting URL, and at least 100 characters of job description.');
  var now = new Date().toISOString(), job = {id: Utilities.getUuid(), source: {type: 'manual', board: 'user-import', company: company},
    company: company, title: title, location: cleanText_(input.location || 'Not specified', 200), description: description, url: input.url,
    remote: input.remote === true, salary: null, postedAt: input.postedAt ? new Date(input.postedAt).toISOString() : null,
    closingAt: input.closingAt ? new Date(input.closingAt).toISOString() : null, firstSeenAt: now,
    verifiedAt: input.confirmedOpen === true && input.officialEmployerSource === true ? now : null,
    openState: input.confirmedOpen === true && input.officialEmployerSource === true ? 'open' : 'unknown',
    openEvidence: input.confirmedOpen === true ? 'User-confirmed employer listing; not independently fetched.' : 'Unverified manual import',
    decision: 'shortlist'};
  if (input.salaryMin || input.salaryMax) {
    job.salary = {min: Number(input.salaryMin || 0), max: Number(input.salaryMax), currency: cleanText_(input.salaryCurrency, 3).toUpperCase(), interval: 'year'};
    if (!annualSalary_(job.salary) || !/^[A-Z]{3}$/.test(job.salary.currency)) throw new Error('Enter a valid disclosed annual salary range and currency. Do not infer pay.');
  }
  var duplicate = rows_('jobs').find(function (old) { return old.url === job.url || jobIdentity_(old) === jobIdentity_(job); });
  if (duplicate) {
    if (duplicate.source.type !== 'manual') throw new Error('This employer, role, and location already exists from a live board. Open the existing opportunity.');
    job.id = duplicate.id; job.firstSeenAt = duplicate.firstSeenAt; job.decision = duplicate.decision || 'shortlist';
    job.alternateSources = (duplicate.alternateSources || []).concat(duplicate.url === job.url ? [] : [duplicate.url]).slice(-10);
  }
  job.assessment = localAssessment_(job, approvedFacts_(), getSettings_());
  put_('jobs', job); activity_('import', 'Manually imported ' + title + ' at ' + company + '; ' + job.openEvidence + '.');
  return {id: job.id, deduplicated: !!duplicate};
}
function verifyManualJob_(input) {
  var job = find_('jobs', input.id);
  if (!job || job.source.type !== 'manual') throw new Error('This is not a manually imported posting.');
  if (input.confirmedOpen !== true || input.officialEmployerSource !== true) throw new Error('Open the official employer posting and confirm it still accepts applications.');
  job.openState = 'open'; job.verifiedAt = new Date().toISOString(); job.openEvidence = 'User-confirmed employer listing; not independently fetched.';
  put_('jobs', job); return job;
}
function setJobDecision_(input) {
  if (['shortlist', 'watchlist', 'dismissed'].indexOf(input.decision) < 0) throw new Error('Invalid shortlist decision.');
  var job = find_('jobs', input.id);
  if (!job) throw new Error('Job not found.');
  job.decision = input.decision; put_('jobs', job); return {saved: true};
}
