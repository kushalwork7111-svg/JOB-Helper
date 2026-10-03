import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {zip} from './archive.mjs';
const c=vm.createContext({Intl,Date,JSON,Number,Object,Array,String,Math});
for(const file of ['Core.gs','Documents.gs','DocumentFormat.gs'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
const directory='artifacts/document-qa';fs.mkdirSync(directory,{recursive:true});
const profile={name:'Sample Candidate — fictional export QA',email:'sample@example.com'};
const base={id:'qa',title:'Financial Analyst',company:'Fictional Employer',subject:'Application for Financial Analyst at Fictional Employer',
  factSnapshot:[{id:'employment-1',type:'employment',statement:'Financial Analyst, Fictional Employer, April 2019–March 2022. Built financial models and reviewed financial statements.'},
    {id:'qualification-1',type:'qualification',statement:'Chartered Accountant qualification, 2018 — fictional test qualification.'},
    {id:'skill-1',type:'skill',statement:'Financial modeling, valuation analysis, and spreadsheet research.'}],
  coverLetter:'Dear hiring team,\n\nI am applying for the Financial Analyst role at Fictional Employer.\nFinancial Analyst, Fictional Employer, April 2019–March 2022. Built financial models and reviewed financial statements.\n\nThank you,\nSample Candidate'};
const long={...base,factSnapshot:[...base.factSnapshot,...Array.from({length:45},(_,i)=>({id:'project-'+i,type:'project',statement:`Project${String(i+1).padStart(2,'0')}: This fictional QA fact preserves an actual recorded project description without inventing metrics, employer names, dates, or qualifications. It demonstrates how long evidence-backed text wraps cleanly in a plain, ATS-friendly document.`}))]};
const cases=[['cv-short','cv',base],['cv-long','cv',long],['cover-letter','letter',base]];
const result=[];
for(const [name,type,application]of cases){
  const paragraphs=c.documentSpec_(application,profile,type),parts=c.docxParts_(paragraphs),docx=`${directory}/${name}.docx`;
  fs.writeFileSync(docx,zip(parts));
  execFileSync('python3',['-c','import sys,zipfile,xml.etree.ElementTree as E\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nfor p in z.namelist(): E.fromstring(z.read(p))',docx]);
  execFileSync('soffice',[`-env:UserInstallation=file:///tmp/job-helper-office-qa-${process.pid}`,'--headless','--convert-to','pdf','--outdir',directory,docx],{timeout:60000});
  const pdf=`${directory}/${name}.pdf`;assert.ok(fs.existsSync(pdf),'PDF conversion must actually produce a file');
  const text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'}),normalized=text.replace(/\s+/g,' ').trim();
  for(const paragraph of paragraphs)if(paragraph.text.trim())assert.ok(normalized.includes(paragraph.text.replace(/\s+/g,' ').trim()),`Missing or altered source text in ${name}: ${paragraph.text.slice(0,80)}`);
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'}),pages=Number(info.match(/Pages:\s+(\d+)/)[1]);
  if(name==='cv-long')assert.ok(pages>=3,'Long CV must paginate; it must not clip or silently truncate');
  execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1400','-png',pdf,`${directory}/${name}`],{timeout:30000});
  result.push({name,paragraphs:paragraphs.length,pages,docx,pdf,exactSourceTextPreserved:true});
  console.log(`${name}: actual DOCX opened; ${pages}-page LibreOffice PDF rendered; all source text preserved.`);
}
fs.writeFileSync(`${directory}/report.json`,JSON.stringify({results:result,note:'DOCX generator and LibreOffice rendering validated. Google Drive/Docs PDF export requires live owner authorization and remains untested.'},null,2));
