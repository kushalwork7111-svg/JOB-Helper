import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const folder=path.dirname(fileURLToPath(import.meta.url));
const dry=process.argv.includes('--check');
const project=path.join(folder,'private-project');
const auth=path.join(folder,'.job-helper-auth.json');
const marker=path.join(folder,'.job-helper-created.json');
const files=['Code.gs','Index.html','appsscript.json'];
for(const file of files) if(!fs.existsSync(path.join(folder,file))) throw new Error('Missing bundled file: '+file);
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'appsscript.json'),'utf8'));
if(manifest.webapp?.access!=='MYSELF'||manifest.webapp?.executeAs!=='USER_DEPLOYING') throw new Error('Refusing a non-private deployment.');
if(Number(process.versions.node.split('.')[0])<20) throw new Error('Install Node.js 20 or newer from https://nodejs.org first.');
if(dry){console.log('Installer bundle checked: owner-only manifest, required files, Node version. No login or Google changes performed.');process.exit(0);}
console.log('Creates a NEW private Job Helper project. Does not access DVCS. Sign in with the account that will own this app.');
console.log('If Google says Apps Script API is disabled, enable it at https://script.google.com/home/usersettings and run this installer again.');
console.log('Google clasp asks for development permissions to create/upload/deploy scripts. Review its consent screen. Credentials stay on this computer; never send this folder or tokens to anyone.');
fs.mkdirSync(project,{recursive:true});
function clasp(args){
 const windowsCli=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
 if(process.platform==='win32'&&!fs.existsSync(windowsCli)) throw new Error('Use the standard Node.js installer from nodejs.org, including npm.');
 const command=process.platform==='win32'?process.execPath:'npm';
 const prefix=process.platform==='win32'?[windowsCli]:[];
 const result=spawnSync(command,[...prefix,'exec','--yes','--package=@google/clasp@3.4.1','--','clasp','--auth',auth,...args],{cwd:project,stdio:'inherit',shell:false});
 if(result.error) throw result.error;
 if(result.status!==0){console.error('Stopped safely. Fix the displayed issue and run again. No existing project will be selected.');process.exit(result.status||1);}
}
if(!fs.existsSync(auth)) clasp(['login']);
const config=path.join(project,'.clasp.json');
if(fs.existsSync(config)&&!fs.existsSync(marker)) throw new Error('Unrecognized project configuration. Use a freshly extracted installer folder; existing projects are never adopted.');
if(!fs.existsSync(config)){
 if(fs.existsSync(marker)) throw new Error('Project configuration was removed. Restore it; refusing to create an accidental duplicate.');
 clasp(['create','--type','standalone','--title','Job Helper — Private']);
 const created=JSON.parse(fs.readFileSync(config,'utf8'));
 fs.writeFileSync(marker,JSON.stringify({scriptId:created.scriptId},null,2),{mode:0o600});
}
const saved=JSON.parse(fs.readFileSync(marker,'utf8'));
if(JSON.parse(fs.readFileSync(config,'utf8')).scriptId!==saved.scriptId) throw new Error('Project ID changed. Refusing to upload.');
for(const file of files) fs.copyFileSync(path.join(folder,file),path.join(project,file));
fs.writeFileSync(path.join(project,'.claspignore'),'**/**\n!Code.gs\n!Index.html\n!appsscript.json\n');
clasp(['push','--force']);
if(!fs.existsSync(path.join(folder,'.job-helper-deployed'))){
 clasp(['deploy','--description','Job Helper private local-first pilot']);
 fs.writeFileSync(path.join(folder,'.job-helper-deployed'),'Private pilot deployed.\n');
}
console.log('Uploaded. In the editor select setupJobHelper and click Run, then approve the app permissions. The manifest already includes Drive v3. Open Deploy > Manage deployments to copy your private web-app URL. No billing or AI key is required.');
clasp(['open-script']);
