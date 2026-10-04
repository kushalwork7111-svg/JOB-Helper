/* Pure matching and validation logic; also exercised by the Node test suite. */
var JH = {
  VERSION: '1.1.0',
  MAX_JOBS_PER_SCAN: 35,
  MAX_SOURCES: 12,
  OPEN_TTL_MS: 24 * 60 * 60 * 1000,
  DEFAULTS: {
    roles: [], locations: [], seniority: [], employmentTypes: [], industries: [], workAuthorization: '',
    includeRemote: true, minimumSalary: 0,
    salaryCurrency: 'INR', requireSalary: false, excludedKeywords: [],
    minimumScore: 55, includeStretch: true, maximumPostingAgeDays: 60,
    dailyEmail: false, digestHour: 8, timezone: 'Asia/Kolkata',
    followUpDays: 7, geminiModel: 'gemini-2.5-flash',
    externalAiConsent: false, externalSendingEnabled: false, features: {discovery: true, ai: false, outreach: true, documents: true,
      reminders: true, preparation: true, analytics: true, logs: true},
    sources: []
  }
};

function cleanText_(value, limit) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, limit || 12000);
}
function list_(value, limit) {
  if (!Array.isArray(value)) return [];
  return value.map(function (x) { return cleanText_(x, 150); }).filter(Boolean).slice(0, limit || 30);
}
function normalize_(value) { return cleanText_(value).toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim(); }
function htmlEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
  });
}
function stripHtml_(value) {
  return cleanText_(String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, ' '), 26000);
}
function validEmail_(value) { return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || '')); }
function validWebUrl_(value) { return /^https:\/\/[a-z0-9.-]+(?::443)?(?:[/?#][^\s<>]*)?$/i.test(String(value || '')); }
function clamp_(value, min, max, fallback) {
  var number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function sanitizeSource_(source) {
  if (!source || ['greenhouse', 'lever', 'ashby'].indexOf(source.type) < 0 ||
      !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(source.board || '')) {
    throw new Error('Use a Greenhouse, Lever, or Ashby board with a valid company slug.');
  }
  return {type: source.type, board: source.board, company: cleanText_(source.company || source.board, 120)};
}
function settings_(input) {
  input = input || {};
  var result = Object.assign({}, JH.DEFAULTS, input);
  ['roles', 'locations', 'excludedKeywords', 'seniority', 'employmentTypes', 'industries'].forEach(function (key) { result[key] = list_(result[key]); });
  result.workAuthorization = cleanText_(result.workAuthorization, 400);
  var features = {};
  Object.keys(JH.DEFAULTS.features).forEach(function (key) {
    features[key] = input.features && typeof input.features[key] === 'boolean' ? input.features[key] : JH.DEFAULTS.features[key];
  });
  result.features = features;
  result.sources = (result.sources || []).slice(0, JH.MAX_SOURCES).map(sanitizeSource_);
  result.sources = result.sources.filter(function (s, i, all) {
    return all.findIndex(function (x) { return sourceKey_(x) === sourceKey_(s); }) === i;
  });
  result.minimumSalary = clamp_(result.minimumSalary, 0, 1000000000, 0);
  result.minimumScore = clamp_(result.minimumScore, 0, 100, 55);
  result.maximumPostingAgeDays = clamp_(result.maximumPostingAgeDays, 1, 365, 60);
  result.digestHour = Math.floor(clamp_(result.digestHour, 0, 23, 8));
  result.followUpDays = Math.floor(clamp_(result.followUpDays, 1, 60, 7));
  result.salaryCurrency = cleanText_(result.salaryCurrency, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(result.salaryCurrency)) throw new Error('Use a three-letter salary currency, such as INR or USD.');
  result.timezone = cleanText_(result.timezone, 80);
  try { new Intl.DateTimeFormat('en', {timeZone: result.timezone}).format(new Date()); }
  catch (e) { throw new Error('Use a valid timezone, such as Asia/Kolkata.'); }
  result.geminiModel = cleanText_(result.geminiModel, 100);
  if (!/^gemini-[a-z0-9.-]+$/.test(result.geminiModel)) throw new Error('Invalid Gemini model name.');
  ['includeRemote', 'requireSalary', 'includeStretch', 'dailyEmail', 'externalAiConsent', 'externalSendingEnabled'].forEach(function (key) {
    result[key] = result[key] === true;
  });
  // Unknown fields (including API keys) never enter saved preferences.
  var safe = {};
  Object.keys(JH.DEFAULTS).forEach(function (key) { safe[key] = result[key]; });
  return safe;
}
function sourceKey_(source) { return source.type + ':' + source.board.toLowerCase(); }
function annualSalary_(salary) {
  if (!salary || !Number.isFinite(Number(salary.max)) || Number(salary.max) <= 0) return null;
  if (salary.min != null && (!Number.isFinite(Number(salary.min)) || Number(salary.min) < 0 || Number(salary.min) > Number(salary.max))) return null;
  var factors = {year: 1, yearly: 1, annual: 1, annually: 1, month: 12, monthly: 12,
    week: 52, weekly: 52, day: 260, daily: 260, hour: 2080, hourly: 2080};
  var factor = factors[String(salary.interval || '').toLowerCase()];
  if (!factor) return null;
  return {min: Number(salary.min || 0) * factor, max: Number(salary.max) * factor,
    currency: String(salary.currency || '').toUpperCase(), estimated: factor !== 1};
}
function jobGates_(job, prefs, now) {
  var reject = [], warnings = [];
  var haystack = normalize_([job.title, job.company, job.description].join(' '));
  if (job.openState !== 'open') reject.push('No current evidence that this posting is open.');
  if (job.closingAt && Date.parse(job.closingAt) < now) reject.push('The recorded application closing date has passed.');
  var verifiedTime = Date.parse(job.verifiedAt || '');
  if (!Number.isFinite(verifiedTime) || now - verifiedTime > JH.OPEN_TTL_MS || verifiedTime > now + 300000) reject.push('Open status needs rechecking.');
  prefs.excludedKeywords.forEach(function (word) {
    if (haystack.indexOf(normalize_(word)) >= 0) reject.push('Excluded keyword: ' + word);
  });
  var location = normalize_(job.location);
  if (prefs.locations.length) {
    var matchedLocation = prefs.locations.some(function (place) { return location.indexOf(normalize_(place)) >= 0; });
    if (!matchedLocation) {
      if (job.remote && prefs.includeRemote) warnings.push('Remote eligibility and country restrictions need your review.');
      else reject.push('Location does not match your preferences.');
    }
  }
  if (job.remote && !prefs.includeRemote && !prefs.locations.length) reject.push('Remote roles are excluded.');
  var annual = annualSalary_(job.salary);
  if (prefs.minimumSalary > 0 || prefs.requireSalary) {
    if (!annual || annual.currency !== prefs.salaryCurrency) {
      if (prefs.requireSalary) reject.push('Salary cannot be verified in your chosen currency.');
      else warnings.push('Salary threshold is unverified; confirm pay before applying.');
    } else {
      if (annual.max < prefs.minimumSalary) reject.push('Published salary range is below your minimum.');
      else if (annual.min < prefs.minimumSalary) warnings.push('Only part of the salary range meets your minimum.');
      if (annual.estimated) warnings.push('Annual pay assumes standard working hours/days; confirm the contract.');
    }
  }
  if (job.postedAt) {
    var posted = Date.parse(job.postedAt);
    if (Number.isFinite(posted) && now - posted > prefs.maximumPostingAgeDays * 86400000) reject.push('Posting exceeds your age limit.');
  } else warnings.push('Original posting date is unavailable.');
  return {rejected: reject.length > 0, reasons: reject, warnings: warnings};
}
function fallbackAssessment_(job, profile, prefs) {
  var title = normalize_(job.title), text = normalize_(job.description), matched = [];
  var roleMatch = prefs.roles.some(function (role) { return title.indexOf(normalize_(role)) >= 0; });
  (profile.skills || []).forEach(function (skill) {
    if (text.indexOf(normalize_(skill)) >= 0) matched.push(skill);
  });
  return {score: Math.min(65, (roleMatch ? 35 : 10) + Math.min(30, matched.length * 5)),
    fit: 'unassessed', confidence: 'low', matchedSkills: matched, gaps: [],
    summary: 'Keyword screening only. Add a Gemini API key for evidence-based matching.',
    evidence: [], questions: ['Review role requirements, experience, work authorization, and salary.'],
    preparation: [], assessedBy: 'keywords'};
}
function quoteExists_(quote, document) {
  var normalized = normalize_(quote);
  return normalized.length >= 5 && normalize_(document).indexOf(normalized) >= 0;
}
function sanitizeAssessment_(raw, job, profile) {
  raw = raw || {};
  var evidence = (Array.isArray(raw.evidence) ? raw.evidence : []).slice(0, 12).map(function (item) {
    var cvQuote = cleanText_(item.cvQuote, 450), jobQuote = cleanText_(item.jobQuote, 450);
    return {cvQuote: cvQuote, jobQuote: jobQuote, explanation: cleanText_(item.explanation, 800),
      verified: quoteExists_(cvQuote, profile.cvText || '') && quoteExists_(jobQuote, job.description || '')};
  });
  var verified = evidence.filter(function (x) { return x.verified; }).length;
  var fit = ['strong', 'stretch', 'weak'].indexOf(raw.fit) >= 0 ? raw.fit : 'unassessed';
  var score = Math.round(clamp_(raw.score, 0, 100, 0));
  if (!verified) { score = Math.min(score, 45); fit = 'unassessed'; }
  var confidence = ['high', 'medium', 'low'].indexOf(raw.confidence) >= 0 ? raw.confidence : 'low';
  if (verified !== evidence.length || !verified) confidence = 'low';
  return {score: score, fit: fit, confidence: confidence,
    matchedSkills: list_(raw.matchedSkills), gaps: list_(raw.gaps), evidence: evidence,
    summary: cleanText_(raw.summary, 2000), questions: list_(raw.questions),
    preparation: sanitizePreparation_(raw.preparation), assessedBy: 'gemini'};
}
function sanitizePreparation_(items) {
  return (Array.isArray(items) ? items : []).slice(0, 10).map(function (p) {
    return {topic: cleanText_(p.topic, 200), action: cleanText_(p.action, 2000),
      practice: cleanText_(p.practice, 2000), materials: (Array.isArray(p.materials) ? p.materials : [])
        .filter(function (m) { return validWebUrl_(m.url); }).slice(0, 5)
        .map(function (m) { return {title: cleanText_(m.title, 200), url: m.url, verified: false}; })};
  });
}
function shortlist_(jobs, prefs, now) {
  return jobs.filter(function (job) {
    var gates = jobGates_(job, prefs, now);
    return !gates.rejected && job.assessment && job.assessment.score >= prefs.minimumScore &&
      job.decision !== 'dismissed' && job.decision !== 'watchlist' &&
      (prefs.includeStretch || job.assessment.fit !== 'stretch') && job.assessment.fit !== 'weak';
  }).sort(function (a, b) { return b.assessment.score - a.assessment.score; });
}
function parseModelJson_(text) {
  var stripped = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(stripped); } catch (e) { throw new Error('Gemini returned invalid structured data. Please retry.'); }
}
function safeMessage_(subject, body) {
  subject = cleanText_(subject, 200).replace(/[\r\n]/g, ' ');
  body = cleanText_(body, 18000);
  if (!subject || !body) throw new Error('A subject and message are required.');
  if (/\[(?:your|insert|name|company|role|recipient|placeholder|missing)[^\]]*\]/i.test(subject + ' ' + body)) {
    throw new Error('Replace the draft placeholders before sending.');
  }
  return {subject: subject, body: body};
}
