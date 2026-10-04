import fs from 'node:fs';
import http from 'node:http';
import {demoData} from './demo-data.mjs';

const host='127.0.0.1',port=Number(process.env.JOB_HELPER_PREVIEW_PORT||4173);
const server=http.createServer((request,response)=>{
  if(request.url!=='/'&&request.url!=='/index.html'){response.writeHead(404);response.end('Not found');return;}
  const data=JSON.stringify(demoData()).replace(/</g,'\\u003c');
  const bridge=`<script>window.__JOB_HELPER_DEMO__=true;window.google={script:{get run(){let ok=()=>{},fail=()=>{};return {withSuccessHandler(f){ok=f;return this},withFailureHandler(f){fail=f;return this},api(action,payload){setTimeout(()=>{if(action==='bootstrap'){ok(${data})}else if(action==='assessJob'){ok({demo:true})}else{fail({message:'Local preview only. No live backend, email, job scan, or application submission is connected.'})}},30)}}}}};</script>`;
  const html=fs.readFileSync('Index.html','utf8').replace("<?!= include_('Styles'); ?>",()=>fs.readFileSync('Styles.html','utf8')).replace("<?!= include_('Client'); ?>",()=>bridge+fs.readFileSync('Client.html','utf8'));
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);
});
server.listen(port,host,()=>console.log(`Local design preview listening on port ${port}; fictional data only.`));
