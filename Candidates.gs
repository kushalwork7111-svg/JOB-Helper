function approvedFacts_() { return rows_('facts').filter(function (f) { return f.approved === true; }); }
function saveFact_(input) {
  var statement = cleanText_(input.statement, 1500), evidence = cleanText_(input.evidence, 2000);
  var types = ['employment', 'skill', 'qualification', 'achievement', 'project', 'experience', 'review'];
  if (!statement || types.indexOf(input.type) < 0) throw new Error('A fact statement and valid category are required.');
  if (input.approved === true && input.type === 'review') throw new Error('Choose a specific fact category and resolve the extraction warning before approval.');
  if (input.approved === true && (!evidence || input.confirmed !== true)) {
    throw new Error('Supply supporting evidence and explicitly confirm this fact before approving it for reuse.');
  }
  var previous = input.id ? find_('facts', input.id) : null;
  if (input.id && !previous) throw new Error('Fact not found.');
  var record = {id: previous ? previous.id : Utilities.getUuid(), type: input.type, statement: statement,
    evidence: evidence, approved: input.approved === true && input.confirmed === true,
    createdAt: previous ? previous.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString()};
  if (previous) { ['sourceSection','sourceStart','sourceEnd','employmentContext','extractionVersion','reviewWarning'].forEach(function (key) { if (previous[key] !== undefined) record[key] = previous[key]; }); }
  put_('facts', record); invalidateAssessments_();
  activity_('fact', (record.approved ? 'Approved' : 'Saved draft') + ' candidate fact (' + record.type + ').');
  return record;
}
// Section-aware local extraction. Exact source spans are retained; uncertain layout is never repaired by guessing.
function cvHeading_(line) {
  var heading = normalize_(line).replace(/\s+/g, ' ');
  var groups = {
    summary: ['summary','professional summary','professional profile','profile','objective','career objective','about me'],
    qualification: ['education','academic background','academic qualifications','qualifications','education and qualifications','educational qualifications','education and training','certifications','certificates','professional certifications','licenses','licences'],
    employment: ['experience','work experience','professional experience','employment','employment history','work history','career history','relevant experience','internships','internship experience','leadership experience','leadership experiences','research experience'],
    project: ['projects','selected projects','personal projects','academic projects','research projects'],
    skill: ['skills','technical skills','core competencies','key skills','competencies','technical competencies','languages','language skills'],
    achievement: ['achievements','awards','honors','honours','awards and honors','awards and honours','activities and awards','accomplishments']
  };
  for (var type in groups) if (groups[type].indexOf(heading) >= 0) return type;
  return '';
}
function cvInline_(raw) {
  return /^\s*([A-Za-z &]{3,32}?)\s{2,}(\S.*)$/.exec(raw) || /^\s*([A-Za-z &]{3,32}?)\s*:\s*(\S.*)$/.exec(raw);
}
function cvContact_(line) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:https?:\/\/|www\.|linkedin\.com\/|github\.com\/)/i.test(line) ||
    /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{3,5}\)?[\s.-]+){1,3}\d{3,5}/.test(line) && /\b(?:phone|mobile|tel)\b|\+|^\s*[\d(]/i.test(line);
}
function cvDateRange_(line) {
  return /(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}|present|current|ongoing|now)/i.test(line) ||
    /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(?:19|20)\d{2}\s*[-–—]/i.test(line);
}
function parseCvDrafts_(text) {
  text = String(text || '');
  var lines = [], offset = 0;
  text.split('\n').forEach(function (raw) {
    lines.push({raw: raw, value: raw.replace(/[\r\f\u0000-\u0008]/g, '').trim(), start: offset, end: offset + raw.length});
    offset += raw.length + 1;
  });
  var drafts = [], sections = [], current = {type: '', title: 'Unclassified CV text', lines: []};
  var hasHeading = lines.some(function (line) { var margin = cvInline_(line.raw); return !!cvHeading_(line.value) || !!(margin && cvHeading_(margin[1])); });
  lines.forEach(function (line) {
    var margin = cvInline_(line.raw);
    var inlineType = margin ? cvHeading_(margin[1]) : '';
    var mixedColumns = line.raw.trim().split(/\s{2,}/).filter(function (part) { return !!cvHeading_(part); }).length > 1;
    var type = mixedColumns ? 'review' : cvHeading_(line.value) || inlineType;
    if (type) { sections.push(current); current = {type: type, title: mixedColumns ? 'Merged CV columns' : inlineType ? margin[1].trim() : line.value, lines: []}; }
    else current.lines.push(line);
    if (mixedColumns) { current.lines.push(line); return; }
    if (inlineType) { var at = line.raw.length - margin[2].length; current.lines.push({raw: margin[2], value: margin[2].trim(), start: line.start + at, end: line.end}); }
  });
  sections.push(current);
  function emit(group, type, section, warning, context) {
    group = group.filter(function (line) { return !!line.value && !cvContact_(line.value); });
    if (!group.length) return;
    // A group is a contiguous exact excerpt, not a reconstruction of shuffled table cells.
    var start = group[0].start, end = group[group.length - 1].end;
    var statement = text.slice(start, end).trim();
    if (!statement || cvContact_(statement)) return;
    if (statement.length > 1500) {
      var part = [], length = 0;
      group.forEach(function (line) {
        if (line.value.length > 1500) {
          if (part.length) { emit(part, 'review', section, 'Long entry split for review; retain its full context.', context); part = []; length = 0; }
          for (var pos = line.start; pos < line.end; pos += 1500) {
            drafts.push({type: 'review', statement: text.slice(pos, Math.min(pos + 1500, line.end)), sourceStart: pos,
              sourceEnd: Math.min(pos + 1500, line.end), sourceSection: section, reviewWarning: 'Long line split for review; do not approve fragments as complete facts.', employmentContext: context || ''});
          }
          return;
        }
        if (length + line.raw.length + 1 > 1500 && part.length) { emit(part, 'review', section, 'Long entry split for review; retain its full context.', context); part = []; length = 0; }
        part.push(line); length += line.raw.length + 1;
      });
      if (part.length) emit(part, 'review', section, 'Long entry split for review; retain its full context.', context);
      return;
    }
    drafts.push({type: type, statement: statement, sourceStart: start, sourceEnd: end, sourceSection: section,
      reviewWarning: warning || '', employmentContext: context || ''});
  }
  sections.forEach(function (section) {
    var rows = section.lines.filter(function (line) { return !cvContact_(line.value); });
    if (!section.type && hasHeading) return; // Name/address/header are not employment.
    if (section.type === 'summary' || section.type === 'review' || !section.type) {
      emit(rows, 'review', section.title, 'Mixed or unclassified text. Choose a specific category and separate claims before approval.'); return;
    }
    if (section.type === 'qualification') {
      var nonblank = rows.filter(function (r) { return !!r.value; });
      var columnOrder = nonblank.filter(function (r) { return /^(?:19|20)\d{2}$/.test(r.value); }).length > 1 ||
        nonblank.some(function (r) { return /^(?:course|year|institution|score|grade|degree)$/i.test(r.value) || /^(?:course\s+year\s+institution\s+score|degree\s+year\s+institution\s+grade)(?:\s+\S|\S)/i.test(r.value); });
      if (columnOrder) { emit(rows, 'review', section.title, 'Education table extracted in column order. Verify course, year, institution and score against the PDF; no row associations were guessed.'); return; }
      var group = [];
      function degreeStart(line) { return /^(?:CA\s+(?:Final|Intermediate|Foundation)|B\.?\s*(?:Com|Sc|A|Tech|Eng)\b|M\.?\s*(?:Com|Sc|A|Tech|BA)\b|MBA\b|Ph\.?D\b|Bachelor|Master|Doctor|Chartered|\d{1,2}(?:th|st|nd|rd)\b)/i.test(line); }
      rows.forEach(function (line) {
        if (!line.value || /^(?:course\s+year\s+institution\s+score|degree\s+year\s+institution\s+grade)$/i.test(line.value.replace(/\s+/g, ' '))) return;
        var degree = degreeStart(line.value);
        var bullet = /^[•*●▪-]\s/.test(line.value);
        var certification = /certif|licen/i.test(section.title);
        var completedRow = group.length && /(?:\d{1,4}\/\d{1,4}|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s+CGPA)\s*$/i.test(group[group.length - 1].value);
        var orphanAfterRow = !degree && completedRow && group.length === 1 && /^\s{3,}\S/.test(line.raw) && /\b(?:college|university|institute|school)\b/i.test(line.value);
        if (group.length && (degree && group.some(function (r) { return degreeStart(r.value); }) || bullet || certification || orphanAfterRow)) { emit(group, 'qualification', section.title); group = []; }
        group.push(line);
      });
      emit(group, 'qualification', section.title); return;
    }
    if (section.type === 'skill') {
      rows.forEach(function (line) { if (line.value) emit([line], 'skill', section.title); }); return;
    }
    var group = [], employmentContext = '', groupType = section.type, header = false;
    function flush() {
      if (!group.length) return;
      emit(group, groupType, section.title, groupType === 'employment' && !group.some(function (r) { return cvDateRange_(r.value); }) ? 'Check employer, role and dates before approval.' : '', employmentContext);
      if (groupType === 'employment') employmentContext = text.slice(group[0].start, group[group.length - 1].end).trim();
      group = [];
    }
    rows.forEach(function (line, i) {
      if (!line.value) { if (!header) flush(); return; }
      var bullet = /^[•*●▪-]\s/.test(line.value);
      var label = /^[^:]{3,100}:\s+\S/.test(line.value);
      var narrative = /^(?:led|managed|built|developed|created|executed|conducted|facilitated|collaborated|analysed|analyzed|supported|delivered|responsible|worked)\b/i.test(line.value);
      var next = rows.slice(i + 1, i + 3).filter(function (r) { return !!r.value; });
      var beginsRole = section.type === 'employment' && !bullet && !label && !narrative && line.value.length < 180 &&
        (cvDateRange_(line.value) || next.some(function (r) { return cvDateRange_(r.value); })) &&
        !(header && cvDateRange_(line.value));
      if (beginsRole) { flush(); groupType = 'employment'; header = true; employmentContext = ''; }
      else if (header && (bullet || label || narrative || line.value.length > 180)) { flush(); header = false; groupType = 'experience'; }
      else if (bullet || label) { flush(); header = false; groupType = section.type === 'employment' ? 'experience' : section.type; }
      if (!group.length && !header) groupType = section.type === 'employment' ? 'experience' : section.type;
      group.push(line);
    });
    flush();
  });
  return drafts;
}
function extractFacts_() {
  var profile = getProfile_();
  if (!profile.cvText) throw new Error('Save your CV first.');
  var parsed = parseCvDrafts_(profile.cvText), added = 0, preserved = 0, superseded = 0;
  locked_(function () {
    if (getProfile_().cvText !== profile.cvText) throw new Error('Your CV changed. Extract the current version instead.');
    var statements = {};
    rows_('facts').forEach(function (fact) {
      // Preserve approvals and user-reviewed edits; archive only untouched auto-generated drafts.
      if (!fact.approved && !fact.updatedAt && /^Exact excerpt from saved CV: /.test(fact.evidence || '') && fact.extractionVersion !== 2) {
        fact.superseded = true; putUnlocked_('facts', fact); superseded++;
      }
      if (!fact.superseded) { statements[normalize_(fact.statement)] = true; preserved++; }
    });
    parsed.forEach(function (draft) {
      var key = normalize_(draft.statement);
      if (statements[key]) return;
      statements[key] = true;
      var record = Object.assign({}, draft, {id: Utilities.getUuid(), evidence: 'Exact excerpt from saved CV (' + draft.sourceSection + '): ' + draft.statement,
        approved: false, extractionVersion: 2, createdAt: new Date().toISOString()});
      putUnlocked_('facts', record); added++;
    });
  });
  return {draftFacts: added, preservedFacts: preserved, supersededDrafts: superseded,
    reviewRequired: parsed.filter(function (draft) { return !!draft.reviewWarning; }).length,
    note: 'Section-aware exact excerpts. Verify draft categories and table relationships before approval. Approved and reviewed facts were preserved.'};
}

