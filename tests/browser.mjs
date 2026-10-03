import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {demoData} from '../tools/demo-data.mjs';
import {harness} from './harness.mjs';

const server=spawn(process.execPath,['tools/preview.mjs'],{env:{...process.env,JOB_HELPER_PREVIEW_PORT:'4174'},stdio:'ignore'});
const url='http://127.0.0.1:4174';let browser;const results=[],errors=[];
const check=(name,condition)=>{assert.ok(condition,name);results.push(name);};
try{
  let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,'Preview server started');
  browser=await chromium.launch({...(fs.existsSync(process.env.CHROMIUM_PATH||'/usr/bin/chromium')?{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}:{}),headless:true,args:['--no-sandbox']});
  const h=harness(),fixture=demoData();h.properties.set('DATABASE_ID','mock');
  for(const table of ['jobs','applications','reminders','activity','facts','documents'])for(const row of fixture[table])h.c.put_(table,row);
  h.c.put_('settings',{id:'preferences',value:fixture.settings});h.c.put_('profile',fixture.profile);
  h.c.sourceJobs_=()=>({jobs:h.c.rows_('jobs').filter(j=>j.source.type!=='manual'),complete:true});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('testBackend',async(action,payload)=>{try{return{ok:true,value:h.c.api(action,payload)};}catch(e){return{ok:false,message:e.message};}});
  await page.addInitScript(()=>{
    const bridge={script:{get run(){let ok=()=>{},fail=()=>{};return{withSuccessHandler(fn){ok=fn;return this;},withFailureHandler(fn){fail=fn;return this;},api(action,payload){window.testBackend(action,payload).then(result=>result.ok?ok(result.value):fail({message:result.message}));}};}}};
    Object.defineProperty(window,'google',{get:()=>bridge,set(){},configurable:false});
  });
  await page.goto(url);await page.locator('h1').waitFor();
  check('Preview clearly labels fictional data',(await page.locator('#main').innerText()).includes('fictional sample data'));
  const navigate=async name=>{await page.locator(`nav [data-page="${name}"]`).click();await page.locator('h1').waitFor();};
  for(const width of [320,390,768,1024,1366]){
    await page.setViewportSize({width,height:1000});
    for(const name of ['overview','jobs','pipeline','prep','profile','settings']){
      await navigate(name);
      check(`${name} has no page overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await navigate('jobs');await page.locator('[data-action="job"]').first().click();
    check(`Opportunity dialog fits at ${width}px`,await page.locator('#detail-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth));
    await page.locator('[data-action="close"]').click();await navigate('pipeline');await page.locator('[data-action="application"]').first().click();
    check(`Application dialog fits at ${width}px`,await page.locator('#detail-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth));
    await page.locator('[data-action="close"]').click();
  }
  await page.setViewportSize({width:1366,height:1000});await navigate('settings');
  await page.locator('[name="roles"]').fill('Financial analyst, Transaction advisory');await navigate('overview');await navigate('settings');
  check('Unsaved settings survive navigation',await page.locator('[name="roles"]').inputValue()==='Financial analyst, Transaction advisory');
  await page.locator('[name="geminiKey"]').fill('never-cache-this-secret-value');await navigate('overview');await navigate('settings');
  check('Secret input is not cached across navigation',await page.locator('[name="geminiKey"]').inputValue()==='');
  await page.locator('[name="feature-discovery"]').uncheck();await page.locator('#settings-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);
  await navigate('jobs');check('Discovery controls hide after feature is disabled',await page.locator('[data-action="scan"]').isHidden());
  await navigate('settings');await page.locator('[name="feature-discovery"]').check();await page.locator('#settings-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);
  await navigate('profile');await page.locator('[name="name"]').fill('Sample Edited Name');await navigate('overview');await navigate('profile');check('Unsaved CV contact edits survive navigation',await page.locator('[name="name"]').inputValue()==='Sample Edited Name');
  await page.locator('#profile-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);check('Profile changes reach the actual mocked Apps Script route',h.c.getProfile_().name==='Sample Edited Name');
  h.c.put_('profile',{...h.c.getProfile_(),cvText:'Fictional QA Candidate\nqa@example.com +91 9000000000\nSUMMARY\nChartered Accountant with three years of advisory experience.\nWORK EXPERIENCE\nAnalyst Jan 2020 - Dec 2022\nExample Advisory\n• Built financial models\n  and prepared forecast reports.\nSKILLS\nMS Excel\nSQL'});
  await navigate('overview');await navigate('profile');
  await page.locator('[data-action="extract-facts"]').click();await page.waitForFunction(()=>!state.busy);
  check('Grouped extraction displays review warnings and keeps short skills',(await page.locator('#main').innerText()).includes('Needs categorization')&&(await page.locator('#main').innerText()).includes('Mixed or unclassified')&&(await page.locator('#main').innerText()).includes('SQL'));
  const reviewFact=h.c.rows_('facts').find(f=>f.type==='review');await page.locator(`[data-action="edit-fact"][data-id="${reviewFact.id}"]`).click();
  await page.locator('#fact-form [name="approved"]').check();await page.locator('#fact-form [name="confirmed"]').check();await page.locator('#fact-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);
  check('Browser cannot approve a review-only extraction',(await page.locator('#toast').textContent()).includes('specific fact category')&&!h.c.find_('facts',reviewFact.id).approved);
  await page.locator('#fact-form [name="type"]').selectOption('experience');await page.locator('#fact-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);
  check('Reviewed and recategorized extraction can be explicitly approved',h.c.find_('facts',reviewFact.id).approved);
  await page.locator('[data-action="new-fact"]').click();await page.locator('#fact-form [name="type"]').selectOption('skill');await page.locator('#fact-form [name="statement"]').fill('Financial modeling and company valuation research');await page.locator('#fact-form [name="evidence"]').fill('Fictional QA CV');await page.locator('#fact-form [name="approved"]').check();await page.locator('#fact-form [name="confirmed"]').check();await page.locator('#fact-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);check('Browser can save an explicitly approved fact',h.c.approvedFacts_().some(f=>f.statement==='Financial modeling and company valuation research'));
  await navigate('jobs');await page.locator('#job-search').fill('Valuation');check('Job search filters cards',await page.locator('.job-card').count()<=1);await page.locator('#job-search').fill('');
  await page.locator('[data-action="import-job"]').click();const form=page.locator('#import-form');await form.locator('[name="company"]').fill('Fictional QA Employer');await form.locator('[name="title"]').fill('Financial analyst');await form.locator('[name="location"]').fill('Mumbai');await form.locator('[name="url"]').fill('https://example.com/qa-analyst');await form.locator('[name="description"]').fill('Required financial modeling and company valuation research. You will support financial statement analysis and transaction diligence. Direct FDD experience is preferred, not essential.');await form.locator('[name="officialEmployerSource"]').check();await form.locator('[name="confirmedOpen"]').check();await form.locator('button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);
  check('Manual import appears with user-confirmed evidence',(await page.locator('#dialog-content').innerText()).includes('User-confirmed employer listing'));
  const imported=h.c.rows_('jobs').find(j=>j.company==='Fictional QA Employer');await page.locator(`#detail-dialog [data-action="prepare"]`).click();await page.waitForFunction(()=>!state.busy);
  const application=h.c.applicationForJob_(imported.id);check('Manual job produces a local application packet without AI',application?.draftingMode==='Local factual draft');
  const appForm=page.locator('#application-form');await appForm.locator('[data-question="0"]').fill('30 days');await appForm.locator('[data-question="1"]').fill('User will verify work authorization before submission.');await appForm.locator('[name="coverLetter"]').fill(application.coverLetter+'\nA reviewed personal edit.');await page.locator('[data-action="close"]').click();
  await navigate('pipeline');await page.locator(`[data-action="application"][data-id="${application.id}"]`).click();check('Unsaved application edits survive close/reopen',(await page.locator('#application-form [name="coverLetter"]').inputValue()).includes('A reviewed personal edit.'));
  await page.locator('#application-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);check('Application screening answers are saved',h.c.find_('applications',application.id).status==='ready');
  await page.locator('[data-action="send-application"]').click();await page.waitForFunction(()=>!state.busy);check('Send is blocked when approval checkbox is unchecked',h.mails.length===0&&(await page.locator('#toast').textContent()).includes('approval'));
  await page.locator('#status-form [name="proof"]').fill('Fictional QA confirmation: form submission recorded by user.');await page.locator('#status-form [name="approved"]').check();await page.locator('#status-form button[type="submit"]').click();await page.waitForFunction(()=>!state.busy);check('Confirmed external submission is recorded without sending mail',h.c.find_('applications',application.id).status==='submitted_external'&&h.mails.length===0);
  await page.locator('[data-action="close"]').click();await navigate('overview');await page.screenshot({path:'artifacts/dashboard-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'artifacts/dashboard-mobile.png',fullPage:true});
  check('No browser JavaScript errors',errors.length===0);
  fs.writeFileSync('artifacts/browser-report.json',JSON.stringify({passed:results.length,checks:results,errors,scope:'Real Chromium and client code; Google services mocked; fictional data only.'},null,2));
  console.log(`${results.length} browser checks passed. No real email, AI processing, or application submission occurred.`);
}finally{await browser?.close();server.kill('SIGTERM');}
