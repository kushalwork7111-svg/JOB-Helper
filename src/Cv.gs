/* ---------- CV reading: works on any CV layout; nothing about the owner is written into the code ---------- */

const CV_SECTIONS_ = {
  summary: ['summary', 'profile', 'profile summary', 'professional summary', 'career summary', 'executive summary', 'career objective',
    'objective', 'about me', 'about', 'personal statement', 'professional profile', 'experience summary', 'overview', 'career overview',
    'synopsis', 'summary of experience', 'professional overview'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'employment', 'work history',
    'career history', 'career', 'employment details', 'professional background', 'relevant experience', 'internships', 'internship',
    'internship experience', 'career progression', 'work profile', 'organisational experience', 'organizational experience',
    'experience details', 'professional history', 'positions held', 'experience and internships', 'employment record', 'career details'],
  education: ['education', 'academic qualifications', 'academic qualification', 'educational qualifications', 'educational qualification',
    'academics', 'academic background', 'academic details', 'education and training', 'education details', 'academic credentials',
    'educational background', 'academic profile'],
  quals: ['qualifications', 'qualification'],
  skills: ['skills', 'key skills', 'core skills', 'technical skills', 'it skills', 'core competencies', 'competencies', 'areas of expertise',
    'expertise', 'skill set', 'skillset', 'key strengths', 'functional skills', 'personal skills', 'computer skills', 'tools', 'software',
    'technical proficiency', 'skills and interests', 'skills and tools', 'tools and technologies', 'professional skills', 'key competencies',
    'software skills', 'skills and expertise', 'top skills', 'strengths', 'technical skills and tools', 'skills summary', 'domain skills'],
  certifications: ['certifications', 'certification', 'certificates', 'licenses', 'licences', 'professional qualifications',
    'certifications and training', 'courses', 'trainings', 'training', 'professional certifications', 'licenses and certifications',
    'courses and certifications', 'certifications and courses', 'qualifications and certifications'],
  contact: ['contact', 'contact details', 'contact information', 'contact info', 'personal information', 'personal details', 'personal data'],
  other: ['achievements', 'awards', 'awards and achievements', 'honours', 'honors', 'projects', 'key projects', 'languages', 'language',
    'interests', 'hobbies', 'hobbies and interests', 'extra curricular activities', 'extracurricular activities', 'volunteering',
    'volunteer experience', 'publications', 'references', 'declaration', 'positions of responsibility', 'accomplishments',
    'additional information', 'co curricular activities', 'memberships', 'affiliations', 'mother tongue', 'nationality', 'date of birth',
    'marital status', 'other languages']
};
const CV_HEADING_INDEX_ = {};
Object.keys(CV_SECTIONS_).forEach(t => CV_SECTIONS_[t].forEach(h => { CV_HEADING_INDEX_[h] = t; }));

const CV_TITLE_LINES_ = /^(curriculum vitae|resume|résumé|cv|bio[- ]?data|europass curriculum vitae)$/i;
const CV_ROLE_RE_ = /\b(manager|analyst|associate|consultant|director|head|lead|engineer|executive|officer|intern|trainee|assistant|vice president|president|vp|avp|svp|evp|specialist|accountant|auditor|controller|coordinator|developer|designer|administrator|advisor|adviser|supervisor|principal|chief|cfo|ceo|coo|cto|cio|partner|founder|co-founder|owner|representative|architect|scientist|researcher|economist|planner|strategist|team leader|programmer|clerk|teacher|lecturer|professor|fellow|apprentice|secretary|treasurer|banker|underwriter|actuary|recruiter|buyer|merchandiser|operator|technician|nurse|doctor|pharmacist|lawyer|counsel|attorney|editor|writer|journalist)\b/i;
const CV_STRONG_CO_RE_ = /\b(llp|ltd|limited|pvt|inc|llc|corp|corporation|plc|gmbh|pte|pty|company|bank|group|holdings|s\.p\.a|spa|bv|ag)\b|&\s*co\b/i;
const CV_KNOWN_FIRMS_RE_ = /\b(kpmg|deloitte|pwc|pricewaterhousecoopers|ey|ernst & young|grant thornton|bdo|rsm|accenture|mckinsey|bcg|boston consulting group|bain|goldman sachs|morgan stanley|jp ?morgan|j\.p\. morgan|citi|citibank|hsbc|barclays|ubs|nomura|infosys|wipro|tcs|tata consultancy services|cognizant|capgemini|ibm|google|microsoft|amazon|flipkart|alvarez & marsal|fti consulting|kroll|avendus|kotak|icici|hdfc|axis bank|reliance|aditya birla|mahindra|unilever|nestle|procter & gamble|zomato|swiggy|paytm|meta|apple|oracle|sap|ogilvy)\b/i;
const CV_WEAK_CO_RE_ = /\b(services|consulting|consultants|capital|advisors|advisers|partners|solutions|technologies|technology|laboratories|labs|industries|associates|enterprises|ventures|systems|international|global|motors|pharma|pharmaceuticals|securities|investments|insurance|foods|media|networks|software|e-retail|retail|finance)\b/i;
const CV_CITIES_ = ['mumbai', 'navi mumbai', 'thane', 'bombay', 'new delhi', 'delhi', 'delhi ncr', 'ncr', 'gurugram', 'gurgaon', 'noida',
  'bengaluru', 'bangalore', 'hyderabad', 'secunderabad', 'chennai', 'madras', 'kolkata', 'calcutta', 'pune', 'ahmedabad', 'kochi', 'cochin',
  'jaipur', 'chandigarh', 'indore', 'lucknow', 'coimbatore', 'thiruvananthapuram', 'trivandrum', 'nagpur', 'vadodara', 'baroda', 'surat',
  'goa', 'bhubaneswar', 'visakhapatnam', 'vizag', 'mysuru', 'mysore', 'kozhikode', 'mangaluru', 'mangalore', 'bhopal', 'patna', 'ranchi',
  'guwahati', 'dehradun', 'ludhiana', 'nashik', 'aurangabad', 'raipur', 'vijayawada', 'madurai', 'thrissur',
  'london', 'manchester', 'birmingham', 'edinburgh', 'new york', 'san francisco', 'chicago', 'boston', 'seattle', 'los angeles', 'austin',
  'toronto', 'vancouver', 'singapore', 'dubai', 'abu dhabi', 'doha', 'riyadh', 'hong kong', 'sydney', 'melbourne', 'paris', 'frankfurt',
  'berlin', 'munich', 'milan', 'rome', 'madrid', 'amsterdam', 'zurich', 'geneva', 'dublin', 'tokyo', 'kuala lumpur', 'jakarta'];
