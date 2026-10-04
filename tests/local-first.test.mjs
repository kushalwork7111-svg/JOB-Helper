import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,job,packet} from './harness.mjs';
const approved={id:'fact1',type:'employment',statement:'Built financial models and analyzed company valuation for investment research, 2021–2024.',evidence:'Verified CV entry',approved:true};
function manualInput(extra={}){return {company:'Example Employer',title:'Financial analyst',location:'Mumbai',url:'https://example.com/careers/analyst',description:'Required financial models and company valuation. Responsibilities include investment research and financial statement analysis. FDD experience is preferred.',officialEmployerSource:true,confirmedOpen:true,...extra};}

test('fresh configuration disables AI processing and external sending without a billing dependency',()=>{
  const {c}=harness();const p=c.settings_({});assert.equal(p.features.ai,false);assert.equal(p.externalAiConsent,false);assert.equal(p.externalSendingEnabled,false);assert.equal(p.features.documents,true);
});
test('draft fact extraction is local, verbatim, and never approves a fact',()=>{
  const h=harness();const r=h.c.extractFacts_();assert.ok(r.draftFacts>0);assert.ok(h.c.rows_('facts').every(f=>!f.approved&&h.profile.cvText.includes(f.statement)));assert.equal(h.requests.length,0);
});
test('approval requires explicit confirmation and evidence; editing is not automatic approval',()=>{
  const h=harness();assert.throws(()=>h.c.saveFact_({type:'skill',statement:'Financial analysis',approved:true}),/supporting evidence/);
  const f=h.c.saveFact_({type:'skill',statement:'Financial analysis',evidence:'CV',approved:true,confirmed:true});assert.equal(f.approved,true);
  const changed=h.c.saveFact_({id:f.id,type:'skill',statement:'Valuation analysis',evidence:'CV',approved:false});assert.equal(changed.approved,false);
});
test('manual import deduplicates a repeated posting and records user-confirmed rather than automated evidence',()=>{
  const h=harness();h.c.put_('facts',approved);const a=h.c.importJob_(manualInput()),b=h.c.importJob_(manualInput({url:'https://example.com/another-copy'}));
  assert.equal(a.id,b.id);assert.equal(b.deduplicated,true);assert.equal(h.c.rows_('jobs').length,1);assert.match(h.c.find_('jobs',a.id).openEvidence,/User-confirmed/);assert.equal(h.requests.length,0);
});
test('unconfirmed manual postings and expired open checks cannot prepare applications',()=>{
  const h=harness();h.c.put_('facts',approved);const a=h.c.importJob_(manualInput({confirmedOpen:false}));
  assert.throws(()=>h.c.prepareApplication_(a.id),/confirm it is still open/);assert.equal(h.c.rows_('applications').length,0);
  h.c.verifyManualJob_({id:a.id,confirmedOpen:true,officialEmployerSource:true});const j=h.c.find_('jobs',a.id);j.verifiedAt=new Date(Date.now()-90000000).toISOString();h.c.put_('jobs',j);assert.throws(()=>h.c.verifyOpen_(a.id),/confirm/);
});
test('manual import rejects non-HTTPS links and does not assume undisclosed salary',()=>{
  const h=harness();assert.throws(()=>h.c.importJob_(manualInput({url:'javascript:alert(1)'})),/HTTPS/);
  const a=h.c.importJob_(manualInput());assert.equal(h.c.find_('jobs',a.id).salary,null);
});
test('local matching distinguishes missing approved evidence from a skill the candidate does not have',()=>{
  const {c,prefs}=harness();const a=c.localAssessment_(job(),[approved],prefs);assert.match(a.summary,/does not mean you lack/);assert.ok(a.requirementMap.length);assert.match(a.gaps.join(' '),/Not evidenced/);assert.ok(a.preparation.some(p=>/diligence/.test(p.topic)));
});
test('one manually imported job becomes a truthful local packet with frozen approved facts and no AI call',()=>{
  const h=harness();h.c.put_('facts',approved);h.c.put_('facts',{id:'unapproved',type:'achievement',statement:'Invented 999% improvement',approved:false});
  const j=h.c.importJob_(manualInput());const app=h.c.prepareApplication_(j.id);assert.equal(app.draftingMode,'Local factual draft');assert.ok(app.coverLetter.includes(approved.statement));assert.ok(!app.coverLetter.includes('999%'));assert.equal(app.factSnapshot.length,1);assert.equal(h.requests.length,0);assert.equal(h.mails.length,0);assert.ok(app.preparation.length);
  h.c.put_('facts',{...approved,statement:'Edited later'});assert.equal(h.c.find_('applications',app.id).factSnapshot[0].statement,approved.statement);
});
test('no approved facts means no misleading application packet is generated',()=>{
  const h=harness();const j=h.c.importJob_(manualInput());assert.throws(()=>h.c.prepareApplication_(j.id),/Approve at least one/);
});
test('AI outage retains a local factual packet, and approved facts alone are sent to refinement',()=>{
  const h=harness();h.c.put_('facts',approved);h.c.put_('settings',{id:'preferences',value:{...h.prefs,features:{...h.prefs.features,ai:true},externalAiConsent:true}});h.properties.set('GEMINI_API_KEY','mock-key');
  let received;h.c.geminiJson_=(instructions,data)=>{received=data;throw new Error('quota exhausted');};const j=h.c.importJob_(manualInput());const app=h.c.prepareApplication_(j.id);
  assert.equal(app.draftingMode,'Local factual draft');assert.match(app.aiWarning,/local factual packet was retained/);assert.equal(received.cv,approved.statement);assert.equal(h.mails.length,0);
});
test('AI refinement factual guard rejects invented numbers and qualifications',()=>{
  const {c,profile}=harness();const anchored=`Example Employer: ${approved.statement}`;assert.equal(c.refinementAllowed_(anchored,[approved],job(),profile),true);
  assert.equal(c.refinementAllowed_(anchored+' Delivered 999% growth.',[approved],job(),profile),false);assert.equal(c.refinementAllowed_(anchored+' I am a CPA.',[approved],job(),profile),false);
  assert.equal(c.refinementAllowed_(anchored+' Delivered 24% growth.',[approved],job(),profile),false);
});
test('inherited object properties are not accepted as answers to screening questions',()=>{
  const {c}=harness();assert.throws(()=>c.assertPacketReady_(packet({screeningQuestions:['constructor'],answers:{}})),/screening questions/);
});
test('external AI requires both the owner feature and processing consent before any network request',()=>{
  const h=harness();h.properties.set('GEMINI_API_KEY','mock-key');assert.throws(()=>h.c.geminiJson_('anything',{cv:'private'}),/disabled/);assert.equal(h.requests.length,0);
  h.c.put_('settings',{id:'preferences',value:{...h.prefs,features:{...h.prefs.features,ai:true},externalAiConsent:false}});assert.throws(()=>h.c.geminiJson_('anything',{cv:'private'}),/processing is off/);assert.equal(h.requests.length,0);
});
test('every API route denies a different Google user before executing',()=>{
  const h=harness();h.c.Session.getActiveUser=()=>({getEmail:()=> 'another@example.com'});
  const routes=['bootstrap','saveSettings','saveProfile','uploadCv','analyzeCv','scanJobs','discoverSources','assessJob','prepareApplication','saveApplication','sendApplication','markApplication','prepareOutreach','sendOutreach','sendFollowUp','addReminder','completeReminder','sendDigest','syncReplies','validateIntegrations','saveFact','extractFacts','importJob','verifyManualJob','setJobDecision','exportDocument'];
  for(const route of routes)assert.throws(()=>h.c.api(route,{approved:true}),/Owner access required/,route);
  assert.throws(()=>h.c.setupJobHelper(),/Owner access required/);assert.throws(()=>h.c.resolveDelivery('any',false),/Owner access required/);assert.throws(()=>h.c.dailyJobAgent(),/Owner access required/);assert.equal(h.mails.length,0);assert.equal(h.requests.length,0);
});
test('disabled features are guarded on the server, not only hidden in the browser',()=>{
  const h=harness();h.c.put_('settings',{id:'preferences',value:{...h.prefs,features:{...h.prefs.features,discovery:false,outreach:false,documents:false,reminders:false}}});
  for(const route of ['scanJobs','discoverSources','prepareOutreach','sendOutreach','exportDocument','addReminder','completeReminder'])assert.throws(()=>h.c.api(route),/feature is disabled/);
});
test('watchlist and dismissed jobs leave the shortlist without deleting their history',()=>{
  const h=harness();h.c.put_('jobs',job());h.c.setJobDecision_({id:job().id,decision:'watchlist'});assert.equal(h.c.shortlist_(h.c.rows_('jobs'),h.prefs,Date.now()).length,0);assert.equal(h.c.rows_('jobs').length,1);
  h.c.setJobDecision_({id:job().id,decision:'dismissed'});assert.equal(h.c.rows_('jobs').length,1);
});
test('document specification preserves exact chronology and qualifications and omits unapproved facts',()=>{
  const {c,profile}=harness();const p=packet({factSnapshot:[approved,{id:'qualification',type:'qualification',statement:'Chartered Accountant, 2018'}]});const paragraphs=c.documentSpec_(p,profile,'cv');const text=paragraphs.map(p=>p.text).join('\n');assert.ok(text.includes('2021–2024'));assert.ok(text.includes('Chartered Accountant, 2018'));assert.equal(text.includes('999%'),false);
  const xml=c.docxParts_(paragraphs).find(p=>p.path==='word/document.xml').content;assert.ok(xml.includes('2021–2024'));assert.match(xml,/Chartered Accountant, 2018/);
});
test('external recipients are blocked until an owner-only test email was sent and receipt confirmed',()=>{
  const h=harness();h.c.put_('settings',{id:'preferences',value:{...h.prefs,externalSendingEnabled:false}});assert.throws(()=>h.c.assertOutgoingRecipient_('careers@example.com'),/External email is disabled/);h.c.assertOutgoingRecipient_('owner@example.com');
  assert.throws(()=>h.c.saveSettings_({settings:{...h.prefs,externalSendingEnabled:true}}),/briefing to yourself/);h.c.sendDigest_(true);
  assert.throws(()=>h.c.saveSettings_({settings:{...h.prefs,externalSendingEnabled:true}}),/confirm receipt/);
  h.c.saveSettings_({settings:{...h.prefs,externalSendingEnabled:true},confirmedTestReceipt:true});h.c.assertOutgoingRecipient_('careers@example.com');assert.equal(h.mails[0].to,'owner@example.com');
});
test('private bootstrap never returns saved AI credentials',()=>{
  const h=harness();h.properties.set('DATABASE_ID','mock');h.properties.set('GEMINI_API_KEY','secret-value-do-not-leak');h.properties.set('AI_GATEWAY_TOKEN','another-secret');const d=h.c.bootstrap_();assert.equal(JSON.stringify(d).includes('secret-value-do-not-leak'),false);assert.equal(JSON.stringify(d).includes('another-secret'),false);
});
test('delivery completion preserves concurrent private notes and prepared outreach',()=>{
  const h=harness();h.c.put_('jobs',job());h.c.sourceJobs_=()=>({jobs:[job()],complete:true});h.c.put_('applications',packet());
  h.c.MailApp.sendEmail=()=>{const app=h.c.find_('applications','app-123');app.notes='Concurrent notes preserved';app.outreach=[{id:'another-draft',status:'draft'}];h.c.put_('applications',app);};
  h.c.sendApplication_({id:'app-123',approved:true});const result=h.c.find_('applications','app-123');assert.equal(result.notes,'Concurrent notes preserved');assert.equal(result.outreach[0].id,'another-draft');assert.equal(result.status,'sent_email');
});
test('attachment selection accepts only CV exports from this application',()=>{
  const h=harness();h.c.put_('applications',packet());h.c.put_('documents',{id:'doc-own',type:'cv',applicationId:'app-123',format:'pdf',fileId:'file-own'});
  const update={...packet(),id:'app-123',attachmentChoice:'doc-own'};const result=h.c.saveApplication_(update);assert.equal(result.cvFileId,'file-own');assert.equal(result.attachedDocumentId,'doc-own');
  h.c.put_('documents',{id:'doc-other',type:'cv',applicationId:'another-app',format:'pdf',fileId:'private-other'});assert.throws(()=>h.c.saveApplication_({...update,attachmentChoice:'doc-other'}),/belonging to this application/);
});
