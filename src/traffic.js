import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {GB,lin} from './util.js';
import {BLOCK,N,EDGE,BRIDGE_X,bc,rc,signal} from './layout.js';
import {M} from './buildings.js';
import {deckY} from './water.js';
import * as T from './textures.js';

const DARK=lin('#2a2633'),GLASS=lin('#3d4a66'),CHROME=lin('#e8e8ee'),WH=[1,1,1];
const RB=(l,h,w,r)=>new RoundedBoxGeometry(l,h,w,2,r);
function carType(name){
  const g=new GB();let L,wheels,wr=.36,lights,body=WH;
  const add=(geo,x,y,z,c)=>{g.add(geo,M(x,y,z),c);geo.dispose();};
  switch(name){
    case 'sedan':case 'taxi':
      L=4.4;add(RB(4.4,.78,1.86,.32),0,.66,0,WH);add(RB(2.4,.66,1.62,.26),-.25,1.28,0,GLASS);add(RB(2.2,.14,1.5,.07),-.25,1.62,0,WH);
      add(RB(4.5,.18,1.9,.08),0,.38,0,DARK);
      if(name==='taxi'){add(RB(.9,.32,.5,.1),-.2,1.84,0,lin('#ff5d8f'));}
      wheels=[[1.35,-.86],[1.35,.86],[-1.35,-.86],[-1.35,.86]];lights={hy:.72,hx:2.2,tx:-2.2,hw:.6};break;
    case 'hatch':
      L=3.7;add(RB(3.7,.82,1.76,.34),0,.68,0,WH);add(RB(2.3,.72,1.6,.3),-.35,1.32,0,GLASS);add(RB(2.1,.14,1.48,.07),-.35,1.7,0,WH);
      add(RB(3.8,.18,1.8,.08),0,.38,0,DARK);
      wheels=[[1.15,-.8],[1.15,.8],[-1.15,-.8],[-1.15,.8]];lights={hy:.76,hx:1.85,tx:-1.85,hw:.55};break;
    case 'sports':
      L=4.3;add(RB(4.3,.6,1.95,.28),0,.55,0,WH);add(RB(1.8,.5,1.5,.24),-.35,1.02,0,GLASS);
      add(RB(.5,.08,1.8,.04),-2,1.05,0,DARK);add(RB(.1,.4,.1,.03),-2,.85,.7,DARK);add(RB(.1,.4,.1,.03),-2,.85,-.7,DARK);
      wheels=[[1.4,-.9],[1.4,.9],[-1.4,-.9],[-1.4,.9]];wr=.34;lights={hy:.6,hx:2.15,tx:-2.15,hw:.65};break;
    case 'van':
      L=5.2;add(RB(5.2,1.95,2,.38),0,1.25,0,WH);add(RB(.5,.85,1.86,.12),2.38,1.72,0,GLASS);add(RB(3.6,.6,2.03,.1),-.4,1.75,0,GLASS);
      add(RB(5.3,.2,2.04,.08),0,.4,0,DARK);
      wheels=[[1.7,-.92],[1.7,.92],[-1.7,-.92],[-1.7,.92]];wr=.4;lights={hy:.8,hx:2.6,tx:-2.6,hw:.7};break;
    case 'icecream':{
      L=5.6;const P=lin('#ffb3cc'),C=lin('#fffaf4');
      add(RB(5.6,2.1,2.1,.4),0,1.32,0,C);add(RB(5.65,.7,2.15,.1),0,.75,0,P);add(RB(.5,.85,1.95,.12),2.58,1.85,0,GLASS);
      add(RB(2.2,.9,2.14,.08),-.6,1.6,0,lin('#ffe6a8'));
      const cone=new THREE.ConeGeometry(.75,1.8,14);cone.rotateX(Math.PI);add(cone,-.8,3.25,0,lin('#e0a060'));
      const sc=new THREE.SphereGeometry(.85,14,10);add(sc,-.8,4.2,0,lin('#ff8fb1'));
      const sc2=new THREE.SphereGeometry(.6,14,10);add(sc2,-.8,4.9,0,lin('#bff0dc'));
      const ch=new THREE.SphereGeometry(.22,10,6);add(ch,-.8,5.55,0,lin('#e8213f'));
      wheels=[[1.85,-.98],[1.85,.98],[-1.85,-.98],[-1.85,.98]];wr=.42;lights={hy:.85,hx:2.82,tx:-2.82,hw:.75};body=null;break;}
    case 'bus':
      L=10.5;add(RB(10.5,2.8,2.5,.5),0,1.8,0,WH);add(RB(10.3,.9,2.54,.12),-.1,2.25,0,GLASS);add(RB(.2,1.4,2.3,.08),5.2,2,0,GLASS);
      add(RB(10.6,.3,2.56,.1),0,.55,0,lin('#fffaf4'));add(RB(2.5,.3,1,.1),2,3.3,0,lin('#fffaf4'));
      wheels=[[3.6,-1.1],[3.6,1.1],[-3.4,-1.1],[-3.4,1.1]];wr=.52;lights={hy:.95,hx:5.26,tx:-5.26,hw:.95};break;
  }
  return {geo:g.geometry(),L,wheels,wr,lights,tint:body!==null};
}
const TYPES=['sedan','sedan','sedan','sedan','hatch','hatch','taxi','taxi','van','sports','icecream','bus'];
const COLS=['#ff8fb1','#7fd6ff','#ffe066','#a6e3a1','#c8a2ff','#ffffff','#ffb36b','#f2f2f2','#ff6f91','#9ad1ff','#ffd1e0','#b8f0e0'].map(c=>new THREE.Color(c));

