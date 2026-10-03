function cvSections_(application, profile) {
  var facts = application.factSnapshot || [];
  if (!facts.length) throw new Error('No approved fact snapshot is attached to this packet. Regenerate it from approved candidate facts.');
  var relevant = application.relevantFactIds || [];
  var ordered = facts.slice().sort(function (a, b) { return (relevant.indexOf(b.id) >= 0 ? 1 : 0) - (relevant.indexOf(a.id) >= 0 ? 1 : 0); });
  var sections = [{heading: 'Relevant skills and projects', lines: ordered.filter(function (f) { return ['skill', 'project'].indexOf(f.type) >= 0; }).map(function (f) { return f.statement; })},
    {heading: 'Employment and experience', lines: facts.filter(function (f) { return ['employment', 'experience'].indexOf(f.type) >= 0; }).map(function (f) { return f.statement; })},
    {heading: 'Qualifications', lines: facts.filter(function (f) { return f.type === 'qualification'; }).map(function (f) { return f.statement; })},
    {heading: 'Achievements', lines: facts.filter(function (f) { return f.type === 'achievement'; }).map(function (f) { return f.statement; })}];
  return sections.filter(function (s) { return s.lines.length; });
}
function exportDocument_(input) {
  requireFeature_('documents');
  var app = find_('applications', input.id), profile = getProfile_();
  if (!app || ['cv', 'letter'].indexOf(input.documentType) < 0 || ['pdf', 'docx'].indexOf(input.format) < 0) throw new Error('Select an application, CV/letter, and PDF/DOCX format.');
  if (!profile.name || !validEmail_(profile.email)) throw new Error('Save your name and contact email in your profile before exporting.');
  var title = cleanText_(profile.name + ' — ' + app.company + ' — ' + (input.documentType === 'cv' ? 'CV' : 'Cover letter'), 200);
  var paragraphs = documentSpec_(app, profile, input.documentType);
  var generatedDocx = Utilities.zip(docxParts_(paragraphs).map(function (part) {
    return Utilities.newBlob(part.content, 'application/xml', part.path);
  }), title + '.docx').setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  var doc = Drive.Files.create({name: title, mimeType: 'application/vnd.google-apps.document',
    parents: [props_().getProperty('CV_FOLDER_ID')]}, generatedDocx, {fields: 'id,webViewLink'});
  var file = privateDriveFile_(doc);
  var mime = input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var blob;
  if (input.format === 'docx') {
    blob = generatedDocx;
  } else {
  var response = privateDriveRequest_(doc.id, '/export?mimeType=' + encodeURIComponent(mime));
  blob = response.getBlob().setName(title + '.' + input.format);
  }
  var bytes = blob.getBytes();
  if (bytes.length < 100 || (input.format === 'pdf' ? String.fromCharCode.apply(null, bytes.slice(0, 4)) !== '%PDF' : bytes[0] !== 80 || bytes[1] !== 75)) {
    throw new Error('Google returned an invalid document file. No export was saved.');
  }
  var exported = privateCvFolder_().createFile(blob);
  var record = {id: Utilities.getUuid(), applicationId: app.id, type: input.documentType, format: input.format,
    name: title, fileId: exported.getId(), googleDocId: doc.id, sourceFactIds: (app.factSnapshot || []).map(function (f) { return f.id; }),
    url: exported.getUrl(), editUrl: file.getUrl(), createdAt: new Date().toISOString()};
  put_('documents', record); activity_('export', 'Created private ' + input.format.toUpperCase() + ' ' + input.documentType + ' for ' + app.company + '.');
  return record;
}

function downloadDocument_(input) {
  var record = find_('documents', input.id);
  if (!record || !record.fileId) throw new Error('Document not found in your records.');
  var blob = privateDriveFile_(record.fileId).getBlob();
  if (blob.getBytes().length > 5 * 1024 * 1024) throw new Error('This download exceeds 5 MB. Ask the host for a private file transfer.');
  return {name: blob.getName(), mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes())};
}
