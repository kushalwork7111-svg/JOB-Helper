import fs from 'node:fs';
import vm from 'node:vm';
const files = fs.readdirSync('.').filter(name => name.endsWith('.gs'));
for (const name of files) {
  new vm.Script(fs.readFileSync(name, 'utf8'), {filename: name});
  console.log(`Syntax OK: ${name}`);
}
new vm.Script(fs.readFileSync('Client.html', 'utf8').replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, ''), {filename: 'Client.html'});
const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
if (manifest.webapp.access !== 'MYSELF') throw new Error('Deployment must remain private.');
if (!manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive.file') || manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive')) throw new Error('Drive access must remain limited to files this app creates.');
if (!manifest.dependencies.enabledAdvancedServices.some(s => s.serviceId === 'drive' && s.version === 'v3')) throw new Error('Drive v3 service missing.');
for (const name of ['Styles', 'Client']) {
  if (!fs.readFileSync('Index.html', 'utf8').includes(`include_('${name}')`)) throw new Error(`Missing ${name} include.`);
}
console.log('Client syntax, template includes, and private Apps Script manifest OK.');
