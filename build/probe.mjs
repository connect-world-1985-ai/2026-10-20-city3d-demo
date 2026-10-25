// Ad-hoc probe: node probe.mjs out.png "<js run before shot>" [w h]
import {createRequire} from 'module';
const {chromium}=createRequire(import.meta.url)('playwright');
import path from 'path';
const root=path.resolve(import.meta.dirname,'..');
const [out,js,w,h]=process.argv.slice(2);
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage({viewport:{width:+(w||960),height:+(h||540)}});
const logs=[];pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.text());});pg.on('pageerror',e=>logs.push('pageerror: '+e));
await pg.goto('file://'+path.join(root,'index.html')+(process.env.Q||'?q=high'));
await pg.waitForFunction('window.__ready===true',null,{timeout:300000});
const r=await pg.evaluate('(async()=>{const c=window.__city;c.pause();c.toggleHelp(false);c.setAdaptive(false);document.body.classList.add("hidehud");'+js+'})()');
if(r!==undefined)console.log(JSON.stringify(r));
await pg.screenshot({path:out,timeout:300000});
if(logs.length)console.log(logs.slice(0,20).join('\n'));
await b.close();
