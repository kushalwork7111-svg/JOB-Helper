import fs from 'node:fs';
import vm from 'node:vm';
const clone = x => JSON.parse(JSON.stringify(x));
export function harness() {
  const data = Object.fromEntries(['settings','profile','facts','documents','jobs','applications','reminders','activity'].map(t => [t, new Map()]));
  const properties = new Map(), mails = [], requests = [], triggers = [];
  const context = vm.createContext({console, Intl, Date, JSON, Number, Object, Array, String, Math,
    PropertiesService: {getScriptProperties: () => ({getProperty: k => properties.get(k) || null, setProperty(k,v){properties.set(k,v);return this;}})},
    Session: {getActiveUser: () => ({getEmail: () => 'owner@example.com'}),getEffectiveUser: () => ({getEmail: () => 'owner@example.com'})},
    LockService: {getScriptLock: () => ({tryLock: () => true,releaseLock(){}}),getUserLock: () => ({tryLock: () => true,releaseLock(){}})},
    Utilities: {getUuid: (()=>{let i=0;return()=>`00000000-0000-0000-0000-${String(++i).padStart(12,'0')}`;})(),formatDate: () => new Date().toISOString().slice(0,10)},
    MailApp: {sendEmail: mail => mails.push(clone(mail)),getRemainingDailyQuota: () => 100},
    ScriptApp: {getProjectTriggers: () => triggers,deleteTrigger: t => triggers.splice(triggers.indexOf(t),1),newTrigger: handler => {
      const builder={timeBased(){return this;},atHour(){return this;},everyDays(){return this;},inTimezone(){return this;},create(){const t={getHandlerFunction:()=>handler,getUniqueId:()=>String(triggers.length+1)};triggers.push(t);return t;}};return builder;
    },getService: () => ({getUrl: () => 'https://script.google.com/macros/s/example/exec'}),getOAuthToken: () => 'mock-oauth'},
    UrlFetchApp: {fetch: (url, options) => {requests.push({url,options});return {getResponseCode: () => 200,getContentText: () => '{}'};}}
  });
  for (const file of ['Core.gs','Store.gs','Candidates.gs','Imports.gs','Refinements.gs','PrivateDrive.gs','Documents.gs','DocumentFormat.gs','Integrations.gs','Jobs.gs','Applications.gs','Automation.gs','Code.gs']) vm.runInContext(fs.readFileSync(file,'utf8'), context, {filename:file});
  context.rows_ = name => [...data[name].values()].map(clone);
  context.find_ = (name,id) => data[name].has(id) ? clone(data[name].get(id)) : null;
  context.putUnlocked_ = (name,record) => {data[name].set(record.id,clone(record));return clone(record);};
  context.put_ = context.putUnlocked_;
  context.activity_ = (type,message) => context.put_('activity',{id:String(data.activity.size),type,message,at:new Date().toISOString()});
  const prefs = context.settings_({roles:['Financial analyst'],locations:['Mumbai'],minimumSalary:1000000,salaryCurrency:'INR',externalSendingEnabled:true});
  context.put_('settings',{id:'preferences',value:prefs});
  const profile={id:'cv',name:'Sample Candidate',email:'owner@example.com',cvText:'Built financial models and analyzed company valuation for investment research.',skills:['financial models','valuation'],experience:[]};
  context.put_('profile',profile);
  return {c:context,data,properties,mails,requests,prefs,profile};
}
export function job(overrides={}) {
  return {id:'greenhouse:example:123',source:{type:'greenhouse',board:'example',company:'Example Employer'},sourceJobId:'123',
    title:'Financial analyst',company:'Example Employer',location:'Mumbai',description:'Required financial models and company valuation. FDD experience preferred.',
    url:'https://job-boards.greenhouse.io/example/jobs/123',remote:false,openState:'open',verifiedAt:new Date().toISOString(),postedAt:new Date().toISOString(),
    salary:{min:1200000,max:1800000,currency:'INR',interval:'year'},assessment:{score:85,fit:'strong',confidence:'high',assessedBy:'gemini',summary:'Example fit',gaps:[],evidence:[],preparation:[]},...overrides};
}
export function packet(overrides={}) {
  return {id:'app-123',jobId:'greenhouse:example:123',company:'Example Employer',title:'Financial analyst',status:'ready',
    recipient:'careers@example.com',recipientConfirmed:true,subject:'Application for Financial analyst',coverLetter:'I would like to apply using my financial analysis experience.',
    screeningQuestions:['What is your notice period?'],answers:{'What is your notice period?':'30 days'},outreach:[],notes:'',cvFileId:'',...overrides};
}
export function applicationHarness(overrides={}) {
  const h=harness();h.c.put_('jobs',job());h.c.put_('applications',packet(overrides));h.c.sourceJobs_=()=>({jobs:[job()],complete:true});return h;
}
