import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {buildCity,HALF,BLOCK,P,N,bc} from './city.js';
import {makeSky} from './sky.js';

const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const canvas=$('#c');
let renderer;
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false});
}catch(e){$('#nogl').style.display='flex';$('#loading').style.display='none';throw e;}
const isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
let pixelRatioCap=Math.min(window.devicePixelRatio||1,params.get('pr')?+params.get('pr'):1.5);
renderer.setPixelRatio(pixelRatioCap);
renderer.setSize(innerWidth,innerHeight,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.info.autoReset=false;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xffffff,.001);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.3,3500);
camera.rotation.order='YXZ';

/* ---------- time-of-day presets ---------- */
const C=h=>new THREE.Color(h);
const PRESETS={
  day:{sunEl:48,sunAz:140,sunInt:3.3,hemiInt:.95,envInt:.7,fogDen:.00095,discAmt:7,glowAmt:.55,horGlow:.25,stars:0,cloudAmt:.8,discSize:.035,win:.05,lamp:0,head:0,expo:.82,bloomS:.1,bloomR:.4,bloomT:1.15,
    sunCol:C('#fff0d8'),hemiSky:C('#b9d6ff'),hemiGround:C('#8b8576'),fogCol:C('#c3d9ee'),zen:C('#2a68c0'),mid:C('#5c9ce0'),hor:C('#cfe4f5'),discCol:C('#fff5df'),cloudLit:C('#ffffff'),cloudDark:C('#a3b3c8')},
  dusk:{sunEl:7,sunAz:232,sunInt:3.1,hemiInt:.5,envInt:.55,fogDen:.00095,discAmt:9,glowAmt:1.0,horGlow:1.4,stars:.08,cloudAmt:.85,discSize:.04,win:.85,lamp:.6,head:.55,expo:.92,bloomS:.3,bloomR:.55,bloomT:.95,
    sunCol:C('#ff9348'),hemiSky:C('#7284cc'),hemiGround:C('#6a5550'),fogCol:C('#c58a82'),zen:C('#1b2a5c'),mid:C('#8a4f86'),hor:C('#ff9a58'),discCol:C('#ff9a50'),cloudLit:C('#ffb27a'),cloudDark:C('#54406a')},
  night:{sunEl:36,sunAz:70,sunInt:.6,hemiInt:.5,envInt:.45,fogDen:.0016,discAmt:3,glowAmt:.3,horGlow:.05,stars:1,cloudAmt:.3,discSize:.03,win:1.3,lamp:1.1,head:1,expo:1.15,bloomS:.6,bloomR:.65,bloomT:.8,
    sunCol:C('#86a2ff'),hemiSky:C('#2f4180'),hemiGround:C('#1a2036'),fogCol:C('#0d1528'),zen:C('#02040c'),mid:C('#0a1430'),hor:C('#1b2a4c'),discCol:C('#dfe8ff'),cloudLit:C('#3b4a78'),cloudDark:C('#0c1226'),}
};
function cloneState(s){const o={};for(const k in s)o[k]=s[k].isColor?s[k].clone():s[k];return o;}
function lerpState(out,a,b,t){for(const k in a){if(a[k].isColor)out[k].lerpColors(a[k],b[k],t);else out[k]=a[k]+(b[k]-a[k])*t;}}

/* ---------- lights, sky ---------- */
const sky=makeSky();scene.add(sky);
const hemi=new THREE.HemisphereLight(0xffffff,0x444444,1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,3);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.35;sun.shadow.radius=3;
sun.shadow.camera.near=10;sun.shadow.camera.far=1100;
scene.add(sun,sun.target);
const sunDir=new THREE.Vector3();

