import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {patchFog,makeComposer} from './post.js';
import {buildCity,makeUniforms,BLOCK,N,EDGE,WALK_OUT,RIVER_Z0,RIVER_Z1,BRIDGE_X,bc} from './city.js';
import {makeSky,applySky,makeClouds} from './sky.js';
import {makeState,evalTod,TOD_PRESETS} from './tod.js';
import {PARK_THEME} from './layout.js';

patchFog();
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const canvas=$('#c');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false});}
catch(e){$('#nogl').style.display='flex';$('#loading').style.display='none';throw e;}
const isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
const prParam=params.get('pr')?+params.get('pr'):9;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,prParam));
renderer.setSize(innerWidth,innerHeight,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.info.autoReset=false;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xffffff,.001);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.3,4200);
camera.rotation.order='YXZ';
camera.layers.enable(1);

/* ---------- lights & sky ---------- */
const sky=makeSky();scene.add(sky);
const hemi=new THREE.HemisphereLight(0xffffff,0x444444,1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,3);
sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.bias=-.00035;sun.shadow.normalBias=.4;sun.shadow.radius=2.5;
sun.shadow.camera.near=10;sun.shadow.camera.far=1600;
scene.add(sun,sun.target);
const U=makeUniforms();
const S=makeState();
const envScene=new THREE.Scene(),envSky=makeSky();envScene.add(envSky);
let pmrem,envRT=null,bakedHour=-99,lastBake=0;

/* ---------- state ---------- */
let city,clouds,post;
let hour=TOD_PRESETS.dusk,playing=false,tween=null;
let mode='orbit',bloomOn=true,quality=1,autoAdapt=true,helpOpen=true,photo=false,tour=null;
let elapsed=0;
const QUALITY=[
  {name:'Ultra',pr:2,shadow:4096,ao:'full',refl:2,bloom:1,shaft:1,people:220,lod:1.35},
  {name:'High',pr:1.5,shadow:4096,ao:'half',refl:3,bloom:1,shaft:1,people:150,lod:1},
  {name:'Medium',pr:1.25,shadow:2048,ao:'off',refl:0,bloom:1,shaft:0,people:100,lod:.8},
  {name:'Low',pr:1,shadow:1024,ao:'off',refl:0,bloom:0,shaft:0,people:60,lod:.6}];
const qParam=params.get('q');
if(qParam){const k={ultra:0,high:1,medium:2,low:3}[qParam];if(k!==undefined){quality=k;autoAdapt=false;}}
else if(isTouch)quality=2;