function ringPoints(xmin,xmax,zmin,zmax,r){
  const pts=[];const arc=(cx,cz,fn)=>{for(let k=0;k<=8;k++){const a=k/8*Math.PI/2;const [dx,dz]=fn(a);pts.push([cx+dx*r,cz+dz*r,k>0&&k<8]);}};
  pts.push([xmin+r,zmin,false]);
  arc(xmax-r,zmin+r,a=>[Math.sin(a),-Math.cos(a)]);
  arc(xmax-r,zmax-r,a=>[Math.cos(a),Math.sin(a)]);
  arc(xmin+r,zmax-r,a=>[-Math.sin(a),Math.cos(a)]);
  arc(xmin+r,zmin+r,a=>[-Math.cos(a),-Math.sin(a)]);
  pts.push(pts[0]);return pts;
}
function makeRing(pts,yfn){
  const cum=[0];for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]));
  const L=cum[cum.length-1];
  // corners (arc segments) and signal stops along the loop
  const corners=[];for(let k=0;k<pts.length-1;k++)if(pts[k][2]||pts[k+1][2]){if(!corners.length||cum[k]-corners[corners.length-1].e>1)corners.push({s:cum[k],e:cum[k+1]});else corners[corners.length-1].e=cum[k+1];}
  const stops=[];
  const inSq=(x,z)=>{for(let kx=0;kx<8;kx++){if(Math.abs(x-rc(kx))>=7)continue;for(let kz=0;kz<8;kz++)if(Math.abs(z-rc(kz))<7)return [kx,kz];}return null;};
  let prev=null;
  for(let s=0;s<L;s+=.5){const p=pointAt({pts,cum,L,seg:0},s);const q=inSq(p.x,p.z);if(q&&(!prev||prev[0]!==q[0]||prev[1]!==q[1]))stops.push({s,kx:q[0],kz:q[1],axis:Math.abs(p.dx)>Math.abs(p.dz)?0:1});prev=q;}
  return {pts,cum,L,corners,stops,cars:[],y:yfn||null};
}
const _pt={x:0,z:0,dx:0,dz:0,k:0};
function pointAt(r,s,cur=0){
  const c=r.cum;let k=cur;
  if(!(c[k]<=s&&c[k+1]>=s)){let lo=0,hi=c.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(c[mid]<=s)lo=mid;else hi=mid;}k=lo;}
  const a=r.pts[k],b=r.pts[k+1],l=c[k+1]-c[k]||1,u=(s-c[k])/l;
  _pt.x=a[0]+(b[0]-a[0])*u;_pt.z=a[1]+(b[1]-a[1])*u;_pt.dx=(b[0]-a[0])/l;_pt.dz=(b[1]-a[1])/l;_pt.k=k;
  return _pt;
}