/* ---------- build city ---------- */
let city;
const loadMsg=$('#loading');
function boot(){
  const maxAniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  city=buildCity({aniso:maxAniso});
  scene.add(city.root);
  // pre-bake sky reflection maps
  const pm=new THREE.PMREMGenerator(renderer);
  const envScene=new THREE.Scene();const envSky=makeSky();envScene.add(envSky);
  envSky.material.uniforms.time.value=3;
  for(const k of Object.keys(PRESETS)){applySkyUniforms(envSky.material.uniforms,PRESETS[k]);const rt=pm.fromScene(envScene,0,1,2500);PRESETS[k].envMap=rt.texture;}
  pm.dispose();
  initApp();
}
function applySkyUniforms(u,s){
  u.zen.value.copy(s.zen);u.mid.value.copy(s.mid);u.hor.value.copy(s.hor);u.discCol.value.copy(s.discCol);u.cloudLit.value.copy(s.cloudLit);u.cloudDark.value.copy(s.cloudDark);
  u.discAmt.value=s.discAmt;u.glowAmt.value=s.glowAmt;u.horGlow.value=s.horGlow;u.stars.value=s.stars;u.cloudAmt.value=s.cloudAmt;u.discSize.value=s.discSize;
  const el=s.sunEl*Math.PI/180,az=s.sunAz*Math.PI/180;
  u.sunDir.value.set(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az));
}

/* ---------- composer ---------- */
let composer,bloom;
function setupComposer(){
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,samples:4});
  composer=new EffectComposer(renderer,rt);
  composer.setPixelRatio(pixelRatioCap);composer.setSize(innerWidth,innerHeight);
  composer.addPass(new RenderPass(scene,camera));
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.6,.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

/* ---------- state ---------- */
const cur=cloneState(PRESETS.dusk);
let todName='dusk',todFrom=null,todTo=null,todT=1;
let envName='dusk';
let mode='orbit',bloomOn=true,quality=0,autoAdapt=params.get('q')!=='high',helpOpen=true;
let elapsed=0;

function applyState(){
  const s=cur;
  const el=s.sunEl*Math.PI/180,az=s.sunAz*Math.PI/180;
  sunDir.set(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az));
  sun.color.copy(s.sunCol);sun.intensity=s.sunInt;
  hemi.color.copy(s.hemiSky);hemi.groundColor.copy(s.hemiGround);hemi.intensity=s.hemiInt;
  scene.fog.color.copy(s.fogCol);scene.fog.density=s.fogDen;
  scene.environmentIntensity=s.envInt;
  renderer.toneMappingExposure=s.expo;
  const u=sky.material.uniforms;applySkyUniforms(u,s);u.time.value=elapsed;
  const m=city.mats;
  m.facades.forEach(f=>f.emissiveIntensity=s.win);
  m.sign.emissiveIntensity=.22+s.win*1.5;
  m.bulb.color.setRGB(1,.82,.5).multiplyScalar(.2+s.lamp*5);
  m.pool.color.setRGB(1,.7,.36).multiplyScalar(s.lamp*.5);m.pool.visible=s.lamp>.01;
  m.glow.uniforms.opacity.value=s.lamp;m.glow.visible=s.lamp>.01;
  m.carLights.color.setScalar(.35+s.head*5);
  m.beam.color.setRGB(1,.9,.7).multiplyScalar(s.head*.5);m.beam.visible=s.head>.01;
  m.crown.color.setScalar(.35+s.win*2.2);
  m.wheelBulb.color.setScalar(.35+s.lamp*5);
  bloom.strength=s.bloomS;bloom.radius=s.bloomR;bloom.threshold=s.bloomT;
}
function setTod(name,instant){
  if(!PRESETS[name])return;
  todName=name;
  document.querySelectorAll('#tods button').forEach(b=>b.classList.toggle('on',b.dataset.tod===name));
  scene.environment=PRESETS[name].envMap;envName=name;
  if(instant){lerpState(cur,PRESETS[name],PRESETS[name],0);Object.assign(cur,cloneState(PRESETS[name]));todT=1;applyState();return;}
  todFrom=cloneState(cur);todTo=PRESETS[name];todT=0;
}

