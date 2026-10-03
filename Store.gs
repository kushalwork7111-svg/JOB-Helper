function props_() {
  var global = globalProps_(), id = tenantId_();
  function key(name) { return id === 'owner' || ['DATABASE_ID','GEMINI_API_KEY','AI_GATEWAY_URL','AI_GATEWAY_TOKEN'].indexOf(name) >= 0 ? name : 'USER_' + id + '_' + name; }
  return {getProperty: function (name) { return global.getProperty(key(name)); },
    setProperty: function (name, value) { global.setProperty(key(name), value); return this; },
    deleteProperty: function (name) { global.deleteProperty(key(name)); return this; }};
}
function ownerEmail_() {
  var email = Session.getEffectiveUser().getEmail();
  if (!validEmail_(email)) throw new Error('Deploy privately with your own Google account.');
  return email;
}
function requireOwner_() {
  var active = Session.getActiveUser().getEmail();
  if (!active || active.toLowerCase() !== ownerEmail_().toLowerCase()) {
    throw new Error('Owner access required. Deploy the web app with access set to Only myself.');
  }
}
function locked_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Another operation is saving data. Please retry shortly.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function database_() {
  var id = props_().getProperty('DATABASE_ID');
  if (!id) throw new Error('Run setupJobHelper once in the Apps Script editor.');
  return SpreadsheetApp.openById(id);
}
function table_(name) {
  var allowed = ['settings', 'profile', 'facts', 'documents', 'jobs', 'applications', 'reminders', 'activity'];
  if (allowed.indexOf(name) < 0) throw new Error('Invalid data table.');
  return database_().getSheetByName(name);
}
function rows_(name) {
  var sheet = table_(name);
  if (sheet.getLastRow() < 2) return [];
  var records = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().map(function (row) {
    try { return JSON.parse(row[1]); } catch (e) { throw new Error('Unreadable data in ' + name + '. Restore from your spreadsheet backup.'); }
  });
  return records.filter(function (record) { return (record.tenantId || 'owner') === tenantId_(); });
}
function find_(name, id) { return rows_(name).find(function (r) { return r.id === id; }) || null; }
function putUnlocked_(name, record) {
  record = Object.assign({}, record, {tenantId: tenantId_()});
  var storedId = tenantId_() === 'owner' ? record.id : tenantId_() + '|' + record.id;
  var json = JSON.stringify(record);
  if (json.length > 47000) throw new Error('This record is too large. Shorten the CV or job description.');
  var sheet = table_(name), last = sheet.getLastRow(), ids = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 1).getValues();
  var index = ids.findIndex(function (r) { return r[0] === storedId; });
  // JSON begins with a brace and cannot be interpreted as a spreadsheet formula.
  sheet.getRange(index < 0 ? last + 1 : index + 2, 1, 1, 3).setValues([[storedId, json, new Date().toISOString()]]);
  return record;
}
function put_(name, record) { return locked_(function () { return putUnlocked_(name, record); }); }
function activity_(type, message) {
  if (!getSettings_().features.logs) return;
  var record = {id: Utilities.getUuid(), type: type, message: cleanText_(message, 1000), at: new Date().toISOString()};
  put_('activity', record);
}
function getSettings_() { var saved = find_('settings', 'preferences'); return settings_(saved ? saved.value : {}); }
function getProfile_() { return find_('profile', 'cv') || {id: 'cv', cvText: '', name: '', email: userEmail_(), skills: [], experience: [], questions: []}; }
function requireFeature_(name) {
  if (!getSettings_().features[name]) throw new Error('This feature is disabled in owner Preferences.');
}
function setupJobHelper() {
  requireOwner_();
  return locked_(function () {
    if (!props_().getProperty('DATABASE_ID')) {
      var spreadsheet = SpreadsheetApp.create('Job Helper — private agent data');
      ['settings', 'profile', 'facts', 'documents', 'jobs', 'applications', 'reminders', 'activity'].forEach(function (name, i) {
        var sheet = i === 0 ? spreadsheet.getSheets()[0].setName(name) : spreadsheet.insertSheet(name);
        sheet.getRange(1, 1, 1, 3).setValues([['id', 'json', 'updated_at']]);
        sheet.setFrozenRows(1);
      });
      props_().setProperty('DATABASE_ID', spreadsheet.getId());
      putUnlocked_('settings', {id: 'preferences', value: settings_({})});
    }
    ['facts', 'documents'].forEach(function (name) {
      if (!database_().getSheetByName(name)) {
        var sheet = database_().insertSheet(name);
        sheet.getRange(1, 1, 1, 3).setValues([['id', 'json', 'updated_at']]); sheet.setFrozenRows(1);
      }
    });
    if (!props_().getProperty('CV_FOLDER_ID')) {
      props_().setProperty('CV_FOLDER_ID', Drive.Files.create({name: 'Job Helper — private CV files', mimeType: 'application/vnd.google-apps.folder'}).id);
    }
    return {databaseUrl: database_().getUrl(), initialized: true};
  });
}