const CV_REGIONS_ = ['maharashtra', 'karnataka', 'kerala', 'haryana', 'tamil nadu', 'telangana', 'gujarat', 'west bengal', 'uttar pradesh',
  'rajasthan', 'punjab', 'andhra pradesh', 'madhya pradesh', 'odisha', 'india', 'uk', 'united kingdom', 'england', 'usa', 'us',
  'united states', 'uae', 'italy', 'germany', 'france', 'australia', 'canada', 'ireland', 'netherlands', 'switzerland', 'spain', 'qatar',
  'saudi arabia', 'japan', 'malaysia', 'indonesia', 'remote'];
const CV_TOOLS_ = ['excel', 'ms excel', 'advanced excel', 'powerpoint', 'ms powerpoint', 'word', 'ms word', 'ms office', 'microsoft office',
  'power bi', 'tableau', 'qlik', 'looker', 'sap', 'sap fico', 'sap mm', 'sap sd', 'tally', 'tally erp 9', 'tally prime', 'python', 'sql', 'r',
  'vba', 'alteryx', 'capital iq', 'pitchbook', 'bloomberg', 'factset', 'refinitiv', 'oracle', 'netsuite', 'quickbooks', 'zoho books', 'xero',
  'jira', 'confluence', 'salesforce', 'hubspot', 'google analytics', 'canva', 'idea', 'acl', 'spss', 'stata', 'snowflake', 'figma',
  'meta ads manager', 'google ads', 'semrush', 'workday', 'hyperion', 'anaplan', 'power query', 'power pivot', 'git', 'java', 'javascript',
  'aws', 'azure', 'sharepoint', 'visio', 'ms project', 'ms dynamics', 'dynamics 365', 'caseware', 'teammate'];
const CV_SKILL_WORDS_ = ['due diligence', 'financial due diligence', 'valuation', 'financial modelling', 'financial modeling', 'm&a',
  'mergers and acquisitions', 'quality of earnings', 'working capital', 'budgeting', 'forecasting', 'fp&a', 'variance analysis',
  'statutory audit', 'internal audit', 'risk management', 'ifrs', 'ind as', 'us gaap', 'taxation', 'gst', 'transfer pricing',
  'corporate finance', 'restructuring', 'portfolio monitoring', 'portfolio management', 'private equity', 'market research',
  'business analysis', 'project management', 'stakeholder management', 'data analysis', 'financial analysis', 'cost optimisation',
  'cost optimization', 'process improvement', 'business development', 'credit analysis', 'equity research', 'investment banking',
  'management reporting', 'mis reporting', 'consolidation', 'treasury', 'compliance', 'value creation', 'operational due diligence',
  'commercial due diligence', 'deal advisory', 'transaction advisory', 'supply chain', 'demand planning', 'inventory management',
  'digital marketing', 'seo', 'sem', 'content strategy', 'brand management', 'sales', 'key account management', 'recruitment',
  'payroll', 'accounts payable', 'accounts receivable', 'general ledger', 'financial reporting', 'cash flow', 'portfolio monitoring'];
const CV_SECTORS_ = ['banking', 'financial services', 'insurance', 'private equity', 'venture capital', 'investment banking', 'real estate',
  'infrastructure', 'healthcare', 'pharmaceuticals', 'pharma', 'fmcg', 'consumer', 'retail', 'e-commerce', 'ecommerce', 'manufacturing',
  'automotive', 'technology', 'it services', 'telecom', 'energy', 'power', 'oil and gas', 'logistics', 'media', 'education', 'hospitality',
  'aviation', 'nbfc', 'mutual funds', 'fintech', 'chemicals', 'steel', 'cement', 'textiles', 'agriculture', 'marketplace', 'beauty'];
