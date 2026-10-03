import test from 'node:test';import assert from 'node:assert/strict';
import {harness,job,packet} from './harness.mjs';
function shared(){const h=harness();h.properties.set('DATABASE_ID','mock');h.c.manageUsers_({operation:'invite',email:'alice@example.com'});h.c.manageUsers_({operation:'invite',email:'bob@example.com'});h.c.manageUsers_({operation:'configure',enabled:true});return h;}
function login(h,email){h.c.api('requestLoginCode',{email});const mail=h.mails.filter(m=>m.to===email).at(-1);const code=/Your code is (\d{6})/.exec(mail.body)[1];return h.c.api('verifyLoginCode',{email,code}).sessionToken;}
const actor=(h,email,fn)=>{const user=h.c.users_().find(u=>u.email===email);return h.c.withActor_({id:user.id,email:user.email,admin:user.id==='owner'},fn);};
const profile=email=>({name:email.split('@')[0],email,cvText:'Worked on financial models and valuation research for investment decisions. Developed reports and forecast analyses.'});
test('invitation-only login gives neutral responses for unknown/disabled accounts and throttles requests',()=>{
 const h=shared();const before=h.mails.length;const unknown=h.c.api('requestLoginCode',{email:'unknown@example.com'});h.c.api('requestLoginCode',{email:'alice@example.com'});const again=h.c.api('requestLoginCode',{email:'alice@example.com'});assert.equal(h.mails.length,before+1);assert.equal(unknown.note,again.note);
 const id=h.c.users_().find(u=>u.email==='bob@example.com').id;h.c.manageUsers_({operation:'disable',id});h.c.api('requestLoginCode',{email:'bob@example.com'});assert.equal(h.mails.length,before+1);
});
test('OTP has five attempts, expires and cannot be reused; stored state contains no raw code/token',()=>{
 const h=shared();h.c.api('requestLoginCode',{email:'alice@example.com'});const code=/Your code is (\d{6})/.exec(h.mails.at(-1).body)[1];const key='LOGIN_CODE_'+h.c.authHash_('alice@example.com');assert.ok(!h.properties.get(key).includes('"code"'));
 for(let i=0;i<5;i++)assert.throws(()=>h.c.api('verifyLoginCode',{email:'alice@example.com',code:code==='000000'?'999999':'000000'}),/invalid/);
 assert.throws(()=>h.c.api('verifyLoginCode',{email:'alice@example.com',code}),/invalid/);
 const token=login(h,'bob@example.com');assert.ok(![...h.properties.values()].some(v=>v.includes(token)));const used=/Your code is (\d{6})/.exec(h.mails.at(-1).body)[1];assert.throws(()=>h.c.api('verifyLoginCode',{email:'bob@example.com',code:used}),/invalid/);
 const sessionKey='LOGIN_SESSION_'+h.c.authHash_(token),session=JSON.parse(h.properties.get(sessionKey));session.expiresAt=Date.now()-1;h.properties.set(sessionKey,JSON.stringify(session));assert.throws(()=>h.c.api('bootstrap',{sessionToken:token}),/Sign in/);
});
test('separate logins isolate profiles/settings/jobs/facts/documents and resist tenant/id spoofing',()=>{
 const h=shared(),alice=login(h,'alice@example.com'),bob=login(h,'bob@example.com');h.c.api('saveProfile',{...profile('alice@example.com'),sessionToken:alice,tenantId:'owner'});h.c.api('saveProfile',{...profile('bob@example.com'),sessionToken:bob});
 actor(h,'alice@example.com',()=>{h.c.put_('jobs',job({id:'same-job',title:'Alice role',tenantId:'owner'}));h.c.put_('documents',{id:'alice-doc',fileId:'alice-file'});h.c.put_('facts',{id:'same-fact',type:'skill',statement:'Alice skill'});});
 actor(h,'bob@example.com',()=>{h.c.put_('jobs',job({id:'same-job',title:'Bob role'}));h.c.put_('facts',{id:'same-fact',type:'skill',statement:'Bob skill'});});
 const a=h.c.api('bootstrap',{sessionToken:alice}),b=h.c.api('bootstrap',{sessionToken:bob}),owner=h.c.api('bootstrap',{});
 assert.equal(a.profile.email,'alice@example.com');assert.equal(b.profile.email,'bob@example.com');assert.equal(owner.profile.email,'owner@example.com');assert.equal(a.jobs[0].title,'Alice role');assert.equal(b.jobs[0].title,'Bob role');assert.equal(a.facts[0].statement,'Alice skill');assert.equal(b.facts[0].statement,'Bob skill');assert.equal(b.documents.length,1);assert.ok(b.documents.every(d=>d.id!=='alice-doc'));assert.equal(owner.jobs.length,0);
 assert.throws(()=>h.c.api('downloadDocument',{id:'alice-doc',sessionToken:bob}),/not found/);assert.throws(()=>h.c.api('saveFact',{id:'alice-doc',type:'skill',statement:'steal',sessionToken:bob}),/not found/);
 assert.throws(()=>h.c.api('saveProfile',{...profile('someone@example.com'),sessionToken:bob}),/verified/);assert.equal(h.c.JH_ACTOR_,null);
});
test('properties and app-created folder IDs are isolated while global AI credentials are not returned',()=>{
 const h=shared();h.properties.set('CV_FOLDER_ID','owner-folder');h.properties.set('GEMINI_API_KEY','never-return-this-key');actor(h,'alice@example.com',()=>{h.c.props_().setProperty('CV_FOLDER_ID','alice-folder');h.c.props_().setProperty('LAST_TEST_EMAIL','alice-test');});
 actor(h,'bob@example.com',()=>{assert.equal(h.c.props_().getProperty('CV_FOLDER_ID'),null);assert.equal(h.c.props_().getProperty('LAST_TEST_EMAIL'),null);});assert.equal(h.c.props_().getProperty('CV_FOLDER_ID'),'owner-folder');
 const token=login(h,'alice@example.com');assert.ok(!JSON.stringify(h.c.api('bootstrap',{sessionToken:token})).includes('never-return-this-key'));
});
test('only host can invite/disable/configure accounts or change shared API credentials',()=>{
 const h=shared(),token=login(h,'alice@example.com');for(const operation of ['list','invite','disable','configure'])assert.throws(()=>h.c.api('manageUsers',{operation,sessionToken:token,email:'extra@example.com'}),/Host/);
 assert.throws(()=>h.c.api('saveSettings',{sessionToken:token,settings:{},geminiKey:'a'.repeat(30)}),/host/);assert.equal(h.properties.get('GEMINI_API_KEY'),undefined);
});
test('disabled users and logged-out sessions immediately lose access, without changing other users',()=>{
 const h=shared(),alice=login(h,'alice@example.com'),bob=login(h,'bob@example.com');h.c.api('logout',{sessionToken:alice});assert.throws(()=>h.c.api('bootstrap',{sessionToken:alice}),/Sign in/);assert.equal(h.c.api('bootstrap',{sessionToken:bob}).owner,'bob@example.com');
 h.c.manageUsers_({operation:'disable',id:h.c.users_().find(u=>u.email==='bob@example.com').id});assert.throws(()=>h.c.api('bootstrap',{sessionToken:bob}),/Sign in/);
});
test('legacy untagged records remain owner-only and same record IDs can safely exist for different users',()=>{
 const h=shared();h.data.facts.set('legacy',{id:'legacy',type:'skill',statement:'Legacy owner fact'});actor(h,'alice@example.com',()=>{assert.equal(h.c.find_('facts','legacy'),null);h.c.put_('facts',{id:'legacy',type:'skill',statement:'Alice separate fact'});assert.equal(h.c.find_('facts','legacy').statement,'Alice separate fact');});assert.equal(h.c.find_('facts','legacy').statement,'Legacy owner fact');
});
test('user context is restored even on exceptions; invalid sessions never fall back to owner',()=>{
 const h=shared();assert.throws(()=>h.c.api('bootstrap',{sessionToken:'f'.repeat(72)}),/Sign in/);assert.equal(h.c.JH_ACTOR_,null);assert.throws(()=>actor(h,'alice@example.com',()=>{throw new Error('test');}),/test/);assert.equal(h.c.JH_ACTOR_,null);
});
test('shared employer mail needs host gate and individual approval, identifies candidate and uses verified reply-to',()=>{
 const h=shared();h.properties.set('LAST_TEST_EMAIL','test');h.c.manageUsers_({operation:'configure',enabled:true,externalEmail:true,confirmedTestReceipt:true,mailLimit:2});const token=login(h,'alice@example.com');
 actor(h,'alice@example.com',()=>{h.c.put_('profile',{id:'cv',...profile('alice@example.com')});h.c.put_('settings',{id:'preferences',value:{...h.prefs,externalSendingEnabled:true}});h.c.put_('jobs',job());h.c.put_('applications',packet({answers:{'What is your notice period?':'30 days'}}));});h.c.sourceJobs_=()=>({jobs:[job()],complete:true});const before=h.mails.length;
 assert.throws(()=>h.c.api('sendApplication',{id:'app-123',sessionToken:token,approved:false}),/approval/);assert.equal(h.mails.length,before);
 h.c.api('sendApplication',{id:'app-123',sessionToken:token,approved:true});assert.equal(h.mails.length,before+1);const mail=h.mails.at(-1);assert.equal(mail.replyTo,'owner@example.com');assert.match(mail.name,/alice via Job Helper/);assert.match(mail.body,/alice@example.com/);assert.ok(!('from' in mail));
 actor(h,'alice@example.com',()=>{h.c.sharedMail_({to:'employer@example.com',body:'Second approved draft'});assert.throws(()=>h.c.sharedMail_({to:'employer@example.com',body:'Third'}),/daily outgoing/);});
});
test('host email gate blocks tenant delivery before MailApp, and other users cannot send someone else’s packet',()=>{
 const h=shared(),a=login(h,'alice@example.com'),b=login(h,'bob@example.com');actor(h,'alice@example.com',()=>{h.c.put_('jobs',job());h.c.put_('applications',packet({answers:{'What is your notice period?':'30 days'}}));h.c.put_('settings',{id:'preferences',value:h.prefs});});h.c.sourceJobs_=()=>({jobs:[job()],complete:true});const before=h.mails.length;
 assert.throws(()=>h.c.api('sendApplication',{id:'app-123',sessionToken:b,approved:true}),/not found/);assert.throws(()=>h.c.api('sendApplication',{id:'app-123',sessionToken:a,approved:true}),/host/);assert.equal(h.mails.length,before);
});
test('tenant reply sync returns only verified sender/reference metadata and tags differ for same IDs',()=>{
 const h=shared();let a,b;actor(h,'alice@example.com',()=>{a=h.c.trackingTag_(packet());});actor(h,'bob@example.com',()=>{b=h.c.trackingTag_(packet());});assert.notEqual(a,b);
 const replies={alice:{from:'Recruiter <careers@example.com>',subject:'Re: role ['+a+']'},bob:{from:'Recruiter <careers@example.com>',subject:'Re: role ['+b+']'},wrongSender:{from:'attacker@example.com',subject:'Re: role ['+a+']'},twoTags:{from:'careers@example.com',subject:'['+a+'] ['+b+']'}};const queries=[];
 h.c.fetchJson_=url=>{queries.push(url);if(url.includes('messages?'))return {messages:Object.keys(replies).map(id=>({id}))};const id=/messages\/([^?]+)/.exec(url)[1],r=replies[id];return {payload:{headers:[{name:'From',value:r.from},{name:'Subject',value:r.subject},{name:'Date',value:'Today'}]}};};
 actor(h,'alice@example.com',()=>{const result=h.c.replyMetadata_(packet({status:'sent_email',submittedAt:new Date().toISOString()}));assert.equal(result.length,1);assert.equal(result[0].id,'alice');});assert.ok(decodeURIComponent(queries[0]).includes(a));assert.ok(!decodeURIComponent(queries[0]).includes(b));assert.ok(queries.slice(1).every(q=>q.includes('format=metadata')));
});
test('one shared trigger cannot be removed by tenant preferences and digests contain only their records',()=>{
 const h=shared();assert.equal(h.triggers.length,1);const handler=h.triggers[0].getHandlerFunction();assert.equal(handler,'dailySharedJobAgent_');
 for(const email of ['alice@example.com','bob@example.com'])actor(h,email,()=>{h.c.put_('settings',{id:'preferences',value:{...h.prefs,dailyEmail:true,digestHour:0,features:{...h.prefs.features,discovery:false}}});h.c.put_('jobs',job({title:email+' private job'}));h.c.installDailyTrigger_(h.c.getSettings_());});assert.equal(h.triggers.length,1);
 const before=h.mails.length;h.c.dailySharedJobAgent_({triggerUid:h.triggers[0].getUniqueId()});const sent=h.mails.slice(before);assert.equal(sent.length,2);for(const m of sent){assert.ok(m.htmlBody.includes(m.to+' private job'));assert.ok(!m.htmlBody.includes((m.to.startsWith('alice')?'bob':'alice')+'@example.com private job'));}
 h.c.dailySharedJobAgent_({triggerUid:h.triggers[0].getUniqueId()});assert.equal(h.mails.length,before+2);h.c.dailySharedJobAgent_({triggerUid:'forged'});assert.equal(h.mails.length,before+2);
});
test('authenticated file download reads only the logged-in user’s saved export',()=>{
 const h=shared(),a=login(h,'alice@example.com'),b=login(h,'bob@example.com');actor(h,'alice@example.com',()=>h.c.put_('documents',{id:'export',fileId:'alice-file'}));actor(h,'bob@example.com',()=>h.c.put_('documents',{id:'export',fileId:'bob-file'}));const reads=[];
 h.c.privateDriveFile_=id=>({getBlob:()=>{reads.push(id);return {getBytes:()=>[80,68,70],getName:()=>id+'.pdf',getContentType:()=>'application/pdf'};}});
 const file=h.c.api('downloadDocument',{id:'export',sessionToken:a});assert.equal(file.name,'alice-file.pdf');assert.equal(file.base64,'UERG');const other=h.c.api('downloadDocument',{id:'export',sessionToken:b});assert.equal(other.name,'bob-file.pdf');assert.equal(reads.join(','),'alice-file,bob-file');
});
test('tenant upload folder creation never reuses owner or another user’s folder',()=>{
 const h=shared(),created=[];h.properties.set('CV_FOLDER_ID','owner-folder');h.c.Drive={Files:{create:metadata=>{const id='folder-'+(created.length+1);created.push({id,metadata});return{id};}}};
 actor(h,'alice@example.com',()=>{h.c.privateCvFolder_();h.c.privateCvFolder_();assert.equal(h.c.props_().getProperty('CV_FOLDER_ID'),'folder-1');});actor(h,'bob@example.com',()=>{h.c.privateCvFolder_();assert.equal(h.c.props_().getProperty('CV_FOLDER_ID'),'folder-2');});assert.equal(created.length,2);assert.equal(h.c.props_().getProperty('CV_FOLDER_ID'),'owner-folder');assert.ok(created.every(r=>!('permissions' in r.metadata)));
});
test('shared AI does not call a provider until both host allowance and user consent are enabled',()=>{
 const h=shared(),token=login(h,'alice@example.com');h.properties.set('GEMINI_API_KEY','mock-api-key');actor(h,'alice@example.com',()=>h.c.put_('settings',{id:'preferences',value:{...h.prefs,features:{...h.prefs.features,ai:true},externalAiConsent:true}}));assert.throws(()=>h.c.api('validateIntegrations',{sessionToken:token}),/host/);assert.equal(h.requests.length,0);
});
test('host-wide login-code cap preserves mail quota and does not reveal account existence',()=>{
 const h=shared();const day='LOGIN_DAY_'+new Date().toISOString().slice(0,10);h.properties.set(day,'40');const before=h.mails.length;const r=h.c.api('requestLoginCode',{email:'alice@example.com'});assert.equal(r.requested,true);assert.equal(h.mails.length,before);
});
test('expired daily quota/digest properties are pruned without removing application state or current claims',()=>{
 const h=shared();h.properties.set('DIGEST_DELIVERY_2020-01-01','sent');h.properties.set('SENT_MAIL_COUNT_2020-01-01','10');h.properties.set('DELIVERY_APPLICATION_KEEP','uncertain');const today=new Date().toISOString().slice(0,10);h.properties.set('DIGEST_DELIVERY_'+today,'uncertain');h.c.pruneDailyState_();assert.equal(h.properties.has('DIGEST_DELIVERY_2020-01-01'),false);assert.equal(h.properties.has('SENT_MAIL_COUNT_2020-01-01'),false);assert.equal(h.properties.get('DELIVERY_APPLICATION_KEEP'),'uncertain');assert.equal(h.properties.get('DIGEST_DELIVERY_'+today),'uncertain');
});
test('shared outreach replies are scoped to a verified contact and do not manufacture an application submission',()=>{
 const h=shared();actor(h,'alice@example.com',()=>{h.c.put_('applications',packet({status:'draft',outreach:[{id:'cold',channel:'email',status:'sent',sentAt:new Date().toISOString(),recipient:'contact@example.com'}]}));h.c.replyMetadata_=app=>{assert.equal(app.recipient,'contact@example.com');return [{id:'own-reply',from:'contact@example.com',subject:'own ref'}];};const result=h.c.syncReplies_();assert.equal(result.outreachUpdated,1);const app=h.c.find_('applications','app-123');assert.equal(app.status,'draft');assert.equal(app.outreach[0].status,'replied');});assert.equal(h.c.rows_('applications').length,0);
});
test('an existing outreach reply blocks an application follow-up pending conversation review',()=>{
 const h=shared();actor(h,'alice@example.com',()=>{h.c.put_('applications',packet({status:'submitted_external',outreach:[{status:'replied'}]}));assert.throws(()=>h.c.sendFollowUp_({id:'app-123',approved:true,confirmedNoReply:true,recipient:'careers@example.com',recipientConfirmed:true,subject:'Follow up',body:'Checking my application.'}),/related contact/);});
});
test('reply synchronization preserves concurrent notes, new outreach and later application stages',()=>{
 const h=shared();actor(h,'alice@example.com',()=>{h.c.put_('applications',packet({status:'sent_email',submittedAt:new Date().toISOString(),notes:'before'}));h.c.replyMetadata_=app=>{h.c.put_('applications',{...app,status:'interview',notes:'concurrent edit',outreach:[{id:'new',status:'draft'}]});return [{id:'reply'}];};h.c.syncReplies_();const saved=h.c.find_('applications','app-123');assert.equal(saved.status,'interview');assert.equal(saved.notes,'concurrent edit');assert.equal(saved.outreach[0].id,'new');assert.equal(saved.replies[0].id,'reply');});
});
test('only native host can resolve a tenant’s uncertain send and owner records stay separate',()=>{
 const h=shared(),alice=h.c.users_().find(u=>u.email==='alice@example.com');actor(h,'alice@example.com',()=>h.c.put_('applications',packet({delivery:{phase:'uncertain'}})));h.c.resolveSharedDelivery(alice.id,'app-123','application','',false);actor(h,'alice@example.com',()=>assert.equal(h.c.find_('applications','app-123').status,'ready'));assert.equal(h.c.rows_('applications').length,0);h.c.Session.getActiveUser=()=>({getEmail:()=>'someone@example.com'});assert.throws(()=>h.c.resolveSharedDelivery(alice.id,'app-123','application','',false),/Owner/);
});
test('host test receipt is required when enabling mail, not again when saving an already enabled configuration',()=>{
 const h=shared();assert.throws(()=>h.c.manageUsers_({operation:'configure',enabled:true,externalEmail:true}),/test briefing/);h.properties.set('LAST_TEST_EMAIL','accepted');assert.throws(()=>h.c.manageUsers_({operation:'configure',enabled:true,externalEmail:true}),/Confirm receipt/);h.c.manageUsers_({operation:'configure',enabled:true,externalEmail:true,confirmedTestReceipt:true});h.c.manageUsers_({operation:'configure',enabled:true,externalEmail:true,mailLimit:5});assert.equal(h.c.sharedConfig_().mailLimit,5);
});
