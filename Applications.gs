function applicationForJob_(jobId) {
  return rows_('applications').find(function (a) { return a.jobId === jobId; }) || null;
}
function prepareApplication_(jobId) {
  var job = verifyOpen_(jobId), profile = getProfile_();
  var facts = approvedFacts_(), prefs = getSettings_();
  if (!facts.length) throw new Error('Approve at least one candidate fact in My CV & profile before generating a factual packet.');
  if (!profile.name) throw new Error('Save your full name in My CV & profile first.');
  var previous = applicationForJob_(jobId);
  if (previous && ['draft', 'ready', 'handoff'].indexOf(previous.status) < 0) {
    throw new Error('An application already exists for this job. Open it in Pipeline.');
  }
  var assessment = localAssessment_(job, facts, prefs);
  job.assessment = assessment; put_('jobs', job);
  var raw = localPacket_(job, profile, facts, assessment), aiWarning = '', usedAi = false;
  if (prefs.features.ai && prefs.externalAiConsent && (props_().getProperty('GEMINI_API_KEY') || props_().getProperty('AI_GATEWAY_URL'))) {
    try {
  var refined = geminiJson_('Create an honest application packet and interview preparation for this job. '
    + 'Return JSON {subject,coverLetter,screeningQuestions:string[],interviewPlan:[{topic,action,practice,materials:[{title,url}]}], '
    + 'interviewQuestions:string[],resumeSuggestions:string[]}. '
    + 'Write a concise first-person cover letter using only facts from the CV. Never claim missing FDD or other experience. '
    + 'Explain transferable skills plainly. Ask only job-relevant unanswered questions, including legal work authorization, notice period, salary expectations, '
    + 'relocation, or a specific mandatory qualification. Do not ask for protected demographic traits. '
    + 'Do not guess or fabricate answers. No sending or submission is permitted. Include role-specific technical exercises, '
    + 'behavioral STAR practice, company research, and credible learning materials. Resume suggestions must not invent achievements.',
    {cv: facts.map(function (f) { return f.statement; }).join('\n'), contact: {name: profile.name, email: profile.email}, job: job, assessment: job.assessment,
      answeredQuestions: previous ? previous.answers || {} : {}});
    if (refinementAllowed_(refined.coverLetter, facts, job, profile)) { raw = refined; usedAi = true; }
    else aiWarning = 'AI letter failed the factual guard. The locally grounded packet was retained.';
    } catch (e) { aiWarning = 'AI was unavailable. The local factual packet was retained. ' + cleanText_(e.message, 200); }
  }
  var application = {id: previous ? previous.id : Utilities.getUuid(), jobId: job.id, company: job.company, title: job.title,
    jobUrl: job.url, status: 'draft', recipient: previous ? previous.recipient : '', recipientConfirmed: false,
    subject: cleanText_(raw.subject || ('Application: ' + job.title), 200), coverLetter: cleanText_(raw.coverLetter, 18000),
    screeningQuestions: list_(raw.screeningQuestions, 12), answers: previous ? previous.answers || {} : {},
    preparation: prefs.features.preparation ? sanitizePreparation_(raw.interviewPlan) : [], interviewQuestions: prefs.features.preparation ? list_(raw.interviewQuestions, 20) : [],
    resumeSuggestions: list_(raw.resumeSuggestions, 15), cvFileId: profile.cvFileId || '', originalCvFileId: profile.cvFileId || '',
    createdAt: previous ? previous.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString(),
    requirementMap: assessment.requirementMap || [], relevantFactIds: assessment.evidence.map(function (e) { return e.factId; }).filter(Boolean),
    factSnapshot: facts.map(function (f) { return {id: f.id, type: f.type, statement: f.statement, approved: true}; }),
    draftingMode: usedAi ? 'AI refinement — review required' : 'Local factual draft', aiWarning: aiWarning,
    outreach: previous ? previous.outreach || [] : [], notes: previous ? previous.notes || '' : ''};
  if (!application.coverLetter) throw new Error('AI returned no cover letter. No packet was saved.');
  put_('applications', application);
  activity_('application', 'Prepared ' + job.title + ' at ' + job.company + '. Awaiting your review.');
  return application;
}
function saveApplication_(input) {
  return locked_(function () {
    var application = find_('applications', input.id);
    if (!application) throw new Error('Application not found.');
    if (application.delivery && application.delivery.phase !== 'sent') throw new Error('Delivery needs resolution before editing this packet. Check your Sent mailbox.');
    if (['draft', 'ready', 'handoff'].indexOf(application.status) >= 0) {
      application.subject = cleanText_(input.subject, 200).replace(/[\r\n]/g, ' ');
      application.coverLetter = cleanText_(input.coverLetter, 18000);
      application.recipient = cleanText_(input.recipient, 200);
      if (application.recipient && !validEmail_(application.recipient)) throw new Error('Enter a valid recipient email.');
      application.recipientConfirmed = input.recipientConfirmed === true;
      if (input.attachmentChoice != null) {
        application.originalCvFileId = application.originalCvFileId || application.cvFileId || '';
        if (input.attachmentChoice === 'none') { application.cvFileId = ''; application.attachedDocumentId = ''; }
        else if (input.attachmentChoice === 'original') { application.cvFileId = application.originalCvFileId; application.attachedDocumentId = ''; }
        else {
          var document = find_('documents', input.attachmentChoice);
          if (!document || document.applicationId !== application.id || document.type !== 'cv' || !document.fileId || ['pdf', 'docx'].indexOf(document.format) < 0) {
            throw new Error('Choose a CV export belonging to this application.');
          }
          application.cvFileId = document.fileId; application.attachedDocumentId = document.id;
        }
      }
      var answers = Object.create(null);
      application.screeningQuestions.forEach(function (question) {
        answers[question] = Object.prototype.hasOwnProperty.call(input.answers || {}, question) ? cleanText_(input.answers[question], 1200) : '';
      });
      application.answers = answers;
      application.status = application.screeningQuestions.every(function (q) { return !!answers[q]; }) ? 'ready' : 'draft';
    }
    application.notes = cleanText_(input.notes, 3000);
    application.updatedAt = new Date().toISOString();
    return putUnlocked_('applications', application);
  });
}
function assertApproved_(input) {
  if (input.approved !== true) throw new Error('Your explicit approval is required before this message can be sent.');
}
function assertOutgoingRecipient_(recipient) {
  if (!isHost_() && !sharedConfig_().externalEmail) throw new Error('The host has not enabled external email.');
  if (!getSettings_().externalSendingEnabled && String(recipient).toLowerCase() !== userEmail_().toLowerCase()) {
    throw new Error('External email is disabled. Test to your own account, confirm receipt in Preferences, then enable external sending.');
  }
}
function assertPacketReady_(application) {
  if (!application) throw new Error('Application not found.');
  if (application.screeningQuestions.some(function (q) {
    return !Object.prototype.hasOwnProperty.call(application.answers || {}, q) || !cleanText_(application.answers[q]);
  })) {
    throw new Error('Answer all screening questions before sending or recording a submission.');
  }
  safeMessage_(application.subject, application.coverLetter);
}
function trackingTag_(application) { return tenantId_() === 'owner' ? 'JH-' + application.id.replace(/-/g, '').slice(0, 12) : 'JH-' + authHash_(tenantId_() + '|' + application.id).slice(0, 24); }
function updateDeliveryPhase_(id, kind, draftId, phase) {
  return locked_(function () {
    var latest = find_('applications', id);
    var target = kind === 'application' ? latest.delivery : kind === 'followup' ? latest.followUpDelivery :
      (latest.outreach || []).find(function (d) { return d.id === draftId; });
    if (!target) throw new Error('Delivery record is missing. Check Sent mail.');
    if ((kind === 'outreach' ? target.status : target.phase) === 'sent' && phase === 'uncertain') return latest;
    if (kind === 'outreach') { target.status = phase; if (phase === 'sent') target.sentAt = new Date().toISOString(); }
    else target.phase = phase;
    if (phase === 'sent' && kind === 'application') { latest.status = 'sent_email'; latest.submittedAt = new Date().toISOString(); }
    if (phase === 'sent' && kind === 'followup') latest.lastFollowUpAt = new Date().toISOString();
    return putUnlocked_('applications', latest);
  });
}
function sendApplication_(input) {
  assertApproved_(input);
  var original = find_('applications', input.id);
  assertPacketReady_(original);
  verifyOpen_(original.jobId);
  var message = safeMessage_(original.subject, original.coverLetter);
  var application = locked_(function () {
    var latest = find_('applications', input.id);
    assertPacketReady_(latest);
    if (['draft', 'ready', 'handoff'].indexOf(latest.status) < 0 || latest.delivery) throw new Error('This application was already sent or delivery needs checking.');
    if (!validEmail_(latest.recipient) || !latest.recipientConfirmed) {
      throw new Error('Supply a recruiter/application email you verified on an official source and confirm it. The agent does not guess addresses.');
    }
    assertOutgoingRecipient_(latest.recipient);
    if (latest.subject !== original.subject || latest.coverLetter !== original.coverLetter || latest.recipient !== original.recipient ||
        latest.cvFileId !== original.cvFileId || JSON.stringify(latest.answers) !== JSON.stringify(original.answers)) {
      throw new Error('The packet changed during approval. Review it again.');
    }
    latest.delivery = {phase: 'sending', at: new Date().toISOString(), approvedBy: tenantId_()};
    return putUnlocked_('applications', latest);
  });
  var body = message.body + '\n\n';
  application.screeningQuestions.forEach(function (q) { body += q + '\n' + application.answers[q] + '\n\n'; });
  body += 'Reference: ' + trackingTag_(application);
  try {
    var mail = {to: application.recipient, name: 'Career Radar - Applications', subject: message.subject + ' [' + trackingTag_(application) + ']', body: body};
    if (application.cvFileId) mail.attachments = [privateDriveFile_(application.cvFileId).getBlob()];
    sharedMail_(mail);
    application = updateDeliveryPhase_(application.id, 'application', '', 'sent');
    createFollowUpReminder_(application);
    activity_('sent', 'Approved email application sent to ' + application.recipient + ' for ' + application.company + '.');
    return {sent: true, status: 'sent_email', note: 'Email accepted for sending by Google; employer receipt and form submission are not confirmed.'};
  } catch (e) {
    updateDeliveryPhase_(application.id, 'application', '', 'uncertain');
    throw new Error('Check the Pipeline and Sent mailbox before retrying. ' + cleanText_(e.message, 300));
  }
}
function markApplication_(input) {
  assertApproved_(input);
  var allowed = ['submitted_external', 'acknowledged', 'screening', 'interview', 'assessment', 'offer', 'accepted', 'rejected', 'withdrawn', 'replied'];
  if (allowed.indexOf(input.status) < 0) throw new Error('Invalid application status.');
  var app = find_('applications', input.id);
  if (!app) throw new Error('Application not found.');
  var proof = cleanText_(input.proof, 2000);
  if (!proof) throw new Error('Add your confirmation or notes so the dashboard has an audit trail.');
  if (input.status === 'submitted_external') { assertPacketReady_(app); verifyOpen_(app.jobId); }
  app = locked_(function () {
    var latest = find_('applications', input.id);
    if (latest.delivery && latest.delivery.phase === 'sending') throw new Error('Email is being sent. Wait for the operation to finish.');
    if (latest.delivery && latest.delivery.phase === 'uncertain') {
      throw new Error('Delivery is uncertain. Check Sent mail and resolve it with resolveDelivery in the script editor first.');
    }
    latest.status = input.status; latest.confirmation = proof; latest.updatedAt = new Date().toISOString();
    latest.history = (latest.history || []).concat([{status: input.status, note: proof, at: latest.updatedAt}]).slice(-40);
    if (input.status === 'submitted_external' && !latest.submittedAt) latest.submittedAt = new Date().toISOString();
    if (input.status === 'replied') latest.repliedAt = new Date().toISOString();
    return putUnlocked_('applications', latest);
  });
  if (['replied', 'acknowledged', 'screening', 'interview', 'assessment', 'offer', 'accepted', 'rejected', 'withdrawn'].indexOf(app.status) >= 0) cancelFollowUps_(app.id);
  else if (app.status === 'submitted_external') createFollowUpReminder_(app);
  activity_('status', app.company + ': ' + app.status + ' (confirmed by you).');
  return app;
}
// For an ambiguous send failure, run manually with the exact id after inspecting Sent mail.
function resolveDelivery(applicationId, confirmedSent) {
  requireOwner_();
  var app = locked_(function () {
    var record = find_('applications', applicationId);
    if (!record || !record.delivery || ['uncertain', 'sending'].indexOf(record.delivery.phase) < 0) throw new Error('No uncertain delivery to resolve.');
    if (record.delivery.phase === 'sending' && Date.now() - Date.parse(record.delivery.at) < 600000) throw new Error('This send may still be running. Wait at least 10 minutes before resolving it.');
    if (typeof confirmedSent !== 'boolean') throw new Error('Pass true only after finding the sent email, otherwise false after confirming it was not sent.');
    if (confirmedSent) {
      record.delivery.phase = 'sent'; record.status = 'sent_email'; record.submittedAt = new Date().toISOString();
    } else { delete record.delivery; record.status = 'ready'; }
    return putUnlocked_('applications', record);
  });
  if (confirmedSent) createFollowUpReminder_(app);
  activity_('delivery', 'Delivery manually resolved for ' + app.company + ': ' + (confirmedSent ? 'sent' : 'not sent') + '.');
}
function createFollowUpReminder_(app) {
  if (!getSettings_().features.reminders) return;
  var date = new Date(app.submittedAt || Date.now()); date.setDate(date.getDate() + getSettings_().followUpDays);
  var existing = find_('reminders', 'followup:' + app.id);
  if (existing) return;
  put_('reminders', {id: 'followup:' + app.id, applicationId: app.id, kind: 'followup',
    title: 'Review follow-up: ' + app.company + ' · ' + app.title, dueAt: date.toISOString(), complete: false});
}
function cancelFollowUps_(applicationId) {
  locked_(function () {
    rows_('reminders').filter(function (r) { return r.applicationId === applicationId && r.kind === 'followup' && !r.complete; })
      .forEach(function (r) { r.complete = true; putUnlocked_('reminders', r); });
  });
}
function resolveMessageDelivery(applicationId, kind, draftId, confirmedSent) {
  requireOwner_();
  if (typeof confirmedSent !== 'boolean' || ['followup', 'outreach'].indexOf(kind) < 0) throw new Error('Specify message type and a boolean after inspecting Sent mail.');
  locked_(function () {
    var app = find_('applications', applicationId);
    if (!app) throw new Error('Application not found.');
    var target = kind === 'followup' ? app.followUpDelivery : (app.outreach || []).find(function (d) { return d.id === draftId; });
    var phase = target && (kind === 'followup' ? target.phase : target.status);
    if (!target || ['uncertain', 'sending'].indexOf(phase) < 0) throw new Error('No uncertain message to resolve.');
    if (phase === 'sending' && Date.now() - Date.parse(target.at || target.createdAt) < 600000) throw new Error('Wait at least 10 minutes before resolving a potentially running send.');
    if (kind === 'followup') {
      if (confirmedSent) target.phase = 'sent'; else delete app.followUpDelivery;
    } else target.status = confirmedSent ? 'sent' : 'draft';
    putUnlocked_('applications', app);
  });
  activity_('delivery', 'Owner resolved ' + kind + ' delivery after checking Sent mail.');
}
function addReminder_(input) {
  var date = new Date(input.dueAt), title = cleanText_(input.title, 200);
  if (!Number.isFinite(date.getTime()) || !title) throw new Error('Supply a reminder title and valid date.');
  if (input.applicationId && !find_('applications', input.applicationId)) throw new Error('Application not found.');
  return put_('reminders', {id: Utilities.getUuid(), applicationId: input.applicationId || '', kind: 'custom',
    title: title, dueAt: date.toISOString(), complete: false});
}
function completeReminder_(id) {
  return locked_(function () {
    var reminder = find_('reminders', id);
    if (!reminder) throw new Error('Reminder not found.');
    reminder.complete = true; return putUnlocked_('reminders', reminder);
  });
}
function prepareOutreach_(input) {
  requireFeature_('outreach');
  var app = find_('applications', input.id), profile = getProfile_();
  if (!app) throw new Error('Application not found.');
  var channel = input.channel === 'linkedin' ? 'linkedin' : 'email';
  var raw = {subject: 'Regarding ' + app.title + ' at ' + app.company,
    body: 'Hello ' + cleanText_(input.contactName || 'there', 100) + ', I’m interested in the ' + app.title + ' opportunity at ' + app.company
      + '. Would you be open to pointing me toward the right application contact? Thank you, ' + (profile.name || '[Your name]')};
  var prefs = getSettings_();
  if (prefs.features.ai && prefs.externalAiConsent) {
  try { raw = geminiJson_('Draft a concise, respectful ' + channel + ' message to a user-supplied professional contact about this job. '
    + 'Return JSON {subject,body}. Use only actual CV facts; do not claim a previous relationship, referral, or unverified experience. '
    + 'For LinkedIn use a short connection note (at most 280 characters). This is a draft only.',
    {cv: approvedFacts_().map(function (f) { return f.statement; }).join('\n'), company: app.company, role: app.title, contactName: cleanText_(input.contactName, 150),
      context: cleanText_(input.context, 1500)}); } catch (e) { /* Local draft remains usable during an AI outage. */ }
  }
  var draft = {id: Utilities.getUuid(), channel: channel, contactName: cleanText_(input.contactName, 150),
    recipient: cleanText_(input.recipient, 200), profileUrl: cleanText_(input.profileUrl, 500),
    affiliationSource: cleanText_(input.affiliationSource, 500), affiliationConfirmed: input.affiliationConfirmed === true,
    subject: cleanText_(raw.subject || ('Regarding ' + app.title), 200), body: cleanText_(raw.body, channel === 'linkedin' ? 280 : 6000),
    status: 'draft', createdAt: new Date().toISOString()};
  app.outreach = (app.outreach || []).concat([draft]).slice(-20); put_('applications', app);
  return draft;
}
function sendOutreach_(input) {
  assertApproved_(input);
  var message = safeMessage_(input.subject, input.body), app;
  app = locked_(function () {
    var record = find_('applications', input.id);
    if (!record) throw new Error('Application not found.');
    var draft = (record.outreach || []).find(function (d) { return d.id === input.draftId; });
    if (!draft || draft.channel !== 'email' || draft.status !== 'draft') throw new Error('Email draft unavailable or already sent.');
    if (!validEmail_(input.recipient) || input.recipientConfirmed !== true) throw new Error('Confirm the recipient email from an official source.');
    assertOutgoingRecipient_(input.recipient);
    if (!draft.affiliationConfirmed || !validWebUrl_(draft.affiliationSource)) throw new Error('Confirm this contact’s current affiliation and save its public evidence URL before outreach.');
    draft.subject = message.subject; draft.body = message.body; draft.recipient = input.recipient; draft.status = 'sending'; draft.approvedBy = tenantId_();
    return putUnlocked_('applications', record);
  });
  var draft = app.outreach.find(function (d) { return d.id === input.draftId; });
  try {
    sharedMail_({to: draft.recipient, name: 'Career Radar - Applications', subject: draft.subject + ' [' + trackingTag_(app) + ']', body: draft.body});
    updateDeliveryPhase_(app.id, 'outreach', draft.id, 'sent');
    activity_('outreach', 'Approved outreach email sent for ' + app.company + '.');
    return {sent: true};
  } catch (e) {
    updateDeliveryPhase_(app.id, 'outreach', draft.id, 'uncertain');
    throw new Error('Outreach delivery needs checking in Sent mail; it will not automatically retry.');
  }
}
function replyMetadata_(app) {
  // Only this actor’s reference is queried; tenants receive strictly matched metadata, never mailbox access.
  if (!app.submittedAt || app.status === 'submitted_external') return [];
  var q = 'in:inbox subject:' + trackingTag_(app) + ' after:' + Math.floor(Date.parse(app.submittedAt) / 1000);
  var root = 'https://gmail.googleapis.com/gmail/v1/users/me/';
  var headers = {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()};
  var response = fetchJson_(root + 'messages?q=' + encodeURIComponent(q) + '&maxResults=5', {headers: headers});
  return (response.messages || []).map(function (m) {
    var meta = fetchJson_(root + 'messages/' + encodeURIComponent(m.id) + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date', {headers: headers});
    var fields = {};
    ((meta.payload || {}).headers || []).forEach(function (h) { fields[h.name.toLowerCase()] = cleanText_(h.value, 500); });
    return {id: m.id, from: fields.from || '', subject: fields.subject || '', date: fields.date || ''};
  }).filter(function (reply) {
    if (isHost_()) return true;
    var tags = reply.subject.match(/\bJH-[a-z0-9]{6,64}\b/gi) || [];
    var from = reply.from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return tags.length === 1 && tags[0].toLowerCase() === trackingTag_(app).toLowerCase() && from &&
      app.recipientConfirmed === true && from[0].toLowerCase() === String(app.recipient).toLowerCase();
  });
}
function syncReplies_() {
  var updated = 0, errors = [], outreachUpdated = 0, outreachChecked = 0;
  rows_('applications').filter(function (a) { return a.status === 'sent_email'; }).slice(0, 30).forEach(function (app) {
    try {
      var replies = replyMetadata_(app);
      if (replies.length) {
        mergeReply_(app.id, replies); cancelFollowUps_(app.id); updated++;
      }
    } catch (e) { errors.push(app.company + ': reply check failed. Verify Gmail read permission.'); }
  });
  rows_('applications').slice(0, 30).forEach(function (app) {
    var replyUpdates = [];
    (app.outreach || []).filter(function (draft) { return draft.channel === 'email' && draft.status === 'sent' && draft.sentAt; }).forEach(function (draft) {
      if (outreachChecked++ >= 6) return;
      try {
        var replies = replyMetadata_(Object.assign({}, app, {status: 'sent_email', submittedAt: draft.sentAt,
          recipient: draft.recipient, recipientConfirmed: true}));
        if (replies.length) replyUpdates.push({id: draft.id, replies: replies});
      } catch (e) { errors.push(app.company + ': outreach reply check failed.'); }
    });
    if (replyUpdates.length) locked_(function () {
      var latest = find_('applications', app.id); if (!latest) return;
      replyUpdates.forEach(function (update) {
        var draft = (latest.outreach || []).find(function (d) { return d.id === update.id; });
        if (draft && draft.status === 'sent') { draft.status = 'replied'; draft.replies = update.replies; draft.repliedAt = new Date().toISOString(); outreachUpdated++; }
      });
      putUnlocked_('applications', latest);
    });
  });
  return {updated: updated, errors: errors, outreachUpdated: outreachUpdated, note: 'Matches inbox metadata by the subject reference. Replies with changed subjects/senders, direct replies to your candidate address and external-form applications need manual status updates.'};
}
function sendFollowUp_(input) {
  assertApproved_(input);
  var app = find_('applications', input.id);
  if (!app || ['sent_email', 'submitted_external'].indexOf(app.status) < 0 || app.followUpDelivery) throw new Error('Follow-up unavailable, already sent, or awaiting delivery confirmation.');
  if (app.status === 'sent_email' && replyMetadata_(app).length) {
    mergeReply_(app.id, []); cancelFollowUps_(app.id);
    throw new Error('An inbox reply was found. No follow-up was sent.');
  }
  if ((app.outreach || []).some(function (draft) { return draft.status === 'replied'; })) throw new Error('A related contact has replied. Review that conversation before sending an application follow-up.');
  if (input.confirmedNoReply !== true) throw new Error('Confirm you checked for replies, including changed email subjects or the employer portal.');
  if (!validEmail_(input.recipient) || input.recipientConfirmed !== true) throw new Error('Confirm a verified recipient email.');
  assertOutgoingRecipient_(input.recipient);
  var message = safeMessage_(input.subject, input.body);
  app = locked_(function () {
    var latest = find_('applications', input.id);
    if ((latest.outreach || []).some(function (draft) { return draft.status === 'replied'; })) throw new Error('A related contact has replied. Review that conversation first.');
    if (['sent_email', 'submitted_external'].indexOf(latest.status) < 0 || latest.followUpDelivery) throw new Error('Follow-up is no longer available.');
    latest.followUpDelivery = {phase: 'sending', at: new Date().toISOString(), approvedBy: tenantId_()};
    return putUnlocked_('applications', latest);
  });
  try {
    sharedMail_({to: input.recipient, name: 'Career Radar - Reminders', subject: message.subject + ' [' + trackingTag_(app) + ']', body: message.body});
    app = updateDeliveryPhase_(app.id, 'followup', '', 'sent');
    cancelFollowUps_(app.id); activity_('followup', 'Approved follow-up sent for ' + app.company + '.');
    return {sent: true};
  } catch (e) {
    updateDeliveryPhase_(app.id, 'followup', '', 'uncertain');
    throw new Error('Check Sent mail. Follow-up will not automatically retry.');
  }
}

function mergeReply_(id, replies) {
  return locked_(function () {
    var latest = find_('applications', id); if (!latest) return;
    if (latest.status === 'sent_email') latest.status = 'replied';
    latest.repliedAt = new Date().toISOString(); if (replies.length) latest.replies = replies;
    return putUnlocked_('applications', latest);
  });
}
// Host-only recovery for a tenant’s uncertain delivery after checking the shared Sent mailbox.
function resolveSharedDelivery(userId, applicationId, kind, draftId, confirmedSent) {
  requireOwner_();
  var user = users_().find(function (u) { return u.id === userId; });
  if (!user) throw new Error('Unknown site account.');
  return withActor_({id: user.id, email: user.email, admin: user.id === 'owner'}, function () {
    if (kind === 'application') resolveDelivery(applicationId, confirmedSent);
    else resolveMessageDelivery(applicationId, kind, draftId, confirmedSent);
    return {resolved: true};
  });
}