const CV_DESIGNATIONS_ = [
  ['Chartered Accountant (CA)', s => /chartered accountant|\bicai\b/i.test(s) || /\bCA\b/.test(s)],
  ['CFA', s => /\bCFA\b/.test(s)], ['FRM', s => /\bFRM\b/.test(s)], ['CPA', s => /\bCPA\b/.test(s)], ['ACCA', s => /\bACCA\b/.test(s)],
  ['ACA', s => /\bACA\b/.test(s)], ['CMA', s => /\bCMA\b/.test(s)], ['CIMA', s => /\bCIMA\b/.test(s)],
  ['Company Secretary (CS)', s => /company secretary|\bicsi\b/i.test(s)], ['CISA', s => /\bCISA\b/.test(s)], ['PMP', s => /\bPMP\b/.test(s)],
  ['Six Sigma', s => /six sigma/i.test(s)], ['NISM', s => /\bNISM\b/.test(s)], ['CFP', s => /\bCFP\b/.test(s)]];
const CV_DEGREE_RE_ = /\b(MBA|EMBA|PGDM|PGDBA|PGP|B\.?\s?Com|M\.?\s?Com|BBA|BMS|BBM|BAF|BCA|MCA|B\.?\s?Tech|M\.?\s?Tech|B\.\s?E\.?|BE|M\.\s?E\.?|B\.?\s?Sc|M\.?\s?Sc|BSc|MSc|B\.?A\.?|M\.?A\.?|Ph\.?\s?D|LLB|LLM|HSC|SSC|ICSE|CBSE|GCSE|A[- ]Levels?)(?![\w])|\b(bachelor|master|diploma|doctor of|doctorate|chartered accountant|higher secondary|senior secondary|secondary school|class\s+(?:x|xii|10|12)(?:th)?|post[- ]graduate|undergraduate)\b/i;
const CV_INSTITUTION_RE_ = /\b(university|college|institute|school|academy|polytechnic|iim|iit|nit|icai|icaew|icsi|ima|vidyalaya|vidyapeeth|mica|xlri|isb|nmims|bits)\b/i;
const CV_TABLE_HEADER_WORDS_ = /^(degree|course|institute|institution|university|board|year|year of passing|qualification|percentage|cgpa|grade|marks|organisation|organization|company|employer|designation|role|position|duration|period|from|to|location|tenure)$/i;
const CV_LABELS_ = {
  role: ['occupation or position held', 'position held', 'position', 'designation', 'role', 'title', 'job title', 'current designation'],
  company: ['name of employer', 'employer', 'company', 'organisation', 'organization', 'company name', 'employer name', 'name and address of employer', 'firm'],
  activity: ['main activities and responsibilities', 'responsibilities', 'key responsibilities', 'roles and responsibilities', 'activities',
    'achievements', 'key achievements', 'description', 'job description', 'key deliverables', 'highlights'],
  date: ['dates', 'date', 'duration', 'period', 'tenure', 'from', 'time period'],
  location: ['location', 'place', 'city'],
  degree: ['title of qualification awarded', 'qualification', 'degree', 'course'],
  institution: ['name of organisation providing education', 'name and type of organisation providing education and training', 'institution',
    'institute', 'university', 'college', 'school']
};

const CV_MON_ = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const CV_D_ = "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*['’`\\-]?\\s*,?\\s*(?:\\d{4}|\\d{2})(?!\\d)|\\d{1,2}[\\/.\\-]\\d{4}|(?:19|20)\\d{2})";
const CV_NOW_ = "(?:present|current(?:ly)?|till\\s*(?:date|now)|to\\s*date|now|ongoing|today|running)";
const CV_RANGE_RE_ = new RegExp("(?<![\\w\\/.])(" + CV_D_ + ")\\s*(?:-|–|—|−|to|till|until|~)\\s*(" + CV_D_ + "|" + CV_NOW_ + "|\\d{2}(?!\\d))(?![\\w])", 'i');
const CV_SINCE_RE_ = new RegExp("(?:since|from)\\s+(" + CV_D_ + ")(?![\\w])|(?<![\\w\\/.])(" + CV_D_ + ")\\s*(?:onwards|-\\s*$|–\\s*$)", 'i');