function requirements_(description) {
  var text = cleanText_(description, 20000);
  var clauses = text.split(/[\n.;]+/).map(function (line) { return cleanText_(line, 900); }).filter(function (line) { return line.length > 15; });
  var specific = clauses.filter(function (line) { return /must|required|essential|mandatory|prefer|experience|skill|knowledge|ability|qualification|responsib/i.test(line); });
  return (specific.length ? specific : clauses).slice(0, 15).map(function (quote, i) {
    return {id: 'req-' + i, text: quote, importance: /must|required|essential|mandatory/i.test(quote) ? 'essential' : /prefer|desirable|nice.to.have/i.test(quote) ? 'preferred' : 'responsibility'};
  });
}
function meaningfulWords_(text) {
  var skip = ['with','that','this','have','your','will','from','they','their','years','year','required','preferred','must','skills','experience','knowledge','ability','candidate','role','work','team','company','financial','business','strong','excellent','including','relevant'];
  return normalize_(text).split(' ').filter(function (word) { return word.length > 3 && skip.indexOf(word) < 0; });
}
function factOverlap_(requirement, fact) {
  var terms = meaningfulWords_(requirement), words = meaningfulWords_(fact);
  if (!terms.length) return 0;
  return terms.filter(function (term) {
    return words.some(function (word) { return word === term || (word.slice(0, 5) === term.slice(0, 5) && Math.min(word.length, term.length) > 5); });
  }).length / terms.length;
}
function localAssessment_(job, facts, prefs) {
  var requirements = requirements_(job.description), map = [], evidence = [], matchedSkills = [], gaps = [];
  requirements.forEach(function (requirement) {
    var matches = facts.filter(function (fact) { return factOverlap_(requirement.text, fact.statement) >= 0.35; });
    map.push({requirement: requirement.text, importance: requirement.importance, factIds: matches.map(function (f) { return f.id; }),
      status: matches.length ? 'potential evidence — review relevance' : 'not evidenced in approved facts'});
    if (matches.length) {
      evidence.push({factId: matches[0].id, cvQuote: matches[0].statement, jobQuote: requirement.text,
        explanation: 'Approved candidate fact shares relevant terms; this is a screening hint, not proof of meeting the entire requirement.', verified: true});
      matchedSkills.push(matches[0].statement.slice(0, 150));
    } else gaps.push('Not evidenced: ' + requirement.text.slice(0, 140));
  });
  var roleMatch = prefs.roles.some(function (role) { return normalize_(job.title).indexOf(normalize_(role)) >= 0; });
  var coverage = requirements.length ? evidence.length / requirements.length : 0;
  var score = facts.length ? Math.round((roleMatch ? 30 : 10) + coverage * 55 + Math.min(evidence.length * 3, 15)) : 0;
  var essentialGaps = map.filter(function (r) { return r.importance === 'essential' && !r.factIds.length; });
  var fit = !facts.length || !evidence.length ? 'unassessed' : score >= 70 && !essentialGaps.length ? 'strong' : score >= 40 ? 'stretch' : 'weak';
  return {score: score, fit: fit, confidence: 'low', assessedBy: 'local', requirementMap: map, evidence: evidence.slice(0, 12),
    matchedSkills: matchedSkills.slice(0, 10), gaps: gaps.slice(0, 12),
    summary: facts.length ? 'Local evidence screening found ' + evidence.length + ' of ' + requirements.length + ' requirement excerpts with potentially relevant approved facts. Missing evidence does not mean you lack a skill; review essential requirements yourself.' : 'Approve candidate facts in your profile to enable evidence-based local matching.',
    questions: ['Which essential requirements are not yet supported by an approved fact?'], preparation: prefs.features.preparation ? localPreparation_(job, gaps) : []};
}
function localPreparation_(job, gaps) {
  var plans = [{topic: 'Explain your actual experience', action: 'Select approved facts relevant to ' + job.title + ' at ' + job.company + '. Prepare one specific example for each requirement.',
    practice: 'Use STAR: situation, task, your action, and the actual outcome. Do not add unverified numbers.', materials: []},
    {topic: 'Understand this employer and role', action: 'Read the official job posting and employer website. Separate essential qualifications from preferences.',
      practice: 'Explain why this specific role interests you and ask two questions about its responsibilities.', materials: [{title: 'Official job posting', url: job.url, verified: false}]}];
  if (/\bfdd\b|due diligence|transaction|valuation|ebitda/i.test(job.description + ' ' + job.title)) plans.push({topic: 'Financial diligence and valuation practice',
    action: 'Build a quality-of-earnings bridge with clearly labeled sample data. Review recurring EBITDA, working capital, cash/debt adjustments, and the link to valuation. State which areas you have studied versus performed in a job.',
    practice: 'Explain a one-off EBITDA adjustment and a working-capital shortfall; identify evidence you would request from management.',
    materials: [{title: 'CFI financial analysis resources', url: 'https://corporatefinanceinstitute.com/resources/', verified: false},
      {title: 'Damodaran valuation materials', url: 'https://pages.stern.nyu.edu/~adamodar/', verified: false}]});
  if (gaps.length) plans.push({topic: 'Close or clarify evidence gaps', action: gaps.slice(0, 5).join('\n'),
    practice: 'For each gap, decide whether you can supply a truthful approved fact, learn the skill, or need to disclose a requirement you do not meet.', materials: []});
  return plans;
}
function localPacket_(job, profile, facts, assessment) {
  var relevantIds = {};
  (assessment.evidence || []).forEach(function (e) { if (e.factId) relevantIds[e.factId] = true; });
  var relevant = facts.filter(function (fact) { return relevantIds[fact.id]; }).slice(0, 6);
  var points = (relevant.length ? relevant : facts.slice(0, 3)).map(function (f) { return '• ' + f.statement; }).join('\n');
  var letter = 'Dear hiring team,\n\nI am applying for the ' + job.title + ' role at ' + job.company + '. '
    + 'The following verified details from my background may be relevant to this opportunity:\n\n' + points
    + '\n\nI would welcome the opportunity to discuss how my experience relates to your requirements. '
    + 'I can provide further detail where my experience or eligibility needs clarification.\n\nThank you for your consideration,\n'
    + (profile.name || '[Your name]') + '\n' + profile.email;
  return {subject: 'Application: ' + job.title + ' at ' + job.company, coverLetter: letter,
    screeningQuestions: ['What is your notice period?', 'What is your work authorization for this job location, and do you need sponsorship?'],
    interviewPlan: assessment.preparation || localPreparation_(job, assessment.gaps || []),
    interviewQuestions: ['Which part of your verified experience best supports this role?', 'Describe a challenge using an actual project or responsibility.',
      'Which essential requirements need more evidence or preparation?', 'What would you ask this employer before accepting an offer?'],
    resumeSuggestions: ['Put the most relevant approved skills and projects near the top.', 'Keep every role, employer, date, and qualification unchanged.',
      'Disclose gaps accurately; do not turn preparation into employment experience.']};
}