/* ---------- shadow focus ---------- */
const _r=new THREE.Vector3(),_u=new THREE.Vector3(),_f=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
function updateShadow(focus,ext){
  const cam=sun.shadow.camera;
  if(cam.right!==ext){cam.left=-ext;cam.right=ext;cam.top=ext;cam.bottom=-ext;cam.updateProjectionMatrix();}
  _r.crossVectors(_up,sunDir).normalize();_u.crossVectors(sunDir,_r).normalize();
  const texel=2*ext/sun.shadow.mapSize.x;
  const a=Math.round(focus.dot(_r)/texel)*texel,b=Math.round(focus.dot(_u)/texel)*texel,c=focus.dot(sunDir);
  _f.set(0,0,0).addScaledVector(_r,a).addScaledVector(_u,b).addScaledVector(sunDir,c);
  sun.target.position.copy(_f);sun.position.copy(_f).addScaledVector(sunDir,600);
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
canvas.addEventListener('mousedown',e=>{
  if(mode!=='walk'||helpOpen)return;
  dragging=true;if(!locked&&!isTouch)lockPointer();
});
window.addEventListener('mouseup',()=>dragging=false);
window.addEventListener('mousemove',e=>{
  if(mode!=='walk'||helpOpen)return;
  if(locked&&skipMoves>0){skipMoves--;return;}
  if(Math.abs(e.movementX)>250||Math.abs(e.movementY)>250)return;
  if(locked||dragging){player.yaw-=e.movementX*.0022*(locked?1:1);player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.0022,-1.5,1.5);}
});
window.addEventListener('keydown',e=>{
  if(e.code==='KeyH'){toggleHelp();return;}
  if(e.code==='Escape'&&helpOpen){toggleHelp(false);return;}
  if(helpOpen&&e.code==='Enter'){toggleHelp(false);return;}
  if(helpOpen)return;
  if(e.code==='KeyM'||e.code==='Tab'){e.preventDefault();setMode(mode==='walk'?'orbit':'walk');return;}
  if(e.code==='Digit1')setTod('day');else if(e.code==='Digit2')setTod('dusk');else if(e.code==='Digit3')setTod('night');
  else if(e.code==='KeyB')toggleBloom();
  else if(e.code==='KeyV')document.body.classList.toggle('hidehud');
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)jumpQueued=true;}
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();dragging=false;});

