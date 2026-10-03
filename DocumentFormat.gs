/* Deterministic, ATS-friendly OOXML; no AI or external conversion is needed for DOCX. */
function documentSpec_(application, profile, type) {
  var paragraphs = [{style: 'Title', text: profile.name}, {style: 'Normal', text: profile.email}];
  if (type === 'cv') {
    paragraphs.push({style: 'Normal', text: 'Target role: ' + application.title});
    cvSections_(application, profile).forEach(function (section) {
      paragraphs.push({style: 'Heading1', text: section.heading});
      section.lines.forEach(function (line) { paragraphs.push({style: 'Normal', text: line}); });
    });
  } else {
    safeMessage_(application.subject, application.coverLetter);
    paragraphs.push({style: 'Heading1', text: application.subject});
    application.coverLetter.split('\n').forEach(function (line) { paragraphs.push({style: 'Normal', text: line}); });
  }
  return paragraphs;
}
function xmlEscape_(value) {
  return String(value || '').replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]; })
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
function docxParts_(paragraphs) {
  var document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>';
  paragraphs.forEach(function (p) {
    document += '<w:p><w:pPr><w:pStyle w:val="' + xmlEscape_(p.style) + '"/></w:pPr><w:r>'
      + p.text.split('\n').map(function (line) { return '<w:t xml:space="preserve">' + xmlEscape_(line) + '</w:t>'; }).join('<w:br/>') + '</w:r></w:p>';
  });
  document += '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>';
  return [
    {path: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},
    {path: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {path: 'word/document.xml', content: document},
    {path: 'word/_rels/document.xml.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {path: 'word/styles.xml', content: '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>'}
  ];
}