/* ---------- boot ---------- */
const loadMsg=$('#loading');
function boot(){
  const t0=performance.now();
  city=buildCity({U,aniso:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
  scene.add(city.root);
  clouds=makeClouds(U,scene.fog);scene.add(clouds.clouds,clouds.balloons);
  pmrem=new THREE.PMREMGenerator(renderer);
  post=makeComposer(renderer,scene,camera,renderer.getPixelRatio());
  city.stats.buildMs=Math.round(performance.now()-t0);
  initApp();
}

/* ---------- time of day ---------- */
const _v=new THREE.Vector3(),_c=new THREE.Color();
function applyTod(){
  evalTod(S,hour);
  sun.color.copy(S.sunCol);sun.intensity=S.sunInt;
  hemi.color.copy(S.hemiSky);hemi.groundColor.copy(S.hemiGround);hemi.intensity=S.hemiInt;
  scene.fog.color.copy(S.fogCol);scene.fog.density=S.fogDen;
  scene.environmentIntensity=S.envInt;
  renderer.toneMappingExposure=S.expo;
  applySky(sky.material.uniforms,S,S.sunDir,S.moonDir);
  U.uLit.value=S.lit;U.uDayIn.value=S.dayIn;U.uNight.value=S.night;U.uLamp.value=S.lamp;U.uHead.value=S.head;U.uDay.value=1-S.night;
  const m=city.mats;
  m.bulb.color.setRGB(1,.8,.55).multiplyScalar(.3+S.lamp*5);
  m.pool.color.setRGB(1,.72,.48).multiplyScalar(S.lamp*.55);m.pool.visible=S.lamp>.01;
  m.beam.color.setRGB(1,.9,.75).multiplyScalar(S.head*.45);
  m.sign.emissiveIntensity=.35+S.lit*1.7;
  if(m.billboard)m.billboard.emissiveIntensity=.3+S.night*1.5;
  m.ad.emissiveIntensity=.35+S.night*1.3;
  m.crown.color.setScalar(.45+S.night*2.6);
  m.wheelBulb.color.setScalar(.4+S.lamp*5);
  const b=post.bloom;b.strength=S.bloomS;b.radius=S.bloomR;b.threshold=S.bloomT;
  const g=post.grade.uniforms;g.uSat.value=S.sat;g.uVign.value=S.vign;g.uTint.value.copy(S.tint);g.uShaftCol.value.copy(S.discCol);
  post.ao.blendIntensity=.95-.45*S.night;
  const w=city.water.u;w.uSunDir.value.copy(S.lightDir);w.uSunCol.value.copy(S.sunCol).multiplyScalar(S.sunInt*.45);
  w.uHor.value.copy(S.hor);w.uZen.value.copy(S.mid);w.uAmb.value=.12+.8*(1-S.night);
  if(sky)sky.material.uniforms.time.value=elapsed;
  updateClock();
}
function bakeEnv(force){
  const now=performance.now();
  let d=Math.abs(hour-bakedHour);d=Math.min(d,24-d);
  if(!force&&(d<.2||now-lastBake<350))return;
  applySky(envSky.material.uniforms,S,S.sunDir,S.moonDir,3);
  envSky.material.uniforms.stars.value=0;
  const rt=pmrem.fromScene(envScene,0,.1,100);
  scene.environment=rt.texture;if(envRT)envRT.dispose();envRT=rt;bakedHour=hour;lastBake=now;
}
function setHour(h,instant=true){hour=((h%24)+24)%24;tween=null;applyTod();bakeEnv(instant);}
function setTod(name,instant){
  const target=typeof name==='number'?name:TOD_PRESETS[name];if(target===undefined)return;
  document.querySelectorAll('#tods button').forEach(b=>b.classList.toggle('on',b.dataset.tod===name));
  if(instant){setHour(target,true);return;}
  const d=((target-hour)%24+24)%24;tween={from:hour,d,t:0,dur:1.2+d*.12};
}
function updateClock(){
  const h=Math.floor(hour),mi=Math.floor((hour-h)*60);
  $('#clock').textContent=String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');
  if(document.activeElement!==$('#hour'))$('#hour').value=hour;
}

/* ---------- shadow focus ---------- */
const _r=new THREE.Vector3(),_u=new THREE.Vector3(),_f=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
function updateShadow(focus,ext){
  const cam=sun.shadow.camera,dir=S.lightDir;
  if(cam.right!==ext){cam.left=-ext;cam.right=ext;cam.top=ext;cam.bottom=-ext;cam.updateProjectionMatrix();}
  _r.crossVectors(_up,dir).normalize();_u.crossVectors(dir,_r).normalize();
  const texel=2*ext/sun.shadow.mapSize.x;
  const a=Math.round(focus.dot(_r)/texel)*texel,b=Math.round(focus.dot(_u)/texel)*texel,c=focus.dot(dir);
  _f.set(0,0,0).addScaledVector(_r,a).addScaledVector(_u,b).addScaledVector(dir,c);
  sun.target.position.copy(_f);sun.position.copy(_f).addScaledVector(dir,800);
  sun.target.updateMatrixWorld();
}

/* ---------- walk controls ---------- */
const player={pos:new THREE.Vector3(2,0,40),vy:0,vx:0,vz:0,yaw:Math.PI,pitch:-.05,onGround:true,camY:1.7,bob:0,fov:68};
const keys=new Set();
let locked=false,dragging=false,jumpQueued=false;
const joy={id:null,x:0,y:0},look={id:null,lx:0,ly:0};
function lockPointer(){try{const p=canvas.requestPointerLock&&canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
let skipMoves=0;
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;skipMoves=3;updateHints();});
canvas.addEventListener('mousedown',()=>{stopTour();if(mode!=='walk'||helpOpen)return;dragging=true;if(!locked&&!isTouch)lockPointer();});
window.addEventListener('mouseup',()=>dragging=false);
window.addEventListener('mousemove',e=>{
  if(mode!=='walk'||helpOpen)return;
  if(locked&&skipMoves>0){skipMoves--;return;}
  if(Math.abs(e.movementX)>250||Math.abs(e.movementY)>250)return;
  if(locked||dragging){player.yaw-=e.movementX*.0022;player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.0022,-1.5,1.5);}
});
canvas.addEventListener('wheel',()=>stopTour(),{passive:true});
window.addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT'&&e.target.type!=='range')return;
  if(e.code==='KeyH'){toggleHelp();return;}
  if(e.code==='Escape'&&helpOpen){toggleHelp(false);return;}
  if(helpOpen&&e.code==='Enter'){toggleHelp(false);return;}
  if(helpOpen)return;
  if(e.code!=='KeyT'&&e.code!=='KeyV'&&e.code!=='KeyP')stopTour();
  if(e.code==='KeyM'||e.code==='Tab'){e.preventDefault();setMode(mode==='walk'?'orbit':'walk');return;}
  if(e.code==='Digit1')setTod('day');else if(e.code==='Digit2')setTod('dusk');else if(e.code==='Digit3')setTod('night');else if(e.code==='Digit4')setTod('dawn');
  else if(e.code==='KeyB')toggleBloom();
  else if(e.code==='KeyV')document.body.classList.toggle('hidehud');
  else if(e.code==='KeyT')toggleTour();
  else if(e.code==='KeyP')togglePhoto();
  else if(e.code==='KeyL')togglePlay();
  else if(e.code==='KeyQ')setQuality((quality+1)%4,true);
  else if(e.code==='BracketLeft')setHour(hour-.25,false);else if(e.code==='BracketRight')setHour(hour+.25,false);
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)jumpQueued=true;}
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();dragging=false;});
function touchStart(e){
  stopTour();
  if(mode!=='walk'||helpOpen)return;
  for(const t of e.changedTouches){
    if(t.target.id==='jumpbtn'){jumpQueued=true;continue;}
    if(t.target.closest&&t.target.closest('#hud,#minimap'))continue;
    if(t.clientX<innerWidth*.45&&joy.id===null){joy.id=t.identifier;joy.x=joy.y=0;}
    else if(look.id===null){look.id=t.identifier;look.lx=t.clientX;look.ly=t.clientY;}
  }
}
function touchMove(e){
  if(mode!=='walk')return;
  for(const t of e.changedTouches){
    if(t.identifier===joy.id){const r=$('#joy').getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(t.clientX-cx)/50,dy=(t.clientY-cy)/50;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}joy.x=dx;joy.y=dy;$('#joy i').style.transform=`translate(${dx*30}px,${dy*30}px)`;}
    else if(t.identifier===look.id){player.yaw-=(t.clientX-look.lx)*.005;player.pitch=THREE.MathUtils.clamp(player.pitch-(t.clientY-look.ly)*.005,-1.5,1.5);look.lx=t.clientX;look.ly=t.clientY;}
  }
  if(!(e.target&&e.target.type==='range'))e.preventDefault();
}
function touchEnd(e){for(const t of e.changedTouches){if(t.identifier===joy.id){joy.id=null;joy.x=joy.y=0;$('#joy i').style.transform='';}if(t.identifier===look.id)look.id=null;}}
window.addEventListener('touchstart',touchStart,{passive:false});window.addEventListener('touchmove',touchMove,{passive:false});window.addEventListener('touchend',touchEnd);window.addEventListener('touchcancel',touchEnd);

