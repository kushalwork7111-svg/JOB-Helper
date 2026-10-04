/* Access only files created by this app, using drive.file rather than full Drive access. */
function privateDriveRequest_(id, suffix, options) {
  var opts = Object.assign({headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true}, options || {});
  var response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + (suffix || ''), opts);
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Private Drive operation failed (HTTP ' + code + '). Check owner authorization and Drive API access.');
  return response;
}
function privateDriveFile_(metadata) {
  if (typeof metadata === 'string') metadata = {id: metadata};
  var id = metadata.id;
  return {
    getId: function () { return id; },
    getUrl: function () { return metadata.webViewLink || 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'; },
    getBlob: function () {
      var details = Drive.Files.get(id, {fields: 'name,mimeType'});
      return privateDriveRequest_(id, '?alt=media').getBlob().setName(details.name).setContentType(details.mimeType);
    },
    setTrashed: function (trashed) { Drive.Files.update({trashed: !!trashed}, id); }
  };
}
function privateCvFolder_() {
  var id = props_().getProperty('CV_FOLDER_ID');
  if (!id) {
    id = locked_(function () {
      var existing = props_().getProperty('CV_FOLDER_ID');
      if (existing) return existing;
      var created = Drive.Files.create({name: 'Job Helper — user files', mimeType: 'application/vnd.google-apps.folder'}).id;
      props_().setProperty('CV_FOLDER_ID', created); return created;
    });
  }
  return {createFile: function (blob) {
    return privateDriveFile_(Drive.Files.create({name: blob.getName(), mimeType: blob.getContentType(), parents: [id]}, blob,
      {fields: 'id,name,mimeType,webViewLink'}));
  }};
}
