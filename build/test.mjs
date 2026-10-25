// Smoke test: node test.mjs  (boots the page, drives the UI and checks state)
import {createRequire} from 'module';
const {chromium}=createRequire(import.meta.url)('playwright');
import path from 'path';
const root=path.resolve(import.meta.dirname,'..');
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage({viewport:{width:640,height:360}});
const errors=[];pg.on('pageerror',e=>errors.push(String(e)));pg.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await pg.goto('file://'+path.join(root,'index.html')+'?q=medium');
await pg.waitForFunction('window.__ready===true',null,{timeout:300000});
const C=s=>pg.evaluate('(()=>{const c=window.__city;'+s+'})()');
let fails=0;const ok=(name,cond,info='')=>{console.log((cond?'PASS':'FAIL')+'  '+name+(info?'  '+info:''));if(!cond)fails++;};
await C('c.pause();window.__noLock=true');
await pg.click('#startbtn');
ok('help closes',await pg.evaluate(()=>getComputedStyle(document.querySelector('#help')).display==='none'));
// time of day
await pg.keyboard.press('Digit3');await C('c.step(12,0.25)');
let st=await C('return c.state()');ok('key 3 -> night',Math.abs(st.hour-22)<.05,'hour='+st.hour.toFixed(2));
await pg.keyboard.press('Digit1');await C('c.step(14,0.25)');
st=await C('return c.state()');ok('key 1 -> day',Math.abs(st.hour-12.5)<.05,'hour='+st.hour.toFixed(2));
await pg.evaluate(()=>{const s=document.querySelector('#hour');s.value='7.5';s.dispatchEvent(new Event('input'));});
st=await C('return c.state()');ok('slider sets hour',Math.abs(st.hour-7.5)<.01);
await pg.keyboard.press('KeyL');await C('c.step(10,0.5)');
st=await C('return c.state()');ok('L plays the day',st.hour>7.6,'hour='+st.hour.toFixed(2));await pg.keyboard.press('KeyL');
// modes
await pg.keyboard.press('KeyM');st=await C('return c.state()');ok('M -> walk',st.mode==='walk');
await C('c.setWalk(-150,41.5,-Math.PI/2,0)');
const p0=(await C('return c.state()')).player;
await C("c.key('KeyW',true);c.sim(90,1/60);c.key('KeyW',false)");
const p1=(await C('return c.state()')).player;
ok('W walks forward',Math.hypot(p1.x-p0.x,p1.z-p0.z)>6,`moved ${Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(1)} m`);
// collision: walk at a building for 5 s and make sure we never end up inside one
const inside=await C(`const B=c.cityObj.buildings.find(b=>b.x1-b.x0>12&&!b.landmark);const cx=(B.x0+B.x1)/2,cz=B.z1+3;c.setWalk(cx,cz,0,0);c.key('KeyW',true);c.sim(300,1/60);c.key('KeyW',false);const p=c.state().player;return p.x>B.x0+.1&&p.x<B.x1-.1&&p.z>B.z0+.1&&p.z<B.z1-.1`);
ok('buildings are solid',!inside);
const onBridge=await C("c.setWalk(38,470,0,0);return c.state().player.y");ok('bridge deck is walkable',onBridge>5,'y='+onBridge.toFixed(2));
const river=await C("c.setWalk(-200,470,0,0);const p=c.state().player;return p.z");ok('river pushes you back',river<376||river>566,'z='+river.toFixed(1));
await pg.keyboard.press('KeyM');st=await C('return c.state()');ok('M -> orbit',st.mode==='orbit');
// tour, photo, quality
await pg.keyboard.press('KeyT');await C('c.step(20,0.1)');
const cam1=(await C('return c.state()')).camera;await C('c.step(20,0.1)');const cam2=(await C('return c.state()')).camera;
ok('T tour moves the camera',Math.hypot(cam2[0]-cam1[0],cam2[1]-cam1[1],cam2[2]-cam1[2])>3);
await pg.keyboard.press('KeyT');
await pg.keyboard.press('KeyP');ok('P photo mode',await pg.evaluate(()=>document.body.classList.contains('photo')));await pg.keyboard.press('KeyP');
const q0=(await C('return c.state()')).quality;await pg.keyboard.press('KeyQ');const q1=(await C('return c.state()')).quality;ok('Q cycles quality',q0!==q1,q0+' -> '+q1);
// minimap teleport
const box=await pg.locator('#minimap').boundingBox();await pg.mouse.click(box.x+box.width*.5,box.y+box.height*.3);
st=await C('return c.state()');ok('mini-map click teleports',st.mode==='walk',`(${st.player.x.toFixed(0)}, ${st.player.z.toFixed(0)})`);
// traffic: cars should both stop (red lights / queues) and move
const tr=await C(`const W=c.cityObj.W;let stopped=0,moving=0;for(let i=0;i<120;i++){c.cityObj.update(0.1,100+i*0.1,{x:0,y:0,z:0});}for(const car of W.cars){if(car.v<.2)stopped++;else if(car.v>3)moving++;}return [stopped,moving,W.cars.length]`);
ok('traffic moves and stops',tr[0]>5&&tr[1]>50,`stopped ${tr[0]}, moving ${tr[1]} of ${tr[2]}`);
ok('no page errors',errors.length===0,errors.slice(0,3).join(' | '));
await b.close();
console.log(fails?`${fails} FAILED`:'all passed');
process.exit(fails?1:0);