function cvNorm_(s) { return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function cvClean_(s) { return String(s || '').replace(/\(\s*\)|\[\s*\]/g, '').replace(/^[\s|,;:·•–—\-()]+|[\s|,;:·•–—\-(]+$/g, '').replace(/\s{2,}/g, ' ').trim(); }
function cvWords_(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }
function cvUniq_(a) { const seen = {}; return a.filter(x => { const k = String(x).toLowerCase(); if (!x || seen[k]) return false; seen[k] = 1; return true; }); }
/** A full sentence (job bullet) rather than a header; "Pvt Ltd." or "Dr. Reddy's" endings don't count. */
function cvSentence_(s) { return /[;]$/.test(s) || (/\.$/.test(s) && cvWords_(s) > 8); }
function cvTitle_(s) { return String(s).replace(/\b[a-z]/g, ch => ch.toUpperCase()); }

/** Splits raw CV text into lines, marking bullets and joining wrapped lines. */
function cvLines_(text) {
  const out = [];
  String(text || '').replace(/\r/g, '').replace(/ /g, ' ').split('\n').forEach(raw => {
    let s = raw.replace(/\t+/g, ' | ').replace(/ {3,}/g, ' | ').trim();
    if (!s || /^page \d+( of \d+)?$/i.test(s)) return;
    const bm = s.match(/^(?:[•●▪■◦○◆►▶✓✔➢➤❖\-–—*·]|[-]|\d{1,2}[.)](?=\s))\s*/);
    const bullet = !!bm && s.length > bm[0].length && !/^[-–—]\s*$/.test(s);
    if (bullet) s = s.slice(bm[0].length).trim();
    s = s.replace(/\s+[•·●▪]\s+/g, ' | ').replace(/^\|\s*|\s*\|$/g, '').trim();
    if (!s) return;
    const prev = out[out.length - 1];
    if (!bullet && prev && prev.bullet && /^[a-z(]/.test(s)) { prev.text += ' ' + s; return; }
    out.push({ text: s, bullet: bullet });
  });
  return out;
}

function cvHeading_(s) {
  const whole = s.replace(/[\s:|–—\-]+$/, '');
  if (cvWords_(whole) <= 6) { const t = CV_HEADING_INDEX_[cvNorm_(whole)]; if (t) return { type: t }; }
  const m = s.match(/^([A-Za-z][A-Za-z &\/]{1,40}?)\s*[:|]\s*(.+)$/);
  if (m) {
    const t = CV_HEADING_INDEX_[cvNorm_(m[1])];
    if (t === 'skills' || t === 'certifications' || t === 'other') return { type: t, inline: m[2] };
  }
  return null;
}

function cvSections_(lines) {
  const secs = [{ type: 'header', lines: [] }];
  lines.forEach(l => {
    const h = !l.bullet && cvHeading_(l.text);
    if (!h) { secs[secs.length - 1].lines.push(l); return; }
    if (h.inline == null) { secs.push({ type: h.type, lines: [] }); return; }
    if (h.type === 'other') return;
    const cur = secs[secs.length - 1];
    if (cur.type === h.type) cur.lines.push({ text: h.inline, bullet: false });
    else secs.push({ type: h.type, lines: [{ text: h.inline, bullet: false }] });
  });
  const hasEdu = secs.some(s => s.type === 'education');
  secs.forEach(s => { if (s.type === 'quals') s.type = hasEdu ? 'certifications' : 'education'; });
  return secs;
}

function cvLabel_(s) {
  const m = s.match(/^([A-Za-z][A-Za-z ,&\/]{1,60}?)\s*[:|]\s*(.*)$/);
  if (!m) return null;
  const key = cvNorm_(m[1]);
  for (const k in CV_LABELS_) if (CV_LABELS_[k].indexOf(key) >= 0) return { kind: k, value: m[2].trim() };
  return null;
}

function cvIsLocation_(p) {
  const x = String(p).toLowerCase().replace(/[().]/g, '').trim();
  if (!x || cvWords_(x) > 5) return false;
  if (/^(remote|work from home|wfh|hybrid)$/.test(x)) return true;
  if (/^[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*, [A-Z]{2}$/.test(String(p).trim())) return true;
  const parts = x.split(/\s*,\s*/);
  return parts.every(q => CV_CITIES_.indexOf(q) >= 0 || CV_REGIONS_.indexOf(q) >= 0);
}

function cvKind_(p) {
  if (CV_STRONG_CO_RE_.test(p) || CV_KNOWN_FIRMS_RE_.test(p)) return 'company';
  if (cvIsLocation_(p)) return 'location';
  if (CV_ROLE_RE_.test(p)) return 'role';
  if (CV_WEAK_CO_RE_.test(p)) return 'company?';
  return 'unknown';
}

/** Splits a job header line ("Role | Company | City", "Role at Company", "Company — Role") into labelled parts. */
function cvSplit_(s) {
  const seps = [['pipe', /\s*\|\s*/], ['dash', /\s+[—–]\s+/], ['dash', /\s+-\s+/], ['at', /\s+at\s+/i], ['comma', /,\s+/]];
  for (let i = 0; i < seps.length; i++) {
    const parts = s.split(seps[i][1]).map(cvClean_).filter(Boolean);
    if (parts.length < 2) continue;
    const kinds = parts.map(cvKind_), has = k => kinds.indexOf(k) >= 0, type = seps[i][0];
    const ok = type === 'pipe' ||
      (type === 'dash' && (has('company') || has('company?') || has('location'))) ||
      (type === 'at' && kinds[0] === 'role') ||
      (type === 'comma' && (has('location') || (has('company') && has('role'))));
    if (ok) return parts.map((t, j) => ({ text: t, kind: kinds[j] }));
  }
  return [{ text: cvClean_(s), kind: cvKind_(s) }];
}

function cvNowYm_() { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; }
function cvDate_(s, isEnd, start) {
  s = String(s).toLowerCase().trim();
  if (new RegExp('^' + CV_NOW_ + '$', 'i').test(s)) return Object.assign(cvNowYm_(), { present: true });
  const yy = t => t.length === 4 ? +t : (+t > (cvNowYm_().y % 100) + 1 ? 1900 : 2000) + +t;
  let m = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*['’`\-]?\s*,?\s*(\d{4}|\d{2})$/);
  if (m) return { y: yy(m[2]), m: CV_MON_[m[1]] };
  m = s.match(/^(\d{1,2})[\/.\-](\d{4})$/);
  if (m) return { y: +m[2], m: Math.min(12, Math.max(1, +m[1])) };
  m = s.match(/^(\d{4})$/);
  if (m) return { y: +m[1], m: isEnd ? 12 : 1, yearOnly: true };
  m = s.match(/^(\d{2})$/);
  if (m && start) return { y: Math.floor(start.y / 100) * 100 + +m[1], m: 12, yearOnly: true };
  return null;
}

/** Finds a date range such as "Apr 2021 – Present", "03/2018 - 12/2019", "2019-21", "Since 2020". */
function cvRange_(s) {
  let m = s.match(CV_RANGE_RE_);
  if (m) {
    const start = cvDate_(m[1], false), end = cvDate_(m[2], true, start);
    if (start && end) return { start, end, text: m[0] };
  }
  m = s.match(CV_SINCE_RE_);
  if (m) { const start = cvDate_(m[1] || m[2], false); if (start) return { start, end: Object.assign(cvNowYm_(), { present: true }), text: m[0] }; }
  return null;
}
function cvYm_(d) { return d ? d.y + '-' + ('0' + d.m).slice(-2) : ''; }

function cvExperience_(lines) {
  const L = lines.map(l => {
    const lab = l.bullet ? null : cvLabel_(l.text);
    const o = { text: l.text, bullet: l.bullet, label: lab };
    const dateText = lab && lab.kind === 'date' ? lab.value : l.text;
    const sentence = cvWords_(l.text) > 14 && cvSentence_(l.text);
    o.range = !l.bullet && !sentence && (!lab || lab.kind === 'date') ? cvRange_(dateText) : null;
    if (o.range && lab && lab.kind === 'date') o.text = lab.value;
    return o;
  });
  const headerish = o => !o.bullet && !o.range && (!o.label || o.label.kind === 'role' || o.label.kind === 'company' || o.label.kind === 'location') &&
    cvWords_(o.text) <= 14 && !cvSentence_(o.text) && !(o.label && o.label.kind === 'activity');
  const dates = []; L.forEach((o, i) => { if (o.range) dates.push(i); });
  const entries = [];
  let floor = 0;
  dates.forEach((i, k) => {
    const o = L[i], cands = [], header = [i];
    const add = (line, idx) => {
      header.push(idx);
      if (line.label && line.label.kind === 'role') cands.push({ text: cvClean_(line.label.value), kind: 'role' });
      else if (line.label && line.label.kind === 'company') cands.push({ text: cvClean_(line.label.value), kind: 'companyLabel' });
      else if (line.label && line.label.kind === 'location') cands.push({ text: cvClean_(line.label.value), kind: 'location' });
      else cvSplit_(line.text).forEach(p => cands.push(p));
    };
    const rest = cvClean_(o.text.replace(o.range.text, ' ').replace(/^(dates?|duration|period)\s*[:|]/i, '')
      .replace(/\(?\s*\d+\+?\s*(?:years?|yrs?)(?:\s*,?\s*\d+\s*(?:months?|mos?))?\s*\)?|\(?\s*\d+\s*(?:months?|mos?)\s*\)?/gi, ' '));
    if (rest) cvSplit_(rest).forEach(p => cands.push(p));
    const need = () => !cands.some(c => c.kind === 'role') || !cands.some(c => /company/.test(c.kind));
    const nextDate = k + 1 < dates.length ? dates[k + 1] : L.length;
    // Labelled lines just after the dates (Europass style) belong to this job.
    for (let j = i + 1; j < nextDate && j <= i + 4; j++) {
      const lj = L[j];
      if (lj.label && (lj.label.kind === 'role' || lj.label.kind === 'company' || lj.label.kind === 'location')) add(lj, j);
      else if (!(lj.label && lj.label.kind === 'activity')) break;
    }
    if (need()) {
      const back = [];
      for (let j = i - 1; j >= floor && back.length < 2; j--) { if (!headerish(L[j])) break; back.unshift(j); }
      back.forEach(j => add(L[j], j));
    }
    if (need() && !rest) {
      for (let j = i + 1; j < nextDate && j <= i + 2; j++) { if (!headerish(L[j]) || header.indexOf(j) >= 0) break; add(L[j], j); }
    }
    const role = cands.find(c => c.kind === 'role');
    const company = cands.find(c => c.kind === 'companyLabel') || cands.find(c => c.kind === 'company') ||
      cands.find(c => c.kind === 'company?') || cands.find(c => c.kind === 'unknown' && !CV_TABLE_HEADER_WORDS_.test(c.text));
    const loc = cands.find(c => c.kind === 'location');
    const prev = entries[entries.length - 1];
    entries.push({ role: role ? role.text : '', company: company ? company.text : (prev ? prev.company : ''),
      location: loc ? loc.text : '', start: o.range.start, end: o.range.end, bullets: [], _header: header, _date: i });
    floor = Math.max.apply(null, header) + 1;
  });
  // Bullets: everything between one job's header and the next job's header.
  entries.forEach((e, k) => {
    const from = Math.max.apply(null, e._header) + 1, to = k + 1 < entries.length ? Math.min.apply(null, entries[k + 1]._header) : L.length;
    for (let j = from; j < to; j++) {
      const lj = L[j];
      if (lj.label && lj.label.kind === 'activity') { if (lj.label.value) e.bullets.push(lj.label.value); continue; }
      if (lj.label && lj.label.kind === 'location') { e.location = e.location || cvClean_(lj.label.value); continue; }
      if (!lj.bullet && cvIsLocation_(lj.text)) { e.location = e.location || lj.text; continue; }
      if (CV_TABLE_HEADER_WORDS_.test(lj.text)) continue;
      e.bullets.push(lj.text);
    }
    delete e._header; delete e._date;
  });
  return entries;
}

function cvTotalYears_(entries) {
  const iv = entries.filter(e => !/\bintern(ship)?\b/i.test(e.role))
    .map(e => [e.start.y * 12 + e.start.m - 1, Math.min(e.end.y * 12 + e.end.m - 1, cvNowYm_().y * 12 + cvNowYm_().m - 1)])
    .filter(x => x[1] >= x[0]).sort((a, b) => a[0] - b[0]);
  let months = 0, cur = null;
  iv.forEach(x => {
    if (cur && x[0] <= cur[1] + 1) cur[1] = Math.max(cur[1], x[1]);
    else { if (cur) months += cur[1] - cur[0] + 1; cur = x.slice(); }
  });
  if (cur) months += cur[1] - cur[0] + 1;
  return Math.round(months / 12 * 10) / 10;
}

function cvEducation_(lines) {
  const out = [];
  let cur = null;
  const push = () => { if (cur && (cur.degree || cur.institution)) out.push(cur); cur = null; };
  lines.forEach(l => {
    const lab = cvLabel_(l.text);
    if (lab && lab.kind === 'degree') { push(); cur = { degree: cvClean_(lab.value), institution: '', year: '' }; return; }
    if (lab && lab.kind === 'institution') { cur = cur || { degree: '', institution: '', year: '' }; cur.institution = cvClean_(lab.value); return; }
    const text = lab && lab.kind === 'date' ? lab.value : l.text;
    const parts = text.split(/\s*\|\s*|\s+[—–]\s+|\s+-\s+|,\s+|\s*\(\s*|\s*\)\s*/).map(cvClean_).filter(Boolean);
    if (parts.length && parts.every(p => CV_TABLE_HEADER_WORDS_.test(p))) return;
    const years = text.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g);
    const year = years ? years[years.length - 1] : '';
    let degIdx = parts.findIndex(p => CV_DEGREE_RE_.test(p));
    const instIdx = parts.findIndex((p, j) => j !== degIdx && CV_INSTITUTION_RE_.test(p) && !(degIdx < 0 && CV_DEGREE_RE_.test(p)));
    if (degIdx >= 0) {
      if (cur && !cur.degree && cur.institution && instIdx < 0) cur.degree = parts[degIdx];
      else { push(); cur = { degree: parts[degIdx], institution: '', year: '' }; }
      // "MBA (Finance)" keeps its bracketed specialisation.
      const br = text.match(new RegExp(parts[degIdx].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(([^)]{2,40})\\)'));
      if (br && !/\d/.test(br[1])) cur.degree += ' (' + br[1] + ')';
      if (instIdx >= 0) cur.institution = parts[instIdx];
      else {
        const other = parts.find((p, j) => j > degIdx && !/\d/.test(p) && !cvIsLocation_(p) && !CV_DEGREE_RE_.test(p) && p !== (br && br[1]) && cvWords_(p) >= 2);
        if (other && !cur.institution) cur.institution = other;
      }
    } else if (instIdx >= 0) {
      if (cur && cur.degree && !cur.institution) cur.institution = parts[instIdx];
      else { push(); cur = { degree: '', institution: parts[instIdx], year: '' }; }
    }
    if (cur && year) cur.year = year;
  });
  push();
  return out;
}

function cvSkillItems_(lines, name) {
  const items = [];
  lines.forEach(l => {
    let s = l.text;
    const lab = s.match(/^([A-Za-z][A-Za-z &\/]{1,30}?)\s*:\s*(.+)$/);
    if (lab) {
      const key = cvNorm_(lab[1]);
      if (CV_HEADING_INDEX_[key] === 'other' || /^(languages?|interests?|hobbies|mother tongue|nationality|other languages?)$/.test(key)) return;
      s = lab[2];
    }
    s.split(/\s*[,;|•·●▪]\s*|\s+\/\s+/).map(x => cvClean_(x).replace(/\.$/, '')).forEach(x => {
      if (x.length < 2 || x.length > 50 || cvWords_(x) > 6) return;
      if (name && x.toLowerCase() === name.toLowerCase()) return;
      if (CV_ROLE_RE_.test(x) && !cvIsTool_(x)) return;
      if (/@|\d{6,}|linkedin\.com/i.test(x) || cvIsLocation_(x)) return;
      items.push(x);
    });
  });
  return cvUniq_(items);
}
function cvIsTool_(x) {
  const t = x.toLowerCase().replace(/[()]/g, '').trim();
  return CV_TOOLS_.some(k => t === k || t.indexOf(k + ' ') === 0 || t.slice(-k.length - 1) === ' ' + k);
}

function cvName_(lines, secs) {
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const lab = lines[i].text.match(/^(?:full\s+)?name\s*[:|]\s*(.+)$/i);
    if (lab) return cvClean_(lab[1]);
  }
  const lexicon = CV_SKILL_WORDS_.concat(CV_SECTORS_);
  let best = null;
  lines.slice(0, 30).forEach((l, i) => {
    if (l.bullet || cvHeading_(l.text) || CV_TITLE_LINES_.test(l.text)) return;
    const s = l.text.replace(/,\s*(CA|CFA|ACA|ACCA|CPA|FRM|CMA|CS|MBA|PhD)(\s*,\s*(CA|CFA|ACA|ACCA|CPA|FRM|CMA|CS|MBA|PhD))*\s*$/i, '').trim();
    const toks = s.split(/\s+/);
    if (toks.length < 2 || toks.length > 4 || !toks.every(t => /^[A-Za-z][A-Za-z.'-]*$/.test(t))) return;
    if (CV_ROLE_RE_.test(s) || cvIsLocation_(s) || lexicon.indexOf(s.toLowerCase()) >= 0 || CV_STRONG_CO_RE_.test(s)) return;
    const caps = s === s.toUpperCase(), title = toks.every(t => /^[A-Z]/.test(t));
    if (!caps && !title) return;
    const score = (caps ? 3 : 1) + (i === 0 ? 2 : 0) - i * 0.1;
    if (!best || score > best.score) best = { score, name: s };
  });
  if (!best) return '';
  return best.name === best.name.toUpperCase() ? cvTitle_(best.name.toLowerCase()).replace(/\b([A-Z])\b/g, '$1') : best.name;
}

function cvCity_(lines) {
  const found = [];
  lines.forEach(l => {
    const lab = l.text.match(/^(?:current\s+)?(?:location|address|city|based in)\s*[:|]\s*(.+)$/i);
    const text = (lab ? lab[1] : l.text).toLowerCase();
    CV_CITIES_.forEach(c => { const i = text.search(new RegExp('\\b' + c + '\\b')); if (i >= 0) found.push({ c, i, lab: !!lab }); });
  });
  if (!found.length) return '';
  found.sort((a, b) => (b.lab - a.lab) || (b.c.length - a.c.length));
  return cvTitle_(found[0].c);
}

/** Reads any CV text into structured facts. Nothing is invented: every value comes from the text. */
function parseCv_(text) {
  const lines = cvLines_(text), secs = cvSections_(lines), all = lines.map(l => l.text).join('\n');
  const of = type => secs.filter(s => s.type === type).reduce((a, s) => a.concat(s.lines), []);
  const head = of('header').concat(of('contact'));
  const name = cvName_(lines, secs);
  const email = (all.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [''])[0];
  const phoneM = (all.match(/(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,5}\)[\s-]?)?\d[\d\s-]{5,}\d/g) || []).find(p => { const d = p.replace(/\D/g, ''); return d.length >= 10 && d.length <= 13 && !/^(19|20)\d{2}(19|20)\d{2}$/.test(d); });
  const linkedin = (all.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w%-]+\/?/i) || [''])[0];
  const experience = of('experience').length ? cvExperience_(of('experience')) : [];
  const education = cvEducation_(of('education'));
  let skillItems = cvSkillItems_(of('skills'), name);
  if (!skillItems.length) {
    const low = all.toLowerCase();
    skillItems = CV_SKILL_WORDS_.concat(CV_TOOLS_.filter(t => t.length > 3)).filter(w => new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') + '($|[^a-z])').test(low)).map(cvTitle_);
  }
  const certLines = of('certifications').map(l => cvClean_(l.text)).filter(x => x && cvWords_(x) <= 14 && !cvIsLocation_(x) &&
    x.toLowerCase() !== String(name).toLowerCase() && !(CV_ROLE_RE_.test(x) && /\bat\b|[–—|]/.test(x)));
  // Professional designations count only where a CV states them: certifications, education, summary or next to the name.
  const scope = certLines.concat(of('education').map(l => l.text), of('summary').map(l => l.text), lines.slice(0, 3).map(l => l.text)).join('\n');
  const certifications = certLines.concat(CV_DESIGNATIONS_.filter(d => d[1](scope) && !certLines.some(d[1])).map(d => d[0]));
  const summary = of('summary').map(l => l.text).join(' ').slice(0, 1200);
  const nameAt = name ? lines.findIndex(l => l.text.toLowerCase().indexOf(name.toLowerCase()) === 0 || l.text.toLowerCase() === name.toLowerCase()) : -1;
  const next = nameAt >= 0 ? lines[nameAt + 1] : null;
  const headline = next && !next.bullet && CV_ROLE_RE_.test(next.text) && cvWords_(next.text) <= 8 && !cvRange_(next.text) && !cvHeading_(next.text) ? next.text : '';
  const low = all.toLowerCase(), sectorCount = {};
  CV_SECTORS_.forEach(s => { const m = low.match(new RegExp('\\b' + s.replace(/[-]/g, '\\-') + '\\b', 'g')); if (m) sectorCount[s] = m.length; });
  const sectors = Object.keys(sectorCount).sort((a, b) => sectorCount[b] - sectorCount[a]).slice(0, 6).map(cvTitle_);
  const stated = (summary + ' ' + head.map(l => l.text).join(' ')).match(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years|yrs)/i);
  const cv = {
    name, email, phone: phoneM ? phoneM.trim() : '', linkedin, city: cvCity_(head) || cvCity_(nameAt >= 0 ? lines.slice(nameAt, nameAt + 4) : []), headline, summary,
    skills: skillItems.filter(x => !cvIsTool_(x)), tools: skillItems.filter(cvIsTool_), certifications, education, sectors,
    experience: experience.map(e => ({ role: e.role, company: e.company, location: e.location, start: cvYm_(e.start),
      end: e.end.present ? 'Present' : cvYm_(e.end), bullets: e.bullets })),
    totalYears: cvTotalYears_(experience), statedYears: stated ? +stated[1] : null
  };
  const warn = [];
  if (!cv.name) warn.push('Could not find your name');
  if (!cv.email) warn.push('No email address found');
  if (!cv.phone) warn.push('No phone number found');
  if (!cv.experience.length) warn.push('No jobs with dates found: check the experience section has dates like "Apr 2021 – Present"');
  cv.experience.forEach(e => { if (!e.role || !e.company) warn.push('A job starting ' + e.start + ' is missing its ' + (!e.role ? 'job title' : 'company')); });
  if (cv.statedYears && Math.abs(cv.statedYears - cv.totalYears) > 1.5) warn.push('Your CV says ' + cv.statedYears + ' years; the job dates add up to ' + cv.totalYears);
  cv.warnings = warn;
  return cv;
}

/* ---------- import a CV and configure the app from it ---------- */
function folder_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreated below */ } }
  const f = DriveApp.createFolder('Job Finder');
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