const _fwd=new THREE.Vector3();
function updateWalk(dt){
  const k=c=>keys.has(c);
  let f=(k('KeyW')||k('ArrowUp')?1:0)-(k('KeyS')||k('ArrowDown')?1:0)-joy.y;
  let s=(k('KeyD')||k('ArrowRight')?1:0)-(k('KeyA')||k('ArrowLeft')?1:0)+joy.x;
  const run=k('ShiftLeft')||k('ShiftRight')||Math.hypot(joy.x,joy.y)>.92;
  const l=Math.hypot(f,s);if(l>1){f/=l;s/=l;}
  const sp=run?11:5.4,sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
  const tx=(-sy*f+cy*s)*sp,tz=(-cy*f-sy*s)*sp;
  const a=1-Math.exp(-(player.onGround?14:3)*dt);
  player.vx+=(tx-player.vx)*a;player.vz+=(tz-player.vz)*a;
  if(jumpQueued&&player.onGround){player.vy=7.4;player.onGround=false;}
  jumpQueued=false;player.vy-=24*dt;
  player.pos.x+=player.vx*dt;player.pos.z+=player.vz*dt;player.pos.y+=player.vy*dt;
  for(let i=0;i<3;i++)if(!city.resolve(player.pos,.45))break;
  player.pos.x=THREE.MathUtils.clamp(player.pos.x,-1300,1300);player.pos.z=THREE.MathUtils.clamp(player.pos.z,-1300,1300);
  const g=city.groundAt(player.pos.x,player.pos.z);
  if(player.pos.y<=g||(player.onGround&&player.pos.y-g<.6&&player.vy<=0)){player.pos.y=g;player.vy=0;player.onGround=true;}else if(player.pos.y>g+.05)player.onGround=false;
  const speed=Math.hypot(player.vx,player.vz);
  if(player.onGround&&speed>.5)player.bob+=speed*dt*1.7;
  const bob=player.onGround?Math.sin(player.bob)*Math.min(speed/sp,1)*.045*(speed>.5?1:0):0;
  player.camY+=((player.pos.y+1.7)-player.camY)*(1-Math.exp(-16*dt));
  camera.position.set(player.pos.x,player.camY+bob,player.pos.z);
  camera.rotation.set(player.pitch,player.yaw,0);
  const tf=run&&speed>6?75:68;player.fov+=(tf-player.fov)*(1-Math.exp(-6*dt));
  if(Math.abs(camera.fov-player.fov)>.01){camera.fov=player.fov;camera.updateProjectionMatrix();}
}