// touch (walk): left = move joystick, right = look
function touchStart(e){
  if(mode!=='walk'||helpOpen)return;
  for(const t of e.changedTouches){
    if(t.target.id==='jumpbtn'){jumpQueued=true;continue;}
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
  e.preventDefault();
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
  const sp=(run?11:5.4);
  const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
  const tx=(-sy*f+cy*s)*sp,tz=(-cy*f-sy*s)*sp;
  const a=1-Math.exp(-(player.onGround?14:3)*dt);
  player.vx+=(tx-player.vx)*a;player.vz+=(tz-player.vz)*a;
  if(jumpQueued&&player.onGround){player.vy=7.4;player.onGround=false;}
  jumpQueued=false;
  player.vy-=24*dt;
  player.pos.x+=player.vx*dt;player.pos.z+=player.vz*dt;player.pos.y+=player.vy*dt;
  for(let i=0;i<3;i++)if(!city.resolve(player.pos,.45))break;
  const lim=HALF+60;player.pos.x=THREE.MathUtils.clamp(player.pos.x,-lim,lim);player.pos.z=THREE.MathUtils.clamp(player.pos.z,-lim,lim);
  const g=city.groundAt(player.pos.x,player.pos.z);
  if(player.pos.y<=g){player.pos.y=g;player.vy=0;player.onGround=true;}else if(player.pos.y>g+.05)player.onGround=false;
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
controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=12;controls.maxDistance=1100;controls.maxPolarAngle=Math.PI/2-.03;
controls.zoomSpeed=.9;controls.rotateSpeed=.6;controls.panSpeed=.8;controls.screenSpacePanning=false;
controls.autoRotate=true;controls.autoRotateSpeed=.45;
controls.target.set(0,28,0);
camera.position.set(250,170,330);
controls.addEventListener('start',()=>{controls.autoRotate=false;});
controls.update();

function setMode(m){
  if(m===mode)return;
  mode=m;
  document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  if(m==='walk'){
    controls.enabled=false;controls.autoRotate=false;
    const t=controls.target;
    player.pos.set(t.x,0,t.z);
    // face along camera view direction
    camera.getWorldDirection(_fwd);player.yaw=Math.atan2(-_fwd.x,-_fwd.z);player.pitch=-.05;
    for(let i=0;i<4;i++)if(!city.resolve(player.pos,.45))break;
    player.pos.y=city.groundAt(player.pos.x,player.pos.z);player.camY=player.pos.y+1.7;player.vx=player.vz=player.vy=0;player.onGround=true;
    camera.fov=player.fov=68;camera.updateProjectionMatrix();
    if(!isTouch)lockPointer();
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
// double click ground in orbit mode
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
canvas.addEventListener('dblclick',e=>{
  if(mode!=='orbit'||helpOpen)return;
  ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  const o=ray.ray.origin,d=ray.ray.direction;if(d.y>=-1e-4)return;
  const t=-o.y/d.y;if(t<0||t>2500)return;
  controls.target.set(o.x+d.x*t,0,o.z+d.z*t);
  // keep camera heading
  setMode('walk');
});

/* ---------- UI ---------- */
function toggleHelp(v){helpOpen=v===undefined?!helpOpen:v;$('#help').style.display=helpOpen?'flex':'none';if(helpOpen){keys.clear();if(document.pointerLockElement)document.exitPointerLock();}else{canvas.focus();}updateHints();}
function toggleBloom(){bloomOn=!bloomOn;bloom.enabled=bloomOn&&quality<2;$('#bloombtn').classList.toggle('on',bloomOn);}
function updateHints(){
  const b=$('#bottom'),lh=$('#lockhint'),cr=$('#cross');
  if(mode==='walk'){
    b.innerHTML='<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move 移动 · <kbd>Shift</kbd> run 奔跑 · <kbd>Space</kbd> jump 跳 · mouse look 鼠标环视 · <kbd>M</kbd> orbit 环绕 · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> time 时间';
    cr.style.display=(locked||isTouch)&&!helpOpen?'block':'none';
    lh.style.display=(!locked&&!isTouch&&!helpOpen)?'block':'none';
    $('#joy').style.display=$('#jumpbtn').style.display=isTouch&&!helpOpen?'flex':'none';$('#joy').style.display=isTouch&&!helpOpen?'block':'none';
  }else{
    b.innerHTML='Drag rotate 拖动旋转 · scroll zoom 滚轮缩放 · right-drag pan 右键平移 · double-click ground to walk there 双击地面步行 · <kbd>M</kbd> walk 步行';
    cr.style.display='none';lh.style.display='none';$('#joy').style.display=$('#jumpbtn').style.display='none';
  }
}
document.querySelectorAll('#modes button').forEach(b=>b.addEventListener('click',()=>{setMode(b.dataset.mode);canvas.focus();}));
document.querySelectorAll('#tods button').forEach(b=>b.addEventListener('click',()=>{setTod(b.dataset.tod);canvas.focus();}));
$('#bloombtn').addEventListener('click',()=>{toggleBloom();canvas.focus();});
$('#helpbtn').addEventListener('click',()=>toggleHelp());
$('#startbtn').addEventListener('click',()=>toggleHelp(false));
$('#help').addEventListener('mousedown',e=>{if(e.target.id==='help')toggleHelp(false);});
$('#jumpbtn').addEventListener('touchstart',e=>{jumpQueued=true;e.preventDefault();},{passive:false});

/* ---------- minimap ---------- */
const mm=$('#mm'),mctx=mm.getContext('2d'),MS=mm.width,MK=MS/(HALF*2);
let mmStatic;
function buildMinimap(){
  mmStatic=document.createElement('canvas');mmStatic.width=mmStatic.height=MS;const c=mmStatic.getContext('2d');
  c.fillStyle='#232733';c.fillRect(0,0,MS,MS);
  for(const b of city.blocks){
    c.fillStyle=b.park?'#3f6b3a':b.center?'#6d7380':'#4b505c';
    c.fillRect((b.cx-BLOCK/2+HALF)*MK,(b.cz-BLOCK/2+HALF)*MK,BLOCK*MK,BLOCK*MK);
  }
  c.fillStyle='#2a2e38';
  for(const b of city.buildings)c.fillRect((b.x0+HALF)*MK,(b.z0+HALF)*MK,(b.x1-b.x0)*MK,(b.z1-b.z0)*MK);
  c.fillStyle='#ffcf6a';const w=city.blocks.find(b=>b.i===6&&b.j===2);c.beginPath();c.arc((w.cx+HALF)*MK,(w.cz+HALF)*MK,6,0,7);c.fill();
}
function drawMinimap(){
  mctx.drawImage(mmStatic,0,0);
  let x,z,yaw;
  if(mode==='walk'){x=player.pos.x;z=player.pos.z;yaw=player.yaw;}
  else{x=controls.target.x;z=controls.target.z;camera.getWorldDirection(_fwd);yaw=Math.atan2(-_fwd.x,-_fwd.z);}
  const px=(x+HALF)*MK,pz=(z+HALF)*MK;
  mctx.save();mctx.translate(px,pz);mctx.rotate(-yaw); // heading: yaw 0 faces -z (up)
  mctx.fillStyle='rgba(255,170,90,.28)';mctx.beginPath();mctx.moveTo(0,0);mctx.arc(0,0,38,-Math.PI/2-.55,-Math.PI/2+.55);mctx.closePath();mctx.fill();
  mctx.fillStyle=mode==='walk'?'#ff7a45':'#7ee0ff';mctx.strokeStyle='#fff';mctx.lineWidth=2;
  mctx.beginPath();mctx.moveTo(0,-9);mctx.lineTo(6,7);mctx.lineTo(0,3);mctx.lineTo(-6,7);mctx.closePath();mctx.fill();mctx.stroke();
  mctx.restore();
}
$('#minimap').addEventListener('click',e=>{
  const r=$('#minimap').getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*MS/MK-HALF,z=(e.clientY-r.top)/r.height*MS/MK-HALF;
  teleport(x,z);canvas.focus();
});

/* ---------- resize / quality ---------- */
function resize(){
  if(!composer)return;
  renderer.setPixelRatio(pixelRatioCap);renderer.setSize(innerWidth,innerHeight,false);
  composer.setPixelRatio(pixelRatioCap);composer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
let qAcc=0,qN=0,frames=0;
function setQuality(q){
  quality=q;
  if(q>=1){pixelRatioCap=Math.min(pixelRatioCap,1);resize();}
  if(q>=2)bloom.enabled=false;
  if(q>=3){sun.castShadow=false;}
  $('#stats').dataset.q=['high','balanced','fast','fastest'][q];
}

/* ---------- main loop ---------- */
const clock=new THREE.Clock();
const _foc=new THREE.Vector3();
let fpsSmooth=60,lastStats=0,firstFrame=true;
function frame(fixedDt){
  const dt=typeof fixedDt==='number'?fixedDt:Math.min(clock.getDelta(),.05);elapsed+=dt;frames++;
  // time of day tween
  if(todT<1){todT=Math.min(1,todT+dt/1.6);const e=todT*todT*(3-2*todT);lerpState(cur,todFrom,todTo,e);applyState();}
  else if(frames%2===0){sky.material.uniforms.time.value=elapsed;}
  // beacons pulse
  const pulse=(Math.sin(elapsed*3.2)>.2?1:.12);city.mats.beacon.color.setRGB(1,.1,.08).multiplyScalar(.3+pulse*(.5+cur.lamp*3));
  city.updateCars(dt);city.updateWheel(dt);
  if(mode==='walk'){updateWalk(dt);}
  else{controls.update(dt);}
  sky.position.copy(camera.position);
  // shadow focus
  if(mode==='walk'){_foc.set(player.pos.x,0,player.pos.z);updateShadow(_foc,95);}
  else{const d=camera.position.distanceTo(controls.target);_foc.copy(controls.target);_foc.y=0;updateShadow(_foc,THREE.MathUtils.clamp(d*.75,70,320));}
  // glow point scale
  city.mats.glow.uniforms.scale.value=renderer.domElement.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  renderer.info.reset();composer.render();
  // stats + adaptive quality
  fpsSmooth+=(1/Math.max(dt,1e-4)-fpsSmooth)*.05;
  if(autoAdapt&&frames>90&&quality<3&&!document.hidden){qAcc+=dt;qN++;if(qN>=75){const avg=qAcc/qN;qAcc=0;qN=0;if(avg>1/34)setQuality(quality+1);}}
  if(performance.now()-lastStats>500){lastStats=performance.now();
    const i=renderer.info.render;
    $('#stats').textContent=`${fpsSmooth.toFixed(0)} fps · ${i.calls} draws · ${(i.triangles/1000).toFixed(0)}k tris\nquality: ${$('#stats').dataset.q||'high'}`;
    if(mm.offsetParent)drawMinimap();
  }
  if(firstFrame){firstFrame=false;loadMsg.style.opacity=0;setTimeout(()=>loadMsg.style.display='none',700);window.__ready=true;}
}

function initApp(){
  setupComposer();
  buildMinimap();
  Object.assign(cur,cloneState(PRESETS.dusk));
  scene.environment=PRESETS.dusk.envMap;
  applyState();
  const q=params.get('q');if(q==='low')setQuality(2);
  updateHints();
  if(isTouch){$('#help .card p.sub').insertAdjacentHTML('afterend','<p class="sub" style="color:#ffcf8a">Touch: orbit with 1 finger / pinch. In Walk mode: left thumb = move, right side = look. 触屏：环绕模式单指旋转、双指缩放；步行模式左手移动、右侧环视。</p>');}
  renderer.setAnimationLoop(()=>frame());
  // test / debug API
  window.__city={
    setMode,setTod,teleport,toggleHelp,
    state:()=>({mode,tod:todName,quality,locked,fps:fpsSmooth,player:{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch},stats:city.stats,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,camera:camera.position.toArray()}),
    setCamera:(p,t)=>{camera.position.set(...p);controls.target.set(...t);controls.update();controls.autoRotate=false;},
    setWalk:(x,z,yaw,pitch)=>{teleport(x,z,yaw);if(pitch!==undefined)player.pitch=pitch;},
    key:(c,down)=>down?keys.add(c):keys.delete(c),
    setQuality,buildings:city.buildings,cityObj:city,
    pause:()=>renderer.setAnimationLoop(null),resume:()=>{clock.getDelta();renderer.setAnimationLoop(()=>frame());},
    sim:(n,dt)=>{for(let i=0;i<n;i++)updateWalk(dt||.016);},
    step:(n,dt)=>{for(let i=0;i<n;i++)frame(dt||.016);},
    setAdaptive:v=>autoAdapt=v,
  };
}
// let the loading screen paint first
requestAnimationFrame(()=>setTimeout(()=>{try{boot();}catch(e){console.error(e);$('#loading').innerHTML='<div style="max-width:560px;padding:20px">Failed to start: '+String(e&&e.message||e)+'</div>';}},30));
