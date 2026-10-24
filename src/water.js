import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {GB,lin,paint,Instances} from './util.js';
import {SLAB,EDGE,WALK_OUT,RIVER_Z0,RIVER_Z1,WATER_Y,BRIDGE_X,ROAD} from './layout.js';
import {M} from './buildings.js';

export const deckY=z=>z<=RIVER_Z0-6||z>=RIVER_Z1+6?0:6.5*Math.sin(Math.PI*(z-(RIVER_Z0-6))/(RIVER_Z1-RIVER_Z0+12));
const RIVER_W=7000;

const waterShader={
  name:'SweetWater',
  uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
    color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},
    uTime:{value:0},uSunDir:{value:new THREE.Vector3(0,1,0)},uSunCol:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uZen:{value:new THREE.Color()},
    uDeep:{value:new THREE.Color('#2e8d9c')},uShallow:{value:new THREE.Color('#7fe0d8')},uAmb:{value:1},uRefl:{value:1}}]),
  vertexShader:`uniform mat4 textureMatrix;varying vec4 vUvR;varying vec3 vW;
#include <fog_pars_vertex>
void main(){vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vUvR=textureMatrix*vec4(position,1.);vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uAmb,uRefl;uniform vec3 uSunDir,uSunCol,uHor,uZen,uDeep,uShallow;varying vec4 vUvR;varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  vec2 p=vW.xz;vec2 g=vec2(0.);
  vec2 D[6];D[0]=vec2(1.,.2);D[1]=vec2(-.6,1.);D[2]=vec2(.8,-.7);D[3]=vec2(.2,1.);D[4]=vec2(-1.,-.3);D[5]=vec2(.5,.85);
  float f=.07,a=.9;
  for(int i=0;i<6;i++){vec2 d=normalize(D[i]);float ph=dot(d,p)*f+uTime*(.6+float(i)*.27)*sqrt(f*9.8);g+=d*cos(ph)*f*a;f*=1.83;a*=.6;}
  float dist=length(vW-cameraPosition);
  g*=mix(1.,.25,smoothstep(80.,900.,dist));
  vec3 n=normalize(vec3(-g.x,1.,-g.y));
  vec3 V=normalize(cameraPosition-vW);
  float fres=.02+.98*pow(1.-max(dot(n,V),0.),5.);
  vec3 refl;
  if(uRefl>.5){vec2 uv=vUvR.xy/vUvR.w+n.xz*.035;refl=texture2D(tDiffuse,uv).rgb;}
  else{vec3 r=reflect(-V,n);refl=mix(uHor,uZen,smoothstep(0.,.5,r.y));}
  float depthTint=smoothstep(.2,1.,max(dot(n,V),0.));
  vec3 body=mix(uShallow,uDeep,depthTint)*uAmb;
  vec3 col=mix(body,refl,clamp(fres*1.2+.12,0.,1.));
  vec3 H=normalize(uSunDir+V);col+=uSunCol*pow(max(dot(n,H),0.),420.)*4.+uSunCol*pow(max(dot(n,H),0.),40.)*.08;
  gl_FragColor=vec4(col,1.);
  {float fd=fogDensity*length(vW-cameraPosition);gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,(1.-exp(-fd*fd*.6))*.75);}
}`};