/* ---------- orbit controls ---------- */
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=10;controls.maxDistance=1300;controls.maxPolarAngle=Math.PI/2-.03;
controls.zoomSpeed=.9;controls.rotateSpeed=.6;controls.panSpeed=.8;controls.screenSpacePanning=false;
controls.autoRotate=true;controls.autoRotateSpeed=.4;
controls.target.set(0,32,30);camera.position.set(260,165,340);
controls.addEventListener('start',()=>{controls.autoRotate=false;stopTour();});
controls.update();

function setMode(m){
  if(m===mode)return;
  mode=m;
  document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  if(m==='walk'){
    controls.enabled=false;controls.autoRotate=false;
    const t=controls.target;player.pos.set(t.x,0,t.z);
    camera.getWorldDirection(_fwd);player.yaw=Math.atan2(-_fwd.x,-_fwd.z);player.pitch=-.05;
    for(let i=0;i<4;i++)if(!city.resolve(player.pos,.45))break;
    player.pos.y=city.groundAt(player.pos.x,player.pos.z);player.camY=player.pos.y+1.7;player.vx=player.vz=player.vy=0;player.onGround=true;
    camera.fov=player.fov=68;camera.updateProjectionMatrix();
    if(!isTouch&&!window.__noLock)lockPointer();
  }else{
    if(document.pointerLockElement)document.exitPointerLock();
    controls.enabled=true;
    const back=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw));
    controls.target.set(player.pos.x,player.pos.y+4,player.pos.z);
    camera.position.set(player.pos.x+back.x*38,player.pos.y+30,player.pos.z+back.z*38);
    camera.fov=60;camera.updateProjectionMatrix();controls.update();
  }
  updateHints();
}
function teleport(x,z,yaw){
  if(mode!=='walk'){controls.target.set(x,0,z);setMode('walk');}
  player.pos.set(x,0,z);for(let i=0;i<4;i++)if(!city.resolve(player.pos,.45))break;
  player.pos.y=city.groundAt(player.pos.x,player.pos.z);player.camY=player.pos.y+1.7;player.vx=player.vz=0;
  if(yaw!==undefined)player.yaw=yaw;
}
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
canvas.addEventListener('dblclick',e=>{
  if(mode!=='orbit'||helpOpen)return;
  ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  const o=ray.ray.origin,d=ray.ray.direction;if(d.y>=-1e-4)return;
  const t=-o.y/d.y;if(t<0||t>3000)return;
  controls.target.set(o.x+d.x*t,0,o.z+d.z*t);setMode('walk');
});

