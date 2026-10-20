/* ---------- PIN lock for the public dashboard link ---------- */
// The PIN is never stored as typed: only a salted one-way hash lives in Script Properties.
// Wrong guesses are throttled: 5 misses lock the page for 15 minutes, doubling per lockout up to 24 hours.

const PIN_MAX_TRIES_ = 5, PIN_FIRST_LOCK_MIN_ = 15, PIN_MAX_LOCK_MIN_ = 24 * 60, SESSION_HOURS_ = 6;

function pinHash_(pin, salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function pinValid_(pin) { return /^\d{4,12}$/.test(String(pin || '')); }
function setPin_(pin) {
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({ PIN_SALT: salt, PIN_HASH: pinHash_(pin, salt), PIN_FAILS: '0', PIN_LOCKS: '0', PIN_LOCK_UNTIL: '0' });
}

/** True when the person running this is the script owner signed in to Google (editor, or the private link). */
function isOwnerSignedIn_() {
  const active = Session.getActiveUser().getEmail();
  return !!active && active === Session.getEffectiveUser().getEmail();
}

/** Throws unless the page was unlocked with the PIN in this browser session. */
function auth_(token) {
  if (!token || !CacheService.getScriptCache().get('jf_session_' + token)) throw new Error('NEEDS_PIN');
}

/** First screen of the page: is a PIN set, and is the page locked after wrong guesses? */
function pinStatus() {
  const p = PropertiesService.getScriptProperties().getProperties(), until = Number(p.PIN_LOCK_UNTIL || 0);
  return { hasPin: !!p.PIN_HASH, canCreate: !p.PIN_HASH && isOwnerSignedIn_(), lockedMinutes: until > Date.now() ? Math.ceil((until - Date.now()) / 60000) : 0 };
}

/** Creates the first PIN. Only possible while no PIN exists and the owner is signed in to Google. */
function createPin(pin) {
  if (PropertiesService.getScriptProperties().getProperty('PIN_HASH')) throw new Error('A PIN already exists');
  if (!isOwnerSignedIn_()) throw new Error('Only the owner, signed in to Google, can create the PIN');
  if (!pinValid_(pin)) throw new Error('Use 4 to 12 digits');
  setPin_(pin);
  return unlock(pin);
}

/** Checks the PIN and returns a session token valid for a few hours. */
function unlock(pin) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties(), p = props.getProperties();
    if (!p.PIN_HASH) return { ok: false, message: 'No PIN has been set yet.' };
    const until = Number(p.PIN_LOCK_UNTIL || 0);
    if (until > Date.now()) return { ok: false, message: 'Too many wrong PINs. Try again in ' + Math.ceil((until - Date.now()) / 60000) + ' minutes.' };
    if (pinValid_(pin) && pinHash_(pin, p.PIN_SALT) === p.PIN_HASH) {
      props.setProperties({ PIN_FAILS: '0', PIN_LOCKS: '0' });
      const token = Utilities.getUuid();
      CacheService.getScriptCache().put('jf_session_' + token, '1', SESSION_HOURS_ * 3600);
      return { ok: true, token };
    }
    const fails = Number(p.PIN_FAILS || 0) + 1;
    if (fails < PIN_MAX_TRIES_) { props.setProperty('PIN_FAILS', String(fails)); return { ok: false, message: 'Wrong PIN. ' + (PIN_MAX_TRIES_ - fails) + ' tries left.' }; }
    const locks = Number(p.PIN_LOCKS || 0) + 1, minutes = Math.min(PIN_MAX_LOCK_MIN_, PIN_FIRST_LOCK_MIN_ * Math.pow(2, locks - 1));
    props.setProperties({ PIN_FAILS: '0', PIN_LOCKS: String(locks), PIN_LOCK_UNTIL: String(Date.now() + minutes * 60000) });
    const to = cfg_()['Email To'] || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, 'Job Finder: page locked after wrong PINs',
      'Someone entered a wrong PIN ' + PIN_MAX_TRIES_ + ' times on your Job Finder page, so it is locked for ' + minutes + ' minutes.\n' +
      'If this was not you, change your PIN in Settings once the lock ends.');
    return { ok: false, message: 'Too many wrong PINs. The page is locked for ' + minutes + ' minutes.' };
  } finally { lock.releaseLock(); }
}

/** Changes the PIN from Settings; needs the current PIN as well as an unlocked page. */
function changePin(token, oldPin, newPin) {
  auth_(token);
  const p = PropertiesService.getScriptProperties().getProperties();
  if (!pinValid_(oldPin) || pinHash_(oldPin, p.PIN_SALT) !== p.PIN_HASH) throw new Error('Current PIN is wrong');
  if (!pinValid_(newPin)) throw new Error('Use 4 to 12 digits');
  setPin_(newPin);
  return true;
}