/** Called from the dashboard with the uploaded file. Converts it to a Google Doc and returns a preview; changes nothing yet. */
function importCv(fileName, mimeType, base64) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
  const file = Drive.Files.create({ name: 'Master CV - ' + String(fileName).replace(/\.[^.]+$/, ''), mimeType: MimeType.GOOGLE_DOCS,
    parents: [folder_().getId()] }, blob);
  return previewCv(file.id);
}

/** Preview for a CV that is already a Google Doc (id or link). */
function previewCv(docRef) {
  const docId = (String(docRef).match(/[-\w]{25,}/) || [docRef])[0];
  const cv = parseCv_(DocumentApp.openById(docId).getBody().getText());
  return { docId, cv, plan: cvPlan_(cv, docId) };
}

function cvPlan_(cv, docId) {
  const c = cfg_(), p = profile_(), plan = [];
  const add = (tab, field, current, proposed, onlyIfBlank) => {
    proposed = String(proposed == null ? '' : proposed);
    const keep = !proposed || (onlyIfBlank && String(current || '').trim());
    plan.push({ tab, field, current: String(current || ''), proposed, change: !keep && proposed !== String(current || '') });
  };
  const titles = cvUniq_([cv.experience.length ? cv.experience[0].role : '', cv.headline]).filter(t => t && !/\bintern\b/i.test(t));
  add('Profile', 'Name', p.Name, cv.name);
  add('Profile', 'Email', p.Email, cv.email);
  add('Profile', 'Phone', p.Phone, cv.phone);
  add('Profile', 'LinkedIn', p.LinkedIn, cv.linkedin);
  add('Profile', 'Headline', p.Headline, cv.headline);
  add('Profile', 'Core Skills', p['Core Skills'], cv.skills.join('; '));
  add('Profile', 'Tools', p.Tools, cv.tools.join('; '));
  add('Profile', 'Sectors', p.Sectors, cv.sectors.join('; '));
  add('Profile', 'Certifications', p.Certifications, cv.certifications.join('; '));
  add('Profile', 'Education', p.Education, cv.education.map(e => [e.degree, e.institution, e.year].filter(Boolean).join(', ')).join('; '));
  add('Profile', 'Current City', p['Current City'], cv.city);
  add('Profile', 'Preferred Cities', p['Preferred Cities'], cv.city, true);
  add('Config', 'Master CV Doc ID', c['Master CV Doc ID'], docId);
  add('Config', 'Experience Years', c['Experience Years'], cv.totalYears || '');
  add('Config', 'Target Titles', c['Target Titles'], titles.join('; '), true);
  add('Config', 'Locations', c.Locations, cv.city, true);
  return plan;
}

/** Applies the preview after the owner clicks "Use this CV". Re-reads the document so only real CV facts are saved. */
function applyCv(docId) {
  const res = previewCv(docId);
  res.plan.filter(x => x.change).forEach(x => (x.tab === 'Profile' ? setProfile_ : setConfig_)(x.field, x.proposed));
  setProfile_('CV Data', JSON.stringify(res.cv));
  return { changed: res.plan.filter(x => x.change).map(x => x.field), warnings: res.cv.warnings };
}

function setProfile_(field, value) {
  const r = rows_('Profile').find(x => x.Field === field);
  if (r) setCell_('Profile', r._row, 'Value', value); else append_('Profile', { Field: field, Value: value });
}
function setConfig_(key, value) {
  const r = rows_('Config').find(x => x.Key === key);
  if (r) setCell_('Config', r._row, 'Value', value); else append_('Config', { Key: key, Value: value });
}

/** The structured master CV: saved at import, or read fresh from the master CV document. */
function cvData_(c) {
  const saved = profile_()['CV Data'];
  if (saved) { try { return JSON.parse(saved); } catch (e) { /* fall through */ } }
  return parseCv_(DocumentApp.openById(c['Master CV Doc ID']).getBody().getText());
}