/* ---------- cinematic tour ---------- */
const TOUR=[ // [camera position, look target]
  [[420,260,560],[0,40,60]],[[260,90,640],[40,20,470]],[[120,30,520],[38,12,420]],[[-60,24,400],[-200,18,380]],
  [[-260,40,250],[-152,20,152]],[[-200,22,-40],[-152,10,-152]],[[-80,10,-160],[-40,6,-152]],[[30,4.5,-120],[38,6,-40]],
  [[38,9,10],[0,90,0]],[[50,150,60],[0,175,0]],[[-70,215,-40],[0,190,0]],[[150,120,-260],[152,24,-152]],[[300,200,-60],[0,30,40]],[[420,260,560],[0,40,60]]];
const tourPos=new THREE.CatmullRomCurve3(TOUR.map(t=>new THREE.Vector3(...t[0])),false,'centripetal');
const tourTgt=new THREE.CatmullRomCurve3(TOUR.map(t=>new THREE.Vector3(...t[1])),false,'centripetal');
function toggleTour(on){
  on=on===undefined?!tour:on;
  if(on){if(mode!=='orbit')setMode('orbit');tour={t:0,dur:95};controls.enabled=false;controls.autoRotate=false;}
  else stopTour();
  $('#tourbtn').classList.toggle('on',!!tour);
}
function stopTour(){if(!tour)return;tour=null;controls.enabled=mode==='orbit';$('#tourbtn').classList.remove('on');}
function updateTour(dt){
  tour.t+=dt/tour.dur;if(tour.t>=1)tour.t=0;
  const u=tour.t;
  tourPos.getPointAt(u,camera.position);tourTgt.getPointAt(Math.min(1,u+.004),controls.target);
  camera.lookAt(controls.target);
}

/* ---------- UI ---------- */
function toggleHelp(v){helpOpen=v===undefined?!helpOpen:v;$('#help').style.display=helpOpen?'flex':'none';if(helpOpen){keys.clear();if(document.pointerLockElement)document.exitPointerLock();}else{canvas.focus();}updateHints();}
function toggleBloom(){bloomOn=!bloomOn;post.bloom.enabled=bloomOn&&QUALITY[quality].bloom;$('#bloombtn').classList.toggle('on',bloomOn);}
function togglePhoto(v){photo=v===undefined?!photo:v;document.body.classList.toggle('photo',photo);$('#photobtn').classList.toggle('on',photo);}
function togglePlay(v){playing=v===undefined?!playing:v;$('#playbtn').textContent=playing?'❚❚':'▶';$('#playbtn').classList.toggle('on',playing);}
function updateHints(){
  const b=$('#bottom'),lh=$('#lockhint'),cr=$('#cross');
  if(mode==='walk'){
    b.innerHTML='<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move 移动 · <kbd>Shift</kbd> run 奔跑 · <kbd>Space</kbd> jump 跳 · mouse look 环视 · <kbd>M</kbd> orbit 环绕 · <kbd>[</kbd><kbd>]</kbd> time 时间';
    cr.style.display=(locked||isTouch)&&!helpOpen?'block':'none';
    lh.style.display=(!locked&&!isTouch&&!helpOpen)?'block':'none';
    $('#joy').style.display=isTouch&&!helpOpen?'block':'none';$('#jumpbtn').style.display=isTouch&&!helpOpen?'flex':'none';
  }else{
    b.innerHTML='Drag rotate 拖动旋转 · scroll zoom 缩放 · right-drag pan 平移 · double-click to walk there 双击步行 · <kbd>T</kbd> tour 巡游 · <kbd>P</kbd> photo 摄影';
    cr.style.display='none';lh.style.display='none';$('#joy').style.display=$('#jumpbtn').style.display='none';
  }
}
document.querySelectorAll('#modes button').forEach(b=>b.addEventListener('click',()=>{stopTour();setMode(b.dataset.mode);canvas.focus();}));
document.querySelectorAll('#tods button').forEach(b=>b.addEventListener('click',()=>{setTod(b.dataset.tod);canvas.focus();}));
$('#bloombtn').addEventListener('click',()=>{toggleBloom();canvas.focus();});
$('#helpbtn').addEventListener('click',()=>toggleHelp());
$('#startbtn').addEventListener('click',()=>toggleHelp(false));
$('#help').addEventListener('mousedown',e=>{if(e.target.id==='help')toggleHelp(false);});
$('#jumpbtn').addEventListener('touchstart',e=>{jumpQueued=true;e.preventDefault();},{passive:false});
$('#playbtn').addEventListener('click',()=>{togglePlay();canvas.focus();});
$('#hour').addEventListener('input',e=>{togglePlay(false);setHour(+e.target.value,false);document.querySelectorAll('#tods button').forEach(b=>b.classList.remove('on'));});
$('#hour').addEventListener('change',()=>{bakeEnv(true);canvas.focus();});
$('#tourbtn').addEventListener('click',()=>{toggleTour();canvas.focus();});
$('#photobtn').addEventListener('click',()=>{togglePhoto();canvas.focus();});
$('#qbtn').addEventListener('click',()=>{setQuality((quality+1)%4,true);canvas.focus();});

