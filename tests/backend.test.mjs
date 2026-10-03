import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {harness, job, packet, applicationHarness} from './harness.mjs';

test('preferences normalize numbers, deduplicate sources, and never persist unknown secrets or automatic sending',()=>{
  const {c}=harness();const p=c.settings_({minimumScore:200,digestHour:27,GEMINI_API_KEY:'must-not-save',autoFollowUps:true,sources:[{type:'lever',board:'example'},{type:'lever',board:'EXAMPLE'}]});
  assert.equal(p.minimumScore,100);assert.equal(p.digestHour,23);assert.equal(p.sources.length,1);assert.equal(p.GEMINI_API_KEY,undefined);assert.equal(p.autoFollowUps,undefined);
});
test('invalid board identifiers, currencies, and timezones are rejected',()=>{
  const {c}=harness();assert.throws(()=>c.settings_({sources:[{type:'lever',board:'../secrets'}]}),/valid company slug/);
  assert.throws(()=>c.settings_({salaryCurrency:'$'}),/currency/);assert.throws(()=>c.settings_({timezone:'Mars/Olympus'}),/timezone/);
});
test('salary converts hourly pay explicitly; unknown intervals and invalid ranges remain unknown',()=>{
  const {c}=harness();assert.equal(c.annualSalary_({min:20,max:30,currency:'USD',interval:'hour'}).max,62400);
  assert.equal(c.annualSalary_({max:30,currency:'USD',interval:'unknown'}),null);
  assert.equal(c.annualSalary_({min:40,max:30,currency:'USD',interval:'year'}),null);
});
test('salary below minimum is rejected; partially qualifying ranges are flagged',()=>{
  const {c,prefs}=harness();assert.equal(c.jobGates_(job({salary:{min:600000,max:900000,currency:'INR',interval:'year'}}),prefs,Date.now()).rejected,true);
  const gates=c.jobGates_(job({salary:{min:600000,max:1500000,currency:'INR',interval:'year'}}),prefs,Date.now());assert.equal(gates.rejected,false);assert.match(gates.warnings.join(' '),/part of the salary/);
});
test('missing salaries and foreign currencies are never silently treated as satisfying the salary floor',()=>{
  const {c,prefs}=harness();const j=job({salary:{min:100000,max:150000,currency:'USD',interval:'year'}});
  assert.match(c.jobGates_(j,prefs,Date.now()).warnings.join(' '),/unverified/);
  assert.equal(c.jobGates_(j,{...prefs,requireSalary:true},Date.now()).rejected,true);
  assert.equal(c.jobGates_(job({salary:null}),{...prefs,minimumSalary:0,requireSalary:true},Date.now()).rejected,true);
});
test('remote jobs outside a chosen location retain an eligibility warning',()=>{
  const {c,prefs}=harness();const gates=c.jobGates_(job({location:'Remote — United States',remote:true}),prefs,Date.now());
  assert.equal(gates.rejected,false);assert.match(gates.warnings.join(' '),/country restrictions/);
  assert.equal(c.jobGates_(job({location:'London',remote:false}),prefs,Date.now()).rejected,true);
});
test('closed, stale, invalid-date, and future-dated verification cannot pass open checks',()=>{
  const {c,prefs}=harness();for(const overrides of [{openState:'closed'},{verifiedAt:new Date(Date.now()-90000000).toISOString()},{verifiedAt:'garbage'},{verifiedAt:new Date(Date.now()+90000000).toISOString()}])assert.equal(c.jobGates_(job(overrides),prefs,Date.now()).rejected,true);
});
test('posting age and excluded keywords filter independently of fit',()=>{
  const {c,prefs}=harness();assert.equal(c.jobGates_(job({postedAt:new Date(Date.now()-90*86400000).toISOString()}),prefs,Date.now()).rejected,true);
  assert.equal(c.jobGates_(job(),{...prefs,excludedKeywords:['FDD']},Date.now()).rejected,true);
});
test('matching quotes must exist in both source documents; hallucinated fit scores are capped',()=>{
  const {c,profile}=harness();const good=c.sanitizeAssessment_({score:91,fit:'stretch',confidence:'high',evidence:[{cvQuote:'Built financial models',jobQuote:'financial models',explanation:'Transferable modeling skill'}]},job(),profile);
  assert.equal(good.score,91);assert.equal(good.evidence[0].verified,true);assert.equal(good.fit,'stretch');
  const bad=c.sanitizeAssessment_({score:99,fit:'strong',confidence:'high',evidence:[{cvQuote:'Ten years of FDD',jobQuote:'Mandatory CPA license'}]},job(),profile);
  assert.equal(bad.score,45);assert.equal(bad.fit,'unassessed');assert.equal(bad.confidence,'low');
  assert.equal(c.quoteExists_('-----',profile.cvText),false);
});
test('learning-resource links reject executable schemes and remain labeled unverified',()=>{
  const {c}=harness();const p=c.sanitizePreparation_([{topic:'Valuation',materials:[{title:'Bad',url:'javascript:alert(1)'},{title:'Course',url:'https://example.com/course'}]}]);
  assert.equal(p[0].materials.length,1);assert.equal(p[0].materials[0].verified,false);
});
test('shortlist honors stretch setting, minimum score, weak fits, and closed state',()=>{
  const {c,prefs}=harness();const jobs=[job(),job({id:'stretch',assessment:{score:70,fit:'stretch'}}),job({id:'weak',assessment:{score:80,fit:'weak'}}),job({id:'closed',openState:'closed'})];
  assert.equal(c.shortlist_(jobs,prefs,Date.now()).length,2);assert.equal(c.shortlist_(jobs,{...prefs,includeStretch:false},Date.now()).length,1);
});
test('invalid JSON and unresolved placeholders fail before sending',()=>{
  const {c}=harness();assert.equal(c.parseModelJson_('```json\n{"ok":true}\n```').ok,true);assert.throws(()=>c.parseModelJson_('invalid'),/invalid structured/);
  assert.throws(()=>c.safeMessage_('Application','Hello [Your name]'),/placeholders/);assert.equal(c.safeMessage_('subject\nInjected','body').subject,'subject Injected');
});
test('owner-only access rejects mismatched and blank active user identity',()=>{
  const {c}=harness();c.requireOwner_();c.Session.getActiveUser=()=>({getEmail:()=>''});assert.throws(()=>c.requireOwner_(),/Owner access required/);
  c.Session.getActiveUser=()=>({getEmail:()=> 'other@example.com'});assert.throws(()=>c.api('bootstrap'),/Owner access required/);
});
test('API dispatch cannot invoke arbitrary internal helpers',()=>{
  const {c}=harness();assert.throws(()=>c.api('geminiText_'),/Unknown action/);
});
test('application sends require approval, answered questions, and verified contacts',()=>{
  const h=applicationHarness();assert.throws(()=>h.c.sendApplication_({id:'app-123'}),/approval/);assert.equal(h.mails.length,0);
  h.c.put_('applications',packet({answers:{}}));assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/screening questions/);assert.equal(h.mails.length,0);
  h.c.put_('applications',packet({recipientConfirmed:false}));assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/official source/);assert.equal(h.mails.length,0);
});
test('a closed employer posting blocks an approved application',()=>{
  const h=applicationHarness();h.c.sourceJobs_=()=>({jobs:[],complete:true});assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/no longer listed/);
  assert.equal(h.mails.length,0);assert.equal(h.c.find_('jobs',job().id).openState,'closed');
});
test('changed posting text invalidates the packet before sending',()=>{
  const h=applicationHarness();h.c.sourceJobs_=()=>({jobs:[job({description:'Completely new requirements'})],complete:true});assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/updated this posting/);assert.equal(h.mails.length,0);
});
test('approved email is sent once, includes answers, and creates a follow-up reminder',()=>{
  const h=applicationHarness();const r=h.c.sendApplication_({id:'app-123',approved:true});assert.equal(r.sent,true);assert.equal(h.mails.length,1);
  assert.match(h.mails[0].body,/30 days/);assert.match(h.mails[0].subject,/JH-/);assert.equal(h.c.find_('applications','app-123').status,'sent_email');
  assert.equal(h.c.rows_('reminders').length,1);assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/already sent/);assert.equal(h.mails.length,1);
});
test('uncertain delivery failures block retries until the owner resolves Sent-mail evidence',()=>{
  const h=applicationHarness();h.c.MailApp.sendEmail=()=>{throw new Error('Transport failure');};assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/Sent mailbox/);
  assert.equal(h.c.find_('applications','app-123').delivery.phase,'uncertain');assert.throws(()=>h.c.sendApplication_({id:'app-123',approved:true}),/already sent/);
  h.c.resolveDelivery('app-123',false);assert.equal(h.c.find_('applications','app-123').delivery,undefined);
});
test('stage updates require proof and cannot manufacture the server email-sent status',()=>{
  const h=applicationHarness();assert.throws(()=>h.c.markApplication_({id:'app-123',status:'sent_email',proof:'guess',approved:true}),/Invalid application status/);
  assert.throws(()=>h.c.markApplication_({id:'app-123',status:'submitted_external',approved:true}),/confirmation/);
  const r=h.c.markApplication_({id:'app-123',status:'submitted_external',proof:'Confirmation from employer form',approved:true});assert.equal(r.status,'submitted_external');assert.equal(h.mails.length,0);
});
test('application edits do not silently change a sent packet or reopen it',()=>{
  const h=applicationHarness({status:'sent_email'});const r=h.c.saveApplication_({id:'app-123',subject:'tampered',coverLetter:'changed',notes:'Interview Tuesday',answers:{}});
  assert.equal(r.status,'sent_email');assert.equal(r.subject,'Application for Financial analyst');assert.equal(r.notes,'Interview Tuesday');
});
test('follow-up aborts on detected inbox reply, and requires explicit approval even without replies',()=>{
  const h=applicationHarness({status:'sent_email',submittedAt:new Date().toISOString()});h.c.replyMetadata_=()=>[{id:'reply1'}];
  assert.throws(()=>h.c.sendFollowUp_({id:'app-123',approved:true}),/reply was found/);assert.equal(h.mails.length,0);assert.equal(h.c.find_('applications','app-123').status,'replied');
  assert.throws(()=>h.c.sendFollowUp_({id:'app-123'}),/approval/);
});
test('follow-up sends at most once after no-reply and recipient confirmation',()=>{
  const h=applicationHarness({status:'sent_email',submittedAt:new Date().toISOString()});h.c.replyMetadata_=()=>[];
  const input={id:'app-123',approved:true,recipient:'careers@example.com',recipientConfirmed:true,confirmedNoReply:true,subject:'Following up',body:'I remain interested in this role.'};
  h.c.sendFollowUp_(input);assert.equal(h.mails.length,1);assert.throws(()=>h.c.sendFollowUp_(input),/already sent/);assert.equal(h.mails.length,1);
});
test('LinkedIn drafts cannot be silently sent as email',()=>{
  const h=applicationHarness({outreach:[{id:'out1',channel:'linkedin',status:'draft'}]});assert.throws(()=>h.c.sendOutreach_({id:'app-123',draftId:'out1',approved:true,subject:'Hello',body:'Hello there',recipient:'person@example.com',recipientConfirmed:true}),/Email draft unavailable/);assert.equal(h.mails.length,0);
});
test('board fetch failure and incomplete pagination never mark unobserved jobs closed',()=>{
  for(const result of ['error','incomplete']){
    const h=harness();h.c.put_('jobs',job());h.c.put_('settings',{id:'preferences',value:{...h.prefs,sources:[job().source]}});
    h.c.sourceJobs_=()=>{if(result==='error')throw new Error('HTTP 403');return {jobs:[],complete:false};};h.c.scanJobs_();assert.equal(h.c.find_('jobs',job().id).openState,'open');
  }
});
test('successful complete board scans mark missing jobs closed and cap new imports',()=>{
  const h=harness();h.c.put_('jobs',job());h.c.put_('settings',{id:'preferences',value:{...h.prefs,sources:[job().source]}});
  h.c.sourceJobs_=()=>({jobs:Array.from({length:50},(_,i)=>job({id:'new-'+i})),complete:true});const r=h.c.scanJobs_();
  assert.equal(r.imported,35);assert.equal(r.additionalBoardJobs,15);assert.equal(h.c.find_('jobs',job().id).openState,'closed');
});
test('Greenhouse adapter preserves posting-date and salary-period uncertainty',()=>{
  const h=harness();h.c.fetchJson_=()=>({jobs:[{id:1,title:'Analyst',location:{name:'Mumbai'},content:'Financial analysis',absolute_url:'https://malicious.example/post',updated_at:new Date().toISOString(),pay_input_ranges:[{min:10,max:20,currency_type:'USD'}]}]});
  const j=h.c.sourceJobs_({type:'greenhouse',board:'example',company:'Example'}).jobs[0];assert.equal(j.postedAt,null);assert.equal(j.salary.interval,'');assert.match(j.url,/job-boards\.greenhouse\.io/);
});
test('Lever fetches all pages and labels a safety cap incomplete',()=>{
  const h=harness();let calls=0;h.c.fetchJson_=()=>{calls++;return Array.from({length:100},(_,i)=>({id:`${calls}-${i}`,text:'Analyst',categories:{location:'Mumbai'},descriptionPlain:'Financial analysis',applyUrl:'https://jobs.lever.co/example/a/apply'}));};
  const r=h.c.sourceJobs_({type:'lever',board:'example'});assert.equal(calls,10);assert.equal(r.jobs.length,1000);assert.equal(r.complete,false);
});
test('AI API keys stay out of URLs; upstream errors never reveal their response bodies',()=>{
  const h=harness();h.properties.set('GEMINI_API_KEY','secret-test-value');h.c.put_('settings',{id:'preferences',value:{...h.prefs,features:{...h.prefs.features,ai:true},externalAiConsent:true}});h.c.UrlFetchApp.fetch=(url,options)=>{h.requests.push({url,options});return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]})};};
  assert.equal(h.c.geminiJson_('Return ok',{}).ok,true);assert.equal(h.requests[0].url.includes('secret-test-value'),false);assert.equal(h.requests[0].options.headers['x-goog-api-key'],'secret-test-value');
  h.c.UrlFetchApp.fetch=()=>({getResponseCode:()=>429,getContentText:()=> 'secret-test-value'});assert.throws(()=>h.c.geminiJson_('Return ok',{}),e=>/429/.test(e.message)&&!e.message.includes('secret-test-value'));
});
test('gateway endpoint rejects local hosts, IP addresses, query credentials, and non-HTTPS URLs',()=>{
  const h=harness();for(const url of ['http://example.com/ai','https://127.0.0.1/ai','https://localhost/ai','https://host.internal/ai','https://example.com/ai?key=secret']){h.properties.set('AI_GATEWAY_URL',url);assert.throws(()=>h.c.gatewayUrl_(),/trusted public HTTPS/);}
  h.properties.set('AI_GATEWAY_URL','https://gateway.example.com/ai');assert.equal(h.c.gatewayUrl_(),'https://gateway.example.com/ai');
});
test('daily automation sends only to the owner; no employers are contacted; duplicate daily digest is prevented',()=>{
  const h=harness();h.properties.set('DATABASE_ID','mock');h.c.put_('jobs',job());h.c.put_('applications',packet());h.c.put_('settings',{id:'preferences',value:{...h.prefs,dailyEmail:true,sources:[job().source]}});
  h.c.scanJobs_=()=>({boardsChecked:1});h.c.syncReplies_=()=>({updated:0,errors:[]});h.c.dailyJobAgent();h.c.dailyJobAgent();assert.equal(h.mails.length,1);assert.equal(h.mails[0].to,'owner@example.com');assert.equal(h.c.find_('applications','app-123').status,'ready');
});
test('daily digest escapes posting HTML and includes due reminders',()=>{
  const h=harness();h.c.put_('jobs',job({title:'<script>alert(1)</script>'}));h.c.put_('reminders',{id:'r1',title:'Prepare valuation exercise',dueAt:new Date().toISOString(),complete:false});
  const r=h.c.sendDigest_(true);assert.equal(r.reminders,1);assert.equal(h.mails[0].htmlBody.includes('<script>'),false);assert.match(h.mails[0].htmlBody,/&lt;script&gt;/);assert.match(h.mails[0].htmlBody,/Prepare valuation exercise/);
});
