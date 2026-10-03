function installDailyTrigger_(prefs) {
  if (sharedEnabled_()) { ensureSharedTrigger_(); return; }
  var own = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'dailyJobAgent'; });
  own.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  if (prefs.dailyEmail) {
    ScriptApp.newTrigger('dailyJobAgent').timeBased().atHour(prefs.digestHour).everyDays(1).inTimezone(prefs.timezone).create();
  }
}
function dailyJobAgent(event) {
  // Installable triggers run as the owner. This handler never submits or contacts employers.
  var active = Session.getActiveUser().getEmail();
  var registered = event && event.triggerUid && ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'dailyJobAgent' && trigger.getUniqueId() === String(event.triggerUid);
  });
  if (active || !registered) requireOwner_();
  if (!props_().getProperty('DATABASE_ID')) return;
  var prefs = getSettings_();
  if (!prefs.dailyEmail) return;
  var failures = [];
  if (prefs.features.discovery && prefs.sources.length) {
    try { scanJobs_(); } catch (e) { failures.push('Job scan: ' + cleanText_(e.message, 300)); }
  }
  // Reply checks are optional; only metadata is requested and failures remain visible.
  try {
    var replyResult = syncReplies_(); failures = failures.concat(replyResult.errors);
  } catch (e) { failures.push('Reply sync failed; update application statuses manually.'); }
  if (failures.length) activity_('warning', failures.join(' '));
  sendDigest_(false);
  props_().setProperty('LAST_DAILY_RUN', new Date().toISOString());
}
function sendDigest_(manual) {
  var prefs = getSettings_(), date = Utilities.formatDate(new Date(), prefs.timezone, 'yyyy-MM-dd');
  var claimKey = 'DIGEST_DELIVERY_' + date;
  if (!manual) {
    var claimed = locked_(function () {
      if (props_().getProperty(claimKey)) return false;
      props_().setProperty(claimKey, 'sending'); return true;
    });
    if (!claimed) return {sent: false, note: 'Daily digest already sent or delivery needs checking.'};
  }
  var jobs = shortlist_(rows_('jobs'), prefs, Date.now()).slice(0, 20);
  var reminders = (prefs.features.reminders ? rows_('reminders') : []).filter(function (r) { return !r.complete && Date.parse(r.dueAt) <= Date.now() + 86400000; });
  var rows = jobs.map(function (job) {
    var gates = jobGates_(job, prefs, Date.now());
    return '<div style="padding:16px 0;border-bottom:1px solid #e2e8f0"><b>' + htmlEscape_(job.title) + '</b><br>'
      + htmlEscape_(job.company) + ' · ' + htmlEscape_(job.location) + '<br>Open status: ' + (job.source.type === 'manual' ? 'user-confirmed employer posting' : 'fetched from employer board') + '<br>Fit score: ' + job.assessment.score + '/100 · '
      + htmlEscape_(job.assessment.fit) + ' · ' + htmlEscape_(job.assessment.confidence) + ' confidence<br>'
      + htmlEscape_(job.assessment.summary) + '<br>'
      + (gates.warnings.length ? '<small>' + htmlEscape_(gates.warnings.join(' ')) + '</small><br>' : '')
      + '<a href="' + htmlEscape_(job.url) + '">Employer posting</a></div>';
  }).join('');
  var appUrl = ScriptApp.getService().getUrl();
  var html = '<div style="font-family:Arial,sans-serif;max-width:640px;color:#152238">'
    + '<h1>Your career briefing</h1><p>' + htmlEscape_(date) + ' · ' + jobs.length + ' shortlisted roles</p>'
    + '<p>Scores are estimates. Open status is shown per listing; manual imports depend on your recent confirmation. Unknown pay and remote restrictions require review. No application or outreach was sent.</p>'
    + (rows || '<p>No verified matches meet your current filters. Check sources, CV analysis, and the activity log.</p>')
    + '<h2>Reminders</h2>' + (reminders.map(function (r) { return '<p>' + htmlEscape_(r.title) + '</p>'; }).join('') || '<p>No reminders due.</p>')
    + (appUrl ? '<p><a href="' + htmlEscape_(appUrl) + '">Open your private dashboard</a></p>' : '') + '</div>';
  if (MailApp.getRemainingDailyQuota() < 1) {
    if (!manual) props_().setProperty(claimKey, 'quota-blocked');
    throw new Error('Google email quota is exhausted. No digest was sent.');
  }
  try {
    MailApp.sendEmail({to: userEmail_(), name: 'Career Radar - Opportunities', subject: 'Job Helper · ' + jobs.length + ' opportunities · ' + date,
      body: jobs.map(function (j) { return j.title + ' — ' + j.company + '\n' + j.url; }).join('\n\n') || 'No verified matches today. Open your dashboard to review filters and scan status.',
      htmlBody: html});
    if (!manual) props_().setProperty(claimKey, 'sent');
    if (manual) props_().setProperty('LAST_TEST_EMAIL', new Date().toISOString());
    activity_('digest', 'Digest sent to your account with ' + jobs.length + ' matches and ' + reminders.length + ' reminders.');
    return {sent: true, matches: jobs.length, reminders: reminders.length};
  } catch (e) {
    if (!manual && props_().getProperty(claimKey) !== 'sent') props_().setProperty(claimKey, 'uncertain');
    throw e;
  }
}

function ensureSharedTrigger_() {
  var handler = 'dailySharedJobAgent_';
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === handler; });
  if (sharedEnabled_()) {
    if (!existing.length) ScriptApp.newTrigger(handler).timeBased().everyMinutes(15).create();
    ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'dailyJobAgent'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  } else existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
function dailySharedJobAgent_(event) {
  // Private handler: inaccessible via google.script.run. Only the registered owner trigger can run it.
  if (!sharedEnabled_() || !event || !event.triggerUid || !ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'dailySharedJobAgent_' && t.getUniqueId() === String(event.triggerUid);
  })) return;
  if (!globalProps_().getProperty('DATABASE_ID')) return;
  pruneDailyState_();
  var started = Date.now(), users = users_().filter(function (u) { return u.enabled; });
  var cursor = Number(globalProps_().getProperty('SHARED_DAILY_CURSOR') || 0);
  for (var i = 0; i < users.length && Date.now() - started < 180000; i++) {
    var user = users[(cursor + i) % users.length];
    withActor_({id: user.id, email: user.email, admin: user.id === 'owner'}, function () {
      var prefs = getSettings_(), date = Utilities.formatDate(new Date(), prefs.timezone, 'yyyy-MM-dd');
      if (!prefs.dailyEmail || Number(Utilities.formatDate(new Date(), prefs.timezone, 'HH')) < prefs.digestHour || props_().getProperty('DIGEST_DELIVERY_' + date)) return;
      try {
        if (prefs.features.discovery && prefs.sources.length) scanJobs_();
        syncReplies_();
        sendDigest_(false); props_().setProperty('LAST_DAILY_RUN', new Date().toISOString());
      } catch (e) { activity_('warning', 'Daily briefing did not finish. Review your scan and email quota.'); }
    });
    globalProps_().setProperty('SHARED_DAILY_CURSOR', String((cursor + i + 1) % users.length));
  }
}