/* ---------- minimap ---------- */
const mm=$('#mm'),mctx=mm.getContext('2d'),MS=mm.width,MR=430,MCZ=50,MK=MS/(MR*2);
const mx=x=>(x+MR)*MK,mz=z=>(z-MCZ+MR)*MK;
let mmStatic;
function buildMinimap(){
  mmStatic=document.createElement('canvas');mmStatic.width=mmStatic.height=MS;const c=mmStatic.getContext('2d');
  c.fillStyle='#b9e3a6';c.fillRect(0,0,MS,MS);
  c.fillStyle='#8fd8e6';c.fillRect(0,mz(RIVER_Z0),MS,(RIVER_Z1-RIVER_Z0)*MK);
  c.fillStyle='#7d6f78';c.fillRect(mx(-EDGE),mz(-EDGE),EDGE*2*MK,EDGE*2*MK);
  c.fillRect(mx(BRIDGE_X-7),mz(EDGE),14*MK,(RIVER_Z1-EDGE+40)*MK);
  c.fillStyle='#f3e3df';c.fillRect(mx(-WALK_OUT),mz(EDGE),WALK_OUT*2*MK,(RIVER_Z0-EDGE)*MK);c.fillStyle='#7d6f78';c.fillRect(mx(BRIDGE_X-7),mz(EDGE),14*MK,(RIVER_Z0-EDGE)*MK);
  for(const b of city.blocks){
    c.fillStyle=b.park?'#8fd17a':b.district==='center'?'#ffd6e4':'#f3e3df';
    c.beginPath();c.roundRect(mx(b.cx-BLOCK/2),mz(b.cz-BLOCK/2),BLOCK*MK,BLOCK*MK,3);c.fill();
    if(b.theme==='pond'){c.fillStyle='#8fd8e6';c.beginPath();c.ellipse(mx(b.cx),mz(b.cz),15*MK,11*MK,0,0,7);c.fill();}
  }
  for(const b of city.buildings){
    const col=new THREE.Color(b.col[0],b.col[1],b.col[2]).convertLinearToSRGB();
    c.fillStyle='#'+col.getHexString();c.fillRect(mx(b.x0),mz(b.z0),(b.x1-b.x0)*MK,(b.z1-b.z0)*MK);
    c.strokeStyle='rgba(80,50,70,.35)';c.lineWidth=1;c.strokeRect(mx(b.x0),mz(b.z0),(b.x1-b.x0)*MK,(b.z1-b.z0)*MK);
  }
  c.fillStyle='#ff5d8f';c.beginPath();c.arc(mx(0),mz(0),5,0,7);c.fill();
  const w=city.blocks.find(b=>b.theme==='fair');c.fillStyle='#ffd84d';c.beginPath();c.arc(mx(w.cx+4),mz(w.cz),5,0,7);c.fill();
}
function drawMinimap(){
  mctx.drawImage(mmStatic,0,0);
  let x,z,yaw;
  if(mode==='walk'){x=player.pos.x;z=player.pos.z;yaw=player.yaw;}
  else{x=controls.target.x;z=controls.target.z;camera.getWorldDirection(_fwd);yaw=Math.atan2(-_fwd.x,-_fwd.z);}
  mctx.save();mctx.translate(mx(x),mz(z));mctx.rotate(-yaw);
  mctx.fillStyle='rgba(255,93,143,.25)';mctx.beginPath();mctx.moveTo(0,0);mctx.arc(0,0,40,-Math.PI/2-.55,-Math.PI/2+.55);mctx.closePath();mctx.fill();
  mctx.fillStyle=mode==='walk'?'#ff5d8f':'#4fb6ef';mctx.strokeStyle='#fff';mctx.lineWidth=2;
  mctx.beginPath();mctx.moveTo(0,-9);mctx.lineTo(6,7);mctx.lineTo(0,3);mctx.lineTo(-6,7);mctx.closePath();mctx.fill();mctx.stroke();
  mctx.restore();
}
$('#minimap').addEventListener('click',e=>{
  const r=$('#minimap').getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*MS/MK-MR,z=(e.clientY-r.top)/r.height*MS/MK-MR+MCZ;
  stopTour();teleport(x,z);canvas.focus();
});