export function buildWater(W){
  const {root,rng,U}=W;
  const geo=new THREE.PlaneGeometry(RIVER_W,RIVER_Z1-RIVER_Z0+2);
  const refl=new Reflector(geo,{textureWidth:1024,textureHeight:512,clipBias:.003,shader:waterShader,multisample:0});
  refl.material.fog=true;
  refl.rotation.x=-Math.PI/2;refl.position.set(0,WATER_Y,(RIVER_Z0+RIVER_Z1)/2);
  refl.userData.noAO=true;root.add(refl);
  const wu=refl.material.uniforms;wu.uTime=U.uTime;
  const reflRender=refl.onBeforeRender;
  W.water={mesh:refl,u:wu,setReflect(on){refl.onBeforeRender=on?reflRender:()=>{};wu.uRefl.value=on?1:0;},setSize(w,h){refl.getRenderTarget().setSize(w,h);}};
  refl.camera.layers.set(0);

  /* embankment walls + coping */
  const wall=new GB(),stone=(y)=>y>-.4?lin('#fff1e6'):(Math.floor(-y/1.2)%2?lin('#f2c8cf'):lin('#f7d9d5'));
  for(const [z,nz] of [[RIVER_Z0,1],[RIVER_Z1,-1]]){
    const x0=-RIVER_W/2,x1=RIVER_W/2;
    for(let y=0;y>-7;y-=1.2){const y1=Math.max(-7,y-1.2);
      if(nz>0)wall.quad([x0,y1,z],[x1,y1,z],[x1,y,z],[x0,y,z],[0,0,1],[[0,0],[1,0],[1,1],[0,1]],stone(y-.1));
      else wall.quad([x1,y1,z],[x0,y1,z],[x0,y,z],[x1,y,z],[0,0,-1],[[0,0],[1,0],[1,1],[0,1]],stone(y-.1));}
  }
  // the far bank top (between wall and terrain) and the near bank outside the promenade
  wall.box(-RIVER_W/2,-.05,RIVER_Z1,RIVER_W/2,.02,RIVER_Z1+6,lin('#e9d6cf'));
  wall.box(-RIVER_W/2,-.05,RIVER_Z0-6,-WALK_OUT,.02,RIVER_Z0,lin('#e9d6cf'));wall.box(WALK_OUT,-.05,RIVER_Z0-6,RIVER_W/2,.02,RIVER_Z0,lin('#e9d6cf'));
  const wm=new THREE.Mesh(wall.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));wm.receiveShadow=true;root.add(wm);

  /* promenade railing */
  const rail=new GB(),PINK=lin('#ff8fb1'),WH=lin('#fffaf4');
  const railRun=(x0,x1,z,y=SLAB)=>{rail.box(x0,y+.95,z-.08,x1,y+1.08,z+.08,PINK);rail.box(x0,y+.5,z-.04,x1,y+.56,z+.04,WH);
    for(let x=x0;x<=x1;x+=2.2)rail.box(x-.06,y,z-.06,x+.06,y+.98,z+.06,WH);W.boxes.push({x0,z0:z-.3,x1,z1:z+.3});};
  railRun(-WALK_OUT,BRIDGE_X-ROAD/2-.5,RIVER_Z0-.3);railRun(BRIDGE_X+ROAD/2+.5,WALK_OUT,RIVER_Z0-.3);
  // ends of the promenade
  W.boxes.push({x0:-WALK_OUT-1,z0:EDGE,x1:-WALK_OUT,z1:RIVER_Z0},{x0:WALK_OUT,z0:EDGE,x1:WALK_OUT+1,z1:RIVER_Z0});

  /* bridge */
  const bx=BRIDGE_X,hw=9,zA=RIVER_Z0-6,zB=RIVER_Z1+6,deck=new GB();
  const road=new GB();
  const step=3;
  for(let z=zA;z<zB;z+=step){
    const z2=Math.min(zB,z+step),y1=deckY(z),y2=deckY(z2);
    road.quad([bx-ROAD/2,y1+.02,z],[bx-ROAD/2,y2+.02,z2],[bx+ROAD/2,y2+.02,z2],[bx+ROAD/2,y1+.02,z],[0,1,0],[[(bx-ROAD/2)/(2*EDGE),z/(2*EDGE)],[(bx-ROAD/2)/(2*EDGE),z2/(2*EDGE)],[(bx+ROAD/2)/(2*EDGE),z2/(2*EDGE)],[(bx+ROAD/2)/(2*EDGE),z/(2*EDGE)]],[1,1,1]);
    for(const s of [-1,1]){
      const xi=bx+s*ROAD/2,xo=bx+s*hw;
      const a=[Math.min(xi,xo),y1+.25,z],b=[Math.max(xi,xo),y1+.25,z],c=[Math.max(xi,xo),y2+.25,z2],d=[Math.min(xi,xo),y2+.25,z2];
      deck.quad(a,d,c,b,[0,1,0],[[0,0],[0,1],[1,1],[1,0]],lin('#f7e6e1'));
      // side girder
      deck.quad([xo,y1-1.3,z],[xo,y2-1.3,z2],[xo,y2+.25,z2],[xo,y1+.25,z],[s,0,0],[[0,0],[1,0],[1,1],[0,1]],Math.floor(z/6)%2?PINK:WH);
      // railing
      deck.box(xo-s*.25-.07,y1+.25,z,xo-s*.25+.07,y1+1.35,z+.14,WH);
      deck.quad([xo-s*.25,y1+1.2,z],[xo-s*.25,y2+1.2,z2],[xo-s*.25,y2+1.35,z2],[xo-s*.25,y1+1.35,z],[s,0,0],[[0,0],[1,0],[1,1],[0,1]],PINK);
      deck.quad([xo-s*.25,y1+1.35,z],[xo-s*.25,y2+1.35,z2],[xo-s*.25,y2+1.2,z2],[xo-s*.25,y1+1.2,z],[-s,0,0],[[0,0],[1,0],[1,1],[0,1]],PINK);
    }
    deck.quad([bx-hw,y1-1.3,z],[bx+hw,y1-1.3,z],[bx+hw,y2-1.3,z2],[bx-hw,y2-1.3,z2],[0,-1,0],[[0,0],[1,0],[1,1],[0,1]],lin('#e9d6cf'));
  }
  W.boxes.push({x0:bx-hw-1,z0:RIVER_Z0,x1:bx-hw+.4,z1:RIVER_Z1},{x0:bx+hw-.4,z0:RIVER_Z0,x1:bx+hw+1,z1:RIVER_Z1});
  // towers
  const tz=[RIVER_Z0+52,RIVER_Z1-52],tTop=56;
  for(const z of tz){
    for(const s of [-1,1]){
      const leg=new THREE.BoxGeometry(2.2,tTop-WATER_Y+3,2.6,1,24,1);leg.translate(0,(tTop+WATER_Y-3)/2,0);
      deck.add(leg,M(bx+s*(hw+1.4),0,z),(v)=>Math.floor((v.y+3)/3.2)%2?PINK:WH);
      const f=new THREE.SphereGeometry(1.6,16,12);deck.add(f,M(bx+s*(hw+1.4),tTop+.9,z),lin('#ffd84d'));
      W.circles.push({x:bx+s*(hw+1.4),z,r:1.8});
    }
    for(const y of [deckY(z)+16,tTop-8]){const beam=new THREE.BoxGeometry(hw*2+5,1.6,1.8);deck.add(beam,M(bx,y,z),WH);}
    const arch=new THREE.TorusGeometry(hw+.4,.7,8,24,Math.PI);deck.add(arch,M(bx,tTop-8.8,z),PINK);
    const pier=new THREE.CylinderGeometry(4,4.5,5,20);deck.add(pier,M(bx,WATER_Y-1,z,3.2,1,.9),lin('#f2c8cf'));
  }
  // cables: parabolic main span + side spans
  const cableY=z=>{
    const [t1,t2]=tz;
    if(z<t1){const u=(z-zA)/(t1-zA);return 1.5+(tTop-1-1.5)*u*u;}
    if(z>t2){const u=(zB-z)/(zB-t2);return 1.5+(tTop-1-1.5)*u*u;}
    const u=(z-(t1+t2)/2)/((t2-t1)/2);return deckY(z)+3+(tTop-1-deckY(z)-3)*u*u;
  };
  const cab=new GB(),susp=[];
  for(const s of [-1,1]){
    const x=bx+s*(hw-.3),pts=[];for(let z=zA;z<=zB+.01;z+=2)pts.push(new THREE.Vector3(x,cableY(z),z));
    const tube=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),160,.32,6,false);cab.add(tube,null,lin('#ffffff'));tube.dispose();
    for(let z=zA+4;z<zB-2;z+=4.5){const y0=deckY(z)+.3,y1=cableY(z);if(y1-y0>.8){susp.push([x,y0,z,y1-y0]);}if(((z-zA)/4.5|0)%2===0)W.glow.push([x,cableY(z)+.3,z,1,.55,.8,4.5,2]);}
  }
  const dm=new THREE.Mesh(deck.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.45}));dm.castShadow=dm.receiveShadow=true;root.add(dm);
  const rm=new THREE.Mesh(road.geometry(),W.mats.road);rm.receiveShadow=true;root.add(rm);
  const cm=new THREE.Mesh(cab.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.3}));cm.castShadow=true;root.add(cm);
  const sm=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,1,4).translate(0,.5,0),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4}),susp.length);
  susp.forEach((p,i)=>sm.setMatrixAt(i,new THREE.Matrix4().makeScale(1,p[3],1).setPosition(p[0],p[1],p[2])));root.add(sm);
  // bridge lamps
  for(let z=zA+8;z<zB;z+=16)for(const s of [-1,1])W.bridgeLamps.push({x:bx+s*(hw-.6),z,y:deckY(z)+.25,nx:-s,nz:0});

  /* road beyond the bridge on the far bank */
  {const g=new GB(),z0=zB-.5,z1=1600,x0=bx-ROAD/2,x1=bx+ROAD/2,S=1/(2*EDGE);
   g.quad([x0,.03,z1],[x1,.03,z1],[x1,.03,z0],[x0,.03,z0],[0,1,0],[[x0*S,z1*S],[x1*S,z1*S],[x1*S,z0*S],[x0*S,z0*S]],[1,1,1]);
   const m=new THREE.Mesh(g.geometry(),W.mats.road);m.receiveShadow=true;root.add(m);
   for(let z=zB+20;z<1100;z+=40)for(const s of [-1,1])W.farLamps.push({x:bx+s*(ROAD/2+1),z,nx:-s,nz:0,y:0});}
  /* boats */
  const boats=[];
  const hullC=['#ff8fb1','#7fd6ff','#ffd36b','#a6e3a1','#c8a2ff'].map(lin);
  for(let k=0;k<5;k++){
    const g=new GB(),c=hullC[k],L=8+rng()*6;
    const hull=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2);hull.scale(L/2,1.4,1.8);g.add(hull,M(0,.6,0),c);
    g.box(-L/2+.6,.55,-1.65,L/2-.6,.75,1.65,WH);
    g.box(-L*.2,.75,-1.2,L*.15,2.5,1.2,WH);
    const can=new THREE.CylinderGeometry(1.5,1.5,L*.42,16,1,false,0,Math.PI);can.rotateZ(Math.PI/2);can.rotateX(Math.PI/2);
    g.add(can,M(-L*.03,2.5,0),(v)=>Math.floor(v.x*1.4+20)%2?c:WH);
    const mesh=new THREE.Mesh(g.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,side:THREE.DoubleSide}));mesh.castShadow=true;
    root.add(mesh);
    boats.push({mesh,lane:k%2?RIVER_Z0+80+rng()*10:RIVER_Z1-80-rng()*10,x:(rng()-.5)*1600,sp:(k%2?1:-1)*(3+rng()*3),ph:rng()*6});
  }
  let t=0;
  W.updaters.push(dt=>{t+=dt;for(const b of boats){b.x+=b.sp*dt;if(b.x>900)b.x=-900;if(b.x<-900)b.x=900;b.mesh.position.set(b.x,WATER_Y+Math.sin(t*1.3+b.ph)*.08-.35,b.lane);b.mesh.rotation.set(Math.sin(t*1.1+b.ph)*.03,b.sp>0?0:Math.PI,Math.sin(t*.9+b.ph)*.025);}});
}
