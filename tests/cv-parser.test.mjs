import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const parse=text=>harness().c.parseCvDrafts_(text);
const cv=`Fictional Candidate
+91 9000000000 candidate@example.com linkedin.com/in/example Mumbai, India
SUMMARY
Chartered Accountant with three years of experience at Example Advisory.
Specialized in commercial diligence and transformation projects.
EDUCATION
CA Final 2025 Institute of Chartered Accountants 300/600
B.Com 2021 Example College 8.1 CGPA
WORK EXPERIENCE
Article Trainee Feb 2022 - Feb 2025
Example Advisory | Value Creation
Mumbai
Sales Strategy: Executed a transformation project;
analyzed markets and improved coverage by 15%.
Commercial Due Diligence: Led market research for an acquisition.
Senior Associate
Mar 2025 - Present
Example Advisory | Value Creation
Mumbai
Technology Diligence: Evaluated readiness for a 10x capacity scale-up.
CERTIFICATIONS
AI tools - Example Provider
SKILLS
MS Excel
SQL
LANGUAGES
Hindi
English
ACHIEVEMENTS
Spot Award: Recognized for supporting difficult projects.
`;
test('contact/name/address are excluded and summary stays unclassified until reviewed',()=>{
 const facts=parse(cv);assert.ok(!facts.some(f=>/candidate@example|9000000000|linkedin|Fictional Candidate/.test(f.statement)));
 const summary=facts.find(f=>f.sourceSection==='SUMMARY');assert.equal(summary.type,'review');assert.match(summary.reviewWarning,/Mixed/);
});
test('education course/year/institution/score remain in distinct rows',()=>{
 const edu=parse(cv).filter(f=>f.sourceSection==='EDUCATION');assert.equal(edu.length,2);assert.match(edu[0].statement,/CA Final 2025.*300\/600/);assert.match(edu[1].statement,/B.Com 2021.*8.1 CGPA/);
});
test('role dates and employer are grouped and project continuations retain employment context',()=>{
 const facts=parse(cv),jobs=facts.filter(f=>f.type==='employment');assert.equal(jobs.length,2);assert.match(jobs[0].statement,/Article Trainee.*Feb 2022 - Feb 2025\nExample Advisory/);assert.match(jobs[1].statement,/Senior Associate\nMar 2025 - Present\nExample Advisory/);
 const project=facts.find(f=>f.statement.startsWith('Sales Strategy:'));assert.match(project.statement,/improved coverage by 15%/);assert.match(project.employmentContext,/Article Trainee/);
 assert.match(facts.find(f=>f.statement.startsWith('Technology Diligence:')).employmentContext,/Senior Associate/);
});
test('short skills, certifications, languages and awards get section-specific categories',()=>{
 const facts=parse(cv);for(const short of ['SQL','MS Excel','Hindi','English'])assert.equal(facts.find(f=>f.statement===short).type,'skill');assert.equal(facts.find(f=>f.statement==='AI tools - Example Provider').type,'qualification');assert.equal(facts.find(f=>f.statement.startsWith('Spot Award')).type,'achievement');
});
test('all draft statements remain exact source excerpts with no invented facts',()=>{
 for(const f of parse(cv)){assert.ok(cv.includes(f.statement));assert.ok(cv.slice(f.sourceStart,f.sourceEnd).includes(f.statement));}
});
test('column-ordered education remains a review block, not falsely paired qualifications',()=>{
 const facts=parse('EDUCATION\nCourse\nB.Com\nMBA\nYear\n2020\n2022\nInstitution\nAlpha University\nBeta University\nScore\n8.2 CGPA\n9.1 CGPA\nSKILLS\nExcel');const edu=facts.filter(f=>f.sourceSection==='EDUCATION');assert.equal(edu.length,1);assert.equal(edu[0].type,'review');assert.match(edu[0].reviewWarning,/column order/);assert.match(edu[0].statement,/Alpha University/);
});
test('wrapped institution beginning above a course stays with that course',()=>{
 const text='EDUCATION\nCA Final     2025     Chartered Institute       300/600\n                     Example College of Arts\nB.Com        2021     and Commerce              8.1 CGPA\n                     Economics Department\nCA Foundation 2019   Chartered Institute       250/400';const f=parse(text);assert.equal(f.length,3);assert.ok(!f[0].statement.includes('Example College'));assert.match(f[1].statement,/Example College[\s\S]*B.Com[\s\S]*Economics Department/);assert.ok(!f[2].statement.includes('Economics Department'));
});
test('section aliases, CRLF, unicode bullets and short technology names work',()=>{
 const facts=parse('PROFESSIONAL EXPERIENCE\r\nAnalyst 2021–2023\r\nExample Ltd\r\n• Built models and forecast reports\r\n  for investment decisions.\r\nCORE COMPETENCIES\r\nC++\r\nR\r\nLICENSES\r\nCertified Analyst');assert.ok(facts.some(f=>f.type==='employment'));assert.equal(facts.find(f=>f.statement==='C++').type,'skill');assert.equal(facts.find(f=>f.statement==='R').type,'skill');assert.ok(facts.some(f=>f.statement.includes('for investment decisions.')));
});
test('inline margin headings from public sample layouts retain education and skills',()=>{
 const f=parse('Sample Name\nEducation      Example University\n               Bachelor of Science, 2024\nSkills         Computer: Word, Excel and PowerPoint');assert.ok(f.some(x=>x.type==='qualification'&&x.statement.includes('Example University')));assert.ok(f.some(x=>x.type==='skill'&&x.statement.includes('Excel')));assert.ok(!f.some(x=>x.statement.includes('Sample Name')));
});
test('unknown headings and unstructured text are flagged rather than confidently classified',()=>{
 const f=parse('Chartered Accountant with experience in financial models.');assert.equal(f[0].type,'review');assert.ok(f[0].reviewWarning);
});
test('long source entries are preserved across review fragments without silent truncation',()=>{
 const text='PROJECTS\n'+('Worked on financial analysis. '.repeat(120));const f=parse(text);assert.ok(f.length>1);assert.ok(f.every(x=>x.statement.length<=1500&&x.type==='review'));assert.equal(f.map(x=>x.statement).join(''),text.slice('PROJECTS\n'.length));
});
test('review-only drafts cannot be approved until specifically categorized',()=>{
 const h=harness();assert.throws(()=>h.c.saveFact_({type:'review',statement:'Mixed summary',evidence:'CV',approved:true,confirmed:true}),/specific fact category/);
});
test('re-extraction archives untouched legacy drafts while retaining approved and edited facts',()=>{
 const h=harness();h.c.put_('profile',{...h.profile,cvText:cv});h.c.put_('facts',{id:'legacy',type:'experience',statement:'Old contact line',evidence:'Exact excerpt from saved CV: Old contact line',approved:false});h.c.put_('facts',{id:'approved',type:'skill',statement:'MS Excel',evidence:'CV',approved:true});h.c.put_('facts',{id:'edited',type:'experience',statement:'Reviewed career fact',evidence:'Exact excerpt from saved CV: original',approved:false,updatedAt:'2026-01-01'});
 const r=h.c.extractFacts_();assert.equal(r.supersededDrafts,1);assert.equal(h.c.find_('facts','legacy').superseded,true);assert.equal(h.c.find_('facts','approved').approved,true);assert.equal(h.c.find_('facts','edited').statement,'Reviewed career fact');assert.ok(h.c.rows_('facts').filter(f=>f.extractionVersion===2).every(f=>!f.approved));assert.equal(h.requests.length,0);
 const count=h.c.rows_('facts').length;assert.equal(h.c.extractFacts_().draftFacts,0);assert.equal(h.c.rows_('facts').length,count);
});
test('review edits keep provenance and employment context',()=>{
 const h=harness();h.c.put_('profile',{...h.profile,cvText:cv});h.c.extractFacts_();const p=h.c.rows_('facts').find(f=>f.statement.startsWith('Technology Diligence:'));const saved=h.c.saveFact_({...p,confirmed:true,approved:true});assert.equal(saved.sourceSection,'WORK EXPERIENCE');assert.match(saved.employmentContext,/Senior Associate/);
});
test('a collapsed OCR table header is held for review rather than grouping ScoreCA as a qualification',()=>{
 const f=parse('EDUCATION\nCourse Year Institution ScoreCA Final 2025 Chartered Institute 300/600 Example College\nof Science and Commerce\nSKILLS\nExcel');const edu=f.filter(x=>x.sourceSection==='EDUCATION');assert.equal(edu.length,1);assert.equal(edu[0].type,'review');assert.match(edu[0].statement,/ScoreCA/);assert.ok(!edu.some(x=>x.type==='experience'));
});
test('merged headings from two-column resumes are retained as review-only text',()=>{
 const f=parse('EDUCATION       WORK EXPERIENCE\nB.Com 2021      Senior Analyst 2022-Present\nExample College  Example Advisory');assert.ok(f.length);assert.ok(f.every(x=>x.type==='review'));assert.ok(f.map(x=>x.statement).join('\n').includes('Example College'));
});
test('inline colon headings preserve short skills and exact content offsets',()=>{
 const source='SUMMARY: Chartered Accountant with advisory experience\nSkills: SQL, Excel\nCertifications: Certified Analyst';const f=parse(source);assert.equal(f[0].type,'review');assert.equal(f[1].type,'skill');assert.equal(f[1].statement,'SQL, Excel');assert.equal(f[1].sourceSection,'Skills');assert.equal(f[2].type,'qualification');assert.ok(f.every(x=>source.slice(x.sourceStart,x.sourceEnd).trim()===x.statement));
});