/* ---------- resize / quality ---------- */
function pixelRatio(){return Math.min(devicePixelRatio||1,QUALITY[quality].pr,prParam);}
function resize(){
  if(!post)return;
  const pr=pixelRatio();
  renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight,false);
  post.composer.setPixelRatio(pr);post.composer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  const Q=QUALITY[quality];
  if(Q.refl){const s=renderer.getDrawingBufferSize(new THREE.Vector2());city.water.setSize(Math.ceil(s.x/Q.refl*1.4),Math.ceil(s.y/Q.refl*1.4));}
  post.grade.uniforms.uRes.value.set(innerWidth*pr,innerHeight*pr);
}
window.addEventListener('resize',resize);
function setQuality(q,manual){
  quality=Math.max(0,Math.min(3,q));if(manual)autoAdapt=false;
  const Q=QUALITY[quality];
  if(sun.shadow.mapSize.x!==Q.shadow){sun.shadow.mapSize.set(Q.shadow,Q.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  post.ao.enabled=Q.ao!=='off';post.ao.halfRes=Q.ao!=='full';
  city.water.setReflect(Q.refl>0);
  post.bloom.enabled=bloomOn&&!!Q.bloom;
  resize();
  $('#qbtn').innerHTML=`${Q.name} 画质<kbd>Q</kbd>`;
}

/* ---------- main loop ---------- */
const clock=new THREE.Clock();
const _foc=new THREE.Vector3(),_sp=new THREE.Vector3();
let fpsSmooth=60,lastStats=0,firstFrame=true,qAcc=0,qN=0,frames=0;
function frame(fixedDt){
  const dt=typeof fixedDt==='number'?fixedDt:Math.min(clock.getDelta(),.05);elapsed+=dt;frames++;
  U.uTime.value=elapsed;
  // time of day
  if(tween){tween.t+=dt/tween.dur;const e=tween.t>=1?1:tween.t*tween.t*(3-2*tween.t);hour=(tween.from+tween.d*e)%24;if(tween.t>=1)tween=null;applyTod();bakeEnv(!tween);}
  else if(playing){hour=(hour+dt*24/240)%24;applyTod();bakeEnv(false);}
  else if(frames%2===0)sky.material.uniforms.time.value=elapsed;
  city.mats.beacon.color.setRGB(1,.1,.12).multiplyScalar(.3+(Math.sin(elapsed*3.2)>.25?1:.1)*(.6+S.night*3));
  if(tour)updateTour(dt);
  else if(mode==='walk')updateWalk(dt);
  else controls.update(dt);
  const Q=QUALITY[quality];
  city.update(dt,elapsed,camera.position,{peopleDist:Q.people,lodScale:Q.lod});
  clouds.update(dt,S);
  // shadows follow the view
  if(mode==='walk'&&!tour){_foc.set(player.pos.x,0,player.pos.z);updateShadow(_foc,90);}
  else{const d=camera.position.distanceTo(controls.target);_foc.copy(controls.target);_foc.y=0;
    camera.getWorldDirection(_fwd);_foc.addScaledVector(_fwd.setY(0).normalize(),Math.min(d*.25,120));updateShadow(_foc,THREE.MathUtils.clamp(d*.8,70,430));}
  U.uPointScale.value=renderer.domElement.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  // light shafts toward the sun, tilt-shift in photo mode
  const g=post.grade.uniforms;g.uTime.value=elapsed;
  camera.getWorldDirection(_fwd);
  const facing=_fwd.dot(S.sunDir);
  let shaft=Q.shaft&&S.shaft>0&&S.sunEl>-1&&facing>.2?S.shaft*THREE.MathUtils.smoothstep(facing,.2,.6):0;
  if(shaft>0){_sp.copy(camera.position).addScaledVector(S.sunDir,1000).project(camera);g.uSun.value.set(_sp.x*.5+.5,_sp.y*.5+.5);
    shaft*=1-THREE.MathUtils.smoothstep(Math.max(Math.abs(_sp.x),Math.abs(_sp.y)),1,1.6);}
  g.uShaft.value=shaft;
  g.uTilt.value+=((photo?1:0)-g.uTilt.value)*(1-Math.exp(-6*dt));
  if(photo){_sp.copy(mode==='walk'?_foc.set(player.pos.x+_fwd.x*25,player.pos.y,player.pos.z+_fwd.z*25):controls.target).project(camera);g.uFocus.value=THREE.MathUtils.clamp(_sp.y*.5+.5,.2,.8);}
  renderer.info.reset();post.composer.render();
  // stats + adaptive quality
  fpsSmooth+=(1/Math.max(dt,1e-4)-fpsSmooth)*.05;
  if(autoAdapt&&frames>120&&quality<3&&!document.hidden&&typeof fixedDt!=='number'){qAcc+=dt;qN++;if(qN>=90){const avg=qAcc/qN;qAcc=0;qN=0;if(avg>1/33)setQuality(quality+1);}}
  if(performance.now()-lastStats>500){lastStats=performance.now();
    const i=renderer.info.render;
    $('#stats').textContent=`${fpsSmooth.toFixed(0)} fps · ${i.calls} draws · ${(i.triangles/1e6).toFixed(2)}M tris\n${QUALITY[quality].name}${autoAdapt?' (auto)':''}`;
    if(mm.offsetParent)drawMinimap();
  }
  if(firstFrame){firstFrame=false;loadMsg.style.opacity=0;setTimeout(()=>loadMsg.style.display='none',700);window.__ready=true;}
}

function initApp(){
  buildMinimap();
  setQuality(quality);
  setHour(hour,true);
  document.querySelectorAll('#tods button').forEach(b=>b.classList.toggle('on',b.dataset.tod==='dusk'));
  updateHints();
  if(isTouch){$('#help .card p.sub').insertAdjacentHTML('afterend','<p class="sub" style="color:#ffb3cc">Touch: orbit with 1 finger / pinch. In Walk mode: left thumb = move, right side = look. 触屏：环绕模式单指旋转、双指缩放；步行模式左手移动、右侧环视。</p>');}
  renderer.setAnimationLoop(()=>frame());
  window.__city={
    setMode,setTod,setHour,teleport,toggleHelp,toggleTour,togglePhoto,togglePlay,
    state:()=>({mode,hour,quality:QUALITY[quality].name,locked,fps:fpsSmooth,player:{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch},stats:city.stats,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,camera:camera.position.toArray()}),
    setCamera:(p,t)=>{stopTour();if(mode!=='orbit')setMode('orbit');camera.position.set(...p);controls.target.set(...t);controls.update();controls.autoRotate=false;},
    setWalk:(x,z,yaw,pitch)=>{stopTour();window.__noLock=true;teleport(x,z,yaw);if(pitch!==undefined)player.pitch=pitch;},
    key:(c,down)=>down?keys.add(c):keys.delete(c),
    setQuality:(q)=>setQuality(q,true),cityObj:city,
    pause:()=>renderer.setAnimationLoop(null),resume:()=>{clock.getDelta();renderer.setAnimationLoop(()=>frame());},
    sim:(n,dt)=>{for(let i=0;i<n;i++)updateWalk(dt||.016);},
    step:(n,dt)=>{for(let i=0;i<n;i++)frame(dt||.016);},
    setAdaptive:v=>autoAdapt=v,
    dbg:{post,scene,renderer,sun,camera,U,S,controls},
  };
}
requestAnimationFrame(()=>setTimeout(()=>{try{boot();}catch(e){console.error(e);$('#loading').innerHTML='<div style="max-width:560px;padding:20px">Failed to start: '+String(e&&e.message||e)+'</div>';}},30));
