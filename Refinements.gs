function refinementAllowed_(letter, facts, job, profile) {
  if (!letter) return false;
  var approved = facts.map(function (f) { return f.statement; }).join('\n');
  var allowed = approved + ' ' + job.title + ' ' + job.company + ' ' + profile.name + ' ' + profile.email;
  var pattern = /\b\d+(?:[.,]\d+)*(?:%|k|m|bn)?(?![a-z0-9])/gi;
  var numbers = String(letter).match(pattern) || [], allowedNumbers = allowed.match(pattern) || [];
  if (numbers.some(function (number) { return allowedNumbers.indexOf(number) < 0; })) return false;
  var credentials = String(letter).match(/\b(?:CPA|CFA|MBA|ACCA|CIMA|PhD|chartered accountant)\b/gi) || [];
  if (credentials.some(function (qualification) { return normalize_(approved).indexOf(normalize_(qualification)) < 0; })) return false;
  var urls = String(letter).match(/https?:\/\/[^\s]+/g) || [];
  if (urls.some(function (url) { return allowed.indexOf(url) < 0 && url !== job.url; })) return false;
  // Conservative anchoring. This is a partial factual guard, not semantic verification.
  return facts.some(function (fact) { return fact.statement.length > 15 && normalize_(letter).indexOf(normalize_(fact.statement)) >= 0; })
    && normalize_(letter).indexOf(normalize_(job.company)) >= 0;
}