export function buildTraffic(W){
  const {root,rng,U}=W;
  // tile the grid into rectangles; one clockwise loop per tile
  const used=new Set(),tiles=[];const order=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++)order.push([i,j]);
  for(let k=order.length-1;k>0;k--){const r=(rng()*(k+1))|0;[order[k],order[r]]=[order[r],order[k]];}
  const shapes=[[1,1],[1,1],[2,1],[1,2],[2,2],[3,1],[1,3]];
  for(const [i,j] of order){
    if(used.has(i+','+j))continue;let placed=false;
    for(let t=0;t<4&&!placed;t++){const [w,h]=shapes[(rng()*shapes.length)|0];let ok=i+w<=N&&j+h<=N;
      if(ok)for(let a=0;a<w;a++)for(let b=0;b<h;b++)if(used.has((i+a)+','+(j+b)))ok=false;
      if(ok){for(let a=0;a<w;a++)for(let b=0;b<h;b++)used.add((i+a)+','+(j+b));tiles.push({i,j,w,h});placed=true;}}
    if(!placed){used.add(i+','+j);tiles.push({i,j,w:1,h:1});}
  }
  const rings=[];
  for(const t of tiles){
    if(rng()<.08)continue;
    const xmin=bc(t.i)-BLOCK/2-3.5,xmax=bc(t.i+t.w-1)+BLOCK/2+3.5,zmin=bc(t.j)-BLOCK/2-3.5,zmax=bc(t.j+t.h-1)+BLOCK/2+3.5;
    rings.push(makeRing(ringPoints(xmin,xmax,zmin,zmax,6)));
  }
  // bridge loop: south over the river, U-turn far away, back north, U-turn on the approach
  {const pts=[];const xs=BRIDGE_X-3.5,xn=BRIDGE_X+3.5,zN=EDGE+4,zS=1500;
   pts.push([xs,zN,false],[xs,zS,false]);for(let k=1;k<8;k++){const a=Math.PI-k/8*Math.PI;pts.push([BRIDGE_X+Math.cos(a)*3.5,zS+Math.sin(a)*3.5,true]);}
   pts.push([xn,zS,false],[xn,zN,false]);for(let k=1;k<8;k++){const a=k/8*Math.PI;pts.push([BRIDGE_X+Math.cos(a)*3.5,zN-Math.sin(a)*3.5,true]);}
   pts.push(pts[0]);rings.push(makeRing(pts,deckY));}
  const types=Object.fromEntries([...new Set(TYPES)].map(n=>[n,carType(n)]));
  const cars=[];
  for(const r of rings){
    const n=Math.max(2,Math.floor(r.L/(26+rng()*16)));let s=rng()*r.L;
    for(let k=0;k<n;k++){
      let tn=TYPES[(rng()*TYPES.length)|0];if(tn==='bus'&&r.L<300)tn='sedan';
      const ty=types[tn];
      const c={ring:r,type:tn,ty,s:s%r.L,v:0,vmax:8+rng()*5,len:ty.L,seg:0,spin:0,brake:0,col:ty.tint?COLS[(rng()*COLS.length)|0]:new THREE.Color(1,1,1)};
      if(tn==='taxi')c.col=new THREE.Color('#ffe066');
      if(tn==='bus')c.vmax=7;
      cars.push(c);r.cars.push(c);s+=r.L/n;
    }
    r.cars.sort((a,b)=>a.s-b.s);
  }
  // meshes
  const bodyMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:.15,envMapIntensity:1.3});
  const byType={};
  for(const n in types){const list=cars.filter(c=>c.type===n);if(!list.length)continue;
    const m=new THREE.InstancedMesh(types[n].geo,bodyMat,list.length);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;
    list.forEach((c,i)=>{c.idx=i;m.setColorAt(i,c.col);});root.add(m);byType[n]=m;}
  const wheelG=(()=>{const g=new GB();const t=new THREE.CylinderGeometry(1,1,.28,14);t.rotateX(Math.PI/2);g.add(t,null,(v)=>Math.hypot(v.x,v.y)<.55&&Math.abs(v.z)>.12?CHROME:lin('#26222b'));return g.geometry();})();
  const wheels=new THREE.InstancedMesh(wheelG,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6}),cars.length*4);wheels.frustumCulled=false;wheels.castShadow=true;root.add(wheels);
  const lightMat=new THREE.MeshBasicMaterial({color:0xffffff});W.mats.carLights=lightMat;
  const lights=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),lightMat,cars.length*4);lights.frustumCulled=false;root.add(lights);
  lights.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cars.length*12),3);
  const beamMat=new THREE.MeshBasicMaterial({map:T.makeBeam(),color:0xffe9c8,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
  W.mats.beam=beamMat;
  const beams=new THREE.InstancedMesh(new THREE.PlaneGeometry(10,3.8).rotateX(-Math.PI/2).translate(5,.06,0),beamMat,cars.length);beams.frustumCulled=false;beams.renderOrder=2;beams.userData.noAO=true;root.add(beams);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),Y=new THREE.Vector3(0,1,0),wm=new THREE.Matrix4(),lm=new THREE.Matrix4(),spinQ=new THREE.Quaternion(),Z=new THREE.Vector3(0,0,1);
  const HEAD=new THREE.Color(1,.95,.82),TAIL=new THREE.Color(1,.02,.04);
  const sigCache=new Map();W.signals.forEach(s=>sigCache.set(Math.round(s.cx)+','+Math.round(s.cz),s.ph));
  const phaseOf=(kx,kz)=>sigCache.get(Math.round(rc(kx))+','+Math.round(rc(kz)))??0;
  function update(dt,time){
    for(const r of rings){
      const n=r.cars.length;
      for(let i=0;i<n;i++){
        const c=r.cars[i];
        let D=1e9;
        if(n>1){const ld=r.cars[(i+1)%n];const g=((ld.s-c.s)%r.L+r.L)%r.L-(ld.len+c.len)/2-2.2;D=Math.min(D,g);}
        let best=null,bd=70;
        for(const st of r.stops){const d=((st.s-(8+c.len/2)-c.s)%r.L+r.L)%r.L;if(d<bd){bd=d;best=st;}}
        if(best){const sg=signal(time,phaseOf(best.kx,best.kz),best.axis);if(sg===2||(sg===1&&bd>c.v*c.v/(2*5)+1))D=Math.min(D,bd);}
        let vt=c.vmax;
        for(const cn of r.corners){if(c.s>=cn.s&&c.s<=cn.e){vt=Math.min(vt,6);continue;}const d=((cn.s-c.s)%r.L+r.L)%r.L;if(d<40)vt=Math.min(vt,Math.sqrt(36+2*3*d));}
        vt=Math.min(vt,Math.sqrt(Math.max(0,2*4.5*(D-.4))));
        const prevV=c.v;
        if(c.v<vt)c.v=Math.min(vt,c.v+2.6*dt);else c.v=Math.max(vt,c.v-7*dt);
        c.brake=c.v<prevV-.01||c.v<.3?1:Math.max(0,c.brake-dt*4);
        c.s=(c.s+c.v*dt)%r.L;c.spin+=c.v*dt/c.ty.wr;
      }
    }
    const head=U.uHead.value;
    let li=0;
    for(let i=0;i<cars.length;i++){
      const c=cars[i],r=c.ring,pt=pointAt(r,c.s,c.seg);c.seg=pt.k;
      // blend heading toward the next segment for smoother turns
      const ang=Math.atan2(-pt.dz,pt.dx);
      const y=r.y?r.y(pt.z):0,pitch=r.y?Math.atan2(r.y(pt.z+pt.dz*2)-r.y(pt.z-pt.dz*2),4):0;
      q.setFromAxisAngle(Y,ang);if(pitch){const qp=new THREE.Quaternion().setFromAxisAngle(Z,pitch);q.multiply(qp);}
      m4.compose(p.set(pt.x,y,pt.z),q,sc);
      byType[c.type].setMatrixAt(c.idx,m4);
      beams.setMatrixAt(i,head>.01?m4:lm.makeScale(0,0,0));
      spinQ.setFromAxisAngle(Z,-c.spin);
      for(let w=0;w<4;w++){const [wx,wz]=c.ty.wheels[w];wm.compose(p.set(wx,c.ty.wr,wz),spinQ,sc.set(c.ty.wr,c.ty.wr,1));sc.set(1,1,1);wheels.setMatrixAt(i*4+w,lm.multiplyMatrices(m4,wm));}
      const Lg=c.ty.lights;
      for(let k=0;k<4;k++){
        const front=k<2,side=k%2?1:-1;
        wm.makeScale(.07,front?.16:.13,front?.36:.3).setPosition(front?Lg.hx:Lg.tx,Lg.hy,side*Lg.hw);
        lights.setMatrixAt(li,lm.multiplyMatrices(m4,wm));
        const col=front?HEAD:TAIL,int=front?(.5+head*4):(.25+head*1.6+c.brake*(2.5+head*3));
        lights.instanceColor.array[li*3]=col.r*int;lights.instanceColor.array[li*3+1]=col.g*int;lights.instanceColor.array[li*3+2]=col.b*int;li++;
      }
    }
    for(const n in byType)byType[n].instanceMatrix.needsUpdate=true;
    wheels.instanceMatrix.needsUpdate=lights.instanceMatrix.needsUpdate=beams.instanceMatrix.needsUpdate=true;lights.instanceColor.needsUpdate=true;
  }
  W.cars=cars;W.rings=rings;W.updateCars=update;
}
