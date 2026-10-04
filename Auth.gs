/* Shared login is invitation-only. Tokens and OTPs are stored as HMAC digests, never plaintext. */
var JH_ACTOR_ = null;
function globalProps_() { return PropertiesService.getScriptProperties(); }
function sharedEnabled_() { return globalProps_().getProperty('SHARED_ACCESS_ENABLED') === 'true'; }
function actor_() { return JH_ACTOR_ || {id: 'owner', email: ownerEmail_(), admin: true}; }
function tenantId_() { return actor_().id; }
function userEmail_() { return actor_().email; }
function isHost_() { return actor_().admin === true; }
function authHash_(value) {
  var secret = globalProps_().getProperty('LOGIN_HMAC_KEY');
  if (!secret) {
    secret = locked_(function () {
      var existing = globalProps_().getProperty('LOGIN_HMAC_KEY');
      if (existing) return existing;
      var generated = Utilities.getUuid() + Utilities.getUuid(); globalProps_().setProperty('LOGIN_HMAC_KEY', generated); return generated;
    });
  }
  return Utilities.computeHmacSha256Signature(String(value), secret).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function equalHash_(left, right) {
  var mismatch = left.length ^ right.length;
  for (var i = 0; i < Math.max(left.length, right.length); i++) mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return mismatch === 0;
}
function users_() { return JSON.parse(globalProps_().getProperty('SHARED_USERS') || '[]'); }
function saveUsers_(users) { globalProps_().setProperty('SHARED_USERS', JSON.stringify(users)); }
function requireHost_() { if (!isHost_()) throw new Error('Host access required.'); }
function requireCaller_(payload) {
  var token = payload && payload.sessionToken;
  if (token) {
    if (!sharedEnabled_() || !/^[a-f0-9-]{72}$/i.test(token)) throw new Error('Sign in again.');
    var session = JSON.parse(globalProps_().getProperty('LOGIN_SESSION_' + authHash_(token)) || 'null');
    var user = session && users_().find(function (u) { return u.id === session.userId && u.enabled; });
    if (!user || session.expiresAt <= Date.now() || session.userVersion !== (user.version || 1)) throw new Error('Sign in again.');
    return {id: user.id, email: user.email, admin: user.id === 'owner'};
  }
  requireOwner_();
  return {id: 'owner', email: ownerEmail_(), admin: true};
}
function withActor_(user, fn) {
  var previous = JH_ACTOR_; JH_ACTOR_ = user;
  try { return fn(); } finally { JH_ACTOR_ = previous; }
}
function sharedConfig_() { return JSON.parse(globalProps_().getProperty('SHARED_CONFIG') || '{"externalEmail":false,"ai":false,"mailLimit":10}'); }
function authInfo_() { return {shared: sharedEnabled_()}; }
function requestLoginCode_(input) {
  if (!sharedEnabled_()) throw new Error('Shared sign-in is not enabled.');
  var email = cleanText_(input.email, 200).toLowerCase();
  var neutral = {requested: true, note: 'If this address has access, a sign-in code will arrive. Check your inbox and spam folder.'};
  if (!validEmail_(email)) return neutral;
  var user = users_().find(function (u) { return u.enabled && u.email === email; });
  if (!user) return neutral;
  var key = 'LOGIN_CODE_' + authHash_(email), code, allowed;
  allowed = locked_(function () {
    var now = Date.now(), record = JSON.parse(globalProps_().getProperty(key) || 'null');
    var hourly = 'LOGIN_MAIL_' + Math.floor(now / 3600000), total = Number(globalProps_().getProperty(hourly) || 0);
    var daily = 'LOGIN_DAY_' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'), dayCount = Number(globalProps_().getProperty(daily) || 0);
    if (record && (now - record.sentAt < 60000 || record.blockedUntil > now)) return false;
    var count = record && now - record.windowAt < 3600000 ? record.sentCount : 0;
    if (count >= 5 || total >= 30 || dayCount >= 40 || MailApp.getRemainingDailyQuota() < 5) return false;
    code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(-8), 16) % 1000000).padStart(6, '0');
    globalProps_().setProperty(key, JSON.stringify({hash: authHash_(email + '|' + code), sentAt: now, expiresAt: now + 600000,
      attempts: 0, sentCount: count + 1, windowAt: count ? record.windowAt : now, blockedUntil: 0}));
    globalProps_().setProperty(hourly, String(total + 1)); globalProps_().setProperty(daily, String(dayCount + 1)); return true;
  });
  if (allowed) {
    try { MailApp.sendEmail({to: email, name: 'Job Helper sign-in', subject: 'Your Job Helper sign-in code', body: 'Your code is ' + code + '. It expires in 10 minutes. Never share it with anyone. If you did not request this, ignore this email.'}); }
    catch (e) { /* Do not leak account existence or delivery state to an unauthenticated caller. */ }
  }
  return neutral;
}
function verifyLoginCode_(input) {
  if (!sharedEnabled_()) throw new Error('Shared sign-in is not enabled.');
  var email = cleanText_(input.email, 200).toLowerCase(), code = String(input.code || '');
  return locked_(function () {
    var key = 'LOGIN_CODE_' + authHash_(email), record = JSON.parse(globalProps_().getProperty(key) || 'null');
    var user = users_().find(function (u) { return u.enabled && u.email === email; });
    if (!user || !record || record.expiresAt <= Date.now() || record.attempts >= 5 || !/^\d{6}$/.test(code)) throw new Error('Code invalid or expired. Request a new code.');
    record.attempts++;
    if (!equalHash_(record.hash, authHash_(email + '|' + code))) {
      if (record.attempts >= 5) record.blockedUntil = Date.now() + 3600000;
      globalProps_().setProperty(key, JSON.stringify(record)); throw new Error('Code invalid or expired. Request a new code.');
    }
    record.expiresAt = 0; globalProps_().setProperty(key, JSON.stringify(record));
    var token = Utilities.getUuid() + Utilities.getUuid(), expiresAt = Date.now() + 8 * 3600000;
    pruneLoginState_();
    globalProps_().setProperty('LOGIN_SESSION_' + authHash_(token), JSON.stringify({userId: user.id, userVersion: user.version || 1, expiresAt: expiresAt}));
    return {sessionToken: token, expiresAt: expiresAt};
  });
}
function pruneLoginState_() {
  var all = globalProps_().getProperties(), now = Date.now();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf('LOGIN_SESSION_') === 0) {
      try { if (JSON.parse(all[key]).expiresAt <= now) globalProps_().deleteProperty(key); } catch (e) { globalProps_().deleteProperty(key); }
    }
    if (key.indexOf('LOGIN_MAIL_') === 0 && Number(key.slice(11)) < Math.floor(now / 3600000) - 24) globalProps_().deleteProperty(key);
  });
  if (Object.keys(globalProps_().getProperties()).filter(function (key) { return key.indexOf('LOGIN_SESSION_') === 0; }).length >= 200) throw new Error('Too many active sessions. Try later.');
}
function logout_(input) { if (input.sessionToken) globalProps_().deleteProperty('LOGIN_SESSION_' + authHash_(input.sessionToken)); return {loggedOut: true}; }
function manageUsers_(input) {
  requireHost_();
  authHash_('initialize');
  if (input.operation === 'list') return {users: users_().map(function (u) { return {id: u.id, email: u.email, enabled: u.enabled}; }), enabled: sharedEnabled_(), config: sharedConfig_()};
  var result = locked_(function () {
    var users = users_();
    if (!users.some(function (u) { return u.id === 'owner'; })) users.unshift({id: 'owner', email: ownerEmail_().toLowerCase(), enabled: true, version: 1});
    if (input.operation === 'invite') {
      var email = cleanText_(input.email, 200).toLowerCase();
      if (!validEmail_(email)) throw new Error('Enter the user’s sign-in email.');
      var existing = users.find(function (u) { return u.email === email; });
      if (existing) { existing.enabled = true; existing.version = (existing.version || 1) + 1; }
      else { if (users.length >= 25) throw new Error('This pilot supports up to 25 accounts.'); users.push({id: Utilities.getUuid(), email: email, enabled: true, version: 1}); }
    } else if (input.operation === 'disable') {
      var user = users.find(function (u) { return u.id === input.id; });
      if (!user || user.id === 'owner') throw new Error('Choose a non-host account.');
      user.enabled = false; user.version = (user.version || 1) + 1;
    } else if (input.operation === 'configure') {
      if (input.externalEmail && !sharedConfig_().externalEmail && !globalProps_().getProperty('LAST_TEST_EMAIL')) throw new Error('Send and review the host test briefing first.');
      if (input.externalEmail && !sharedConfig_().externalEmail && input.confirmedTestReceipt !== true) throw new Error('Confirm receipt of the host’s test briefing.');
      globalProps_().setProperty('SHARED_ACCESS_ENABLED', input.enabled === true ? 'true' : 'false');
      globalProps_().setProperty('SHARED_CONFIG', JSON.stringify({externalEmail: input.externalEmail === true, ai: input.ai === true,
        mailLimit: Math.min(25, Math.max(1, Number(input.mailLimit) || 10))}));
    } else throw new Error('Unknown account operation.');
    saveUsers_(users);
    return {saved: true};
  });
  ensureSharedTrigger_();
  return result;
}
function sharedMail_(mail) {
  if (sharedEnabled_()) {
    if (!isHost_() && !sharedConfig_().externalEmail) throw new Error('The host has not enabled external email.');
    locked_(function () {
      var key = 'SENT_MAIL_COUNT_' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
      var count = Number(props_().getProperty(key) || 0);
      if (count >= sharedConfig_().mailLimit) throw new Error('Your daily outgoing message limit has been reached.');
      if (MailApp.getRemainingDailyQuota() < 1) throw new Error('The shared Google account has reached its email limit.');
      props_().setProperty(key, String(count + 1));
    });
    mail.name = (getProfile_().name || 'Candidate') + ' via Job Helper';
    mail.replyTo = ownerEmail_();
    mail.body += '\n\nSent by Job Helper for ' + (getProfile_().name || 'the candidate') + ' (' + userEmail_() + '). Replies are handled through the hosting account.';
  }
  return MailApp.sendEmail(mail);
}
function pruneDailyState_() {
  var cutoff = Utilities.formatDate(new Date(Date.now() - 7 * 86400000), 'UTC', 'yyyy-MM-dd');
  Object.keys(globalProps_().getProperties()).forEach(function (key) {
    var match = /^(?:USER_[a-f0-9-]+_)?(?:DIGEST_DELIVERY_|SENT_MAIL_COUNT_|LOGIN_DAY_)(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (match && match[1] < cutoff) globalProps_().deleteProperty(key);
  });
}
