// Measures how accurately the CV reader extracts facts from the sample CVs in tests/cv_fixtures.js.
// Run alone with: node tests/cv_accuracy.js [tuning|holdout|all]  (tests/run.js also runs it and requires every check to pass)
const { createEnv } = require('./harness');

const norm = s => String(s || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
const digits = s => String(s || '').replace(/\D/g, '');

function score(fixtures) {
  const env = createEnv();
  const rows = [];
  fixtures.forEach(f => {
    const cv = env.app.parseCv_(f.text), x = f.expect, checks = [];
    const check = (field, ok, got, want) => checks.push({ field, ok: !!ok, got, want });
    check('name', norm(cv.name) === norm(x.name), cv.name, x.name);
    check('email', norm(cv.email) === norm(x.email), cv.email, x.email);
    check('phone', digits(cv.phone).slice(-10) === digits(x.phone).slice(-10), cv.phone, x.phone);
    if (x.linkedin) check('linkedin', norm(cv.linkedin).indexOf(norm(x.linkedin)) >= 0, cv.linkedin, x.linkedin);
    check('city', norm(cv.city) === norm(x.city), cv.city, x.city);
    if (x.headline) check('headline', norm(cv.headline) === norm(x.headline), cv.headline, x.headline);
    check('job count', cv.experience.length === x.experience.length, cv.experience.length, x.experience.length);
    x.experience.forEach((e, i) => {
      const g = cv.experience[i] || {};
      check('job ' + (i + 1) + ' title', norm(g.role) === norm(e.role), g.role, e.role);
      check('job ' + (i + 1) + ' company', norm(g.company) === norm(e.company), g.company, e.company);
      check('job ' + (i + 1) + ' start', g.start === e.start, g.start, e.start);
    });
    check('total years', Math.abs(cv.totalYears - x.totalYears) <= 0.15, cv.totalYears, x.totalYears);
    const hasAll = (list, want) => want.every(w => list.some(g => norm(g).indexOf(norm(w)) >= 0));
    (x.skills || []).forEach(s => check('skill ' + s, hasAll(cv.skills, [s]), cv.skills.join('; '), s));
    (x.tools || []).forEach(s => check('tool ' + s, hasAll(cv.tools, [s]), cv.tools.join('; '), s));
    (x.notSkills || []).forEach(s => check('not a skill: ' + s, !cv.skills.concat(cv.tools).some(g => norm(g) === norm(s)), cv.skills.join('; '), '(absent)'));
    (x.certifications || []).forEach(s => check('cert ' + s, hasAll(cv.certifications, [s]), cv.certifications.join('; '), s));
    (x.education || []).forEach(s => check('degree ' + s, cv.education.some(e => norm(e.degree).indexOf(norm(s)) === 0), cv.education.map(e => e.degree).join('; '), s));
    rows.push({ format: f.format, checks });
  });
  return rows;
}

const SETS = { tuning: require('./cv_fixtures'), holdout: require('./cv_holdout') };

if (require.main === module) {
  const which = process.argv[2] || 'all';
  const rows = score(which === 'all' ? SETS.tuning.concat(SETS.holdout) : SETS[which]);
  let pass = 0, total = 0;
  rows.forEach(r => {
    const ok = r.checks.filter(c => c.ok).length;
    pass += ok; total += r.checks.length;
    console.log((ok === r.checks.length ? '  ok   ' : '  MISS ') + r.format + ': ' + ok + '/' + r.checks.length);
    r.checks.filter(c => !c.ok).forEach(c => console.log('         ' + c.field + ': got "' + c.got + '", expected "' + c.want + '"'));
  });
  console.log('\nCV reader accuracy: ' + pass + '/' + total + ' facts (' + (100 * pass / total).toFixed(1) + '%) across ' + rows.length + ' CV layouts');
  process.exit(pass === total ? 0 : 1);
}
module.exports = { score, SETS };
