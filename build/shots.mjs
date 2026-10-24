// Review screenshots: node shots.mjs [outDir] [filter]
// Renders a fixed list of cameras so before/after comparisons line up.
import {createRequire} from 'module';
const {chromium}=createRequire(import.meta.url)('playwright');
import path from 'path';
import fs from 'fs';
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.argv[2]||path.join(root,'screenshots'));
const filter=process.argv[3]?new RegExp(process.argv[3]):null;
const query=process.env.Q||'?q=high';
fs.mkdirSync(out,{recursive:true});

// [name, tod, js run against window.__city as c]
export const CAMS=[
  ['01-orbit-dusk','dusk',"c.setMode('orbit');c.setCamera([250,170,330],[0,28,0])"],
  ['02-orbit-closer-dusk','dusk',"c.setMode('orbit');c.setCamera([150,120,200],[0,20,0])"],
  ['03-street-dusk','dusk',"c.setWalk(-150,41.5,-Math.PI/2,0.03)"],
  ['04-orbit-night','night',"c.setMode('orbit');c.setCamera([250,170,330],[0,28,0])"],
  ['05-orbit-day','day',"c.setMode('orbit');c.setCamera([250,170,330],[0,28,0])"],
  ['06-street-day','day',"c.setWalk(-150,41.5,-Math.PI/2,0.03)"],
  ['07-park-day','day',"c.setMode('orbit');c.setCamera([-120,40,-70],[-152,2,-152])"],
  ['08-landmark-dusk','dusk',"c.setMode('orbit');c.setCamera([60,60,90],[0,90,0])"],
  ['09-river-dusk','dusk',"c.setMode('orbit');c.setCamera([160,40,520],[0,30,300])"],
  ['10-street-night','night',"c.setWalk(41.5,-120,0,0.05)"],
  ['11-aerial-day','day',"c.setMode('orbit');c.setCamera([0,620,120],[0,0,0])"],
  ['12-crossing-day','day',"c.setWalk(30,32,-Math.PI*0.75,-0.08)"],
];

const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage({viewport:{width:1280,height:720}});
const logs=[];
pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text());});
pg.on('pageerror',e=>logs.push('pageerror: '+e));
const t0=Date.now();
await pg.goto('file://'+path.join(root,'index.html')+query);
await pg.waitForFunction('window.__ready===true',null,{timeout:300000});
const boot=(Date.now()-t0)/1000;
const C=s=>pg.evaluate('(()=>{const c=window.__city;'+s+'})()');
await C('c.pause();c.toggleHelp(false);c.setAdaptive&&c.setAdaptive(false)');
for(const [name,tod,js] of CAMS){
  if(filter&&!filter.test(name))continue;
  await C(`c.setTod('${tod}',true);${js}`);
  await C('c.step(14,0.016)');
  await pg.screenshot({path:path.join(out,name+'.png'),timeout:300000});
  const st=await C('return c.state()');
  console.log(name,`calls=${st.calls} tris=${(st.tris/1000).toFixed(0)}k`);
}
console.log('boot',boot.toFixed(1)+'s');
console.log(JSON.stringify(await C('return c.state().stats')));
if(logs.length)console.log('LOGS\n'+logs.slice(0,30).join('\n'));
await b.close();
