import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {lin,hook} from './util.js';
import {BLOCK,SLAB,RIVER_Z0,WALK_OUT,BRIDGE_X,PARK_THEME} from './layout.js';
import {deckY} from './water.js';

const SHIRTS=['#ff8fb1','#7fd6ff','#ffe066','#a6e3a1','#c8a2ff','#ffffff','#ffb36b','#ff6f91','#9ad1ff','#f6f0e8','#6fd3c0','#e9a6ff'].map(lin);
const PANTS=['#4a5a8a','#3d3a4a','#f2efe9','#7a5a4a','#5d7fa8','#2f3340','#c9b8e8','#ffb3cc'].map(lin);
const SKIN=['#f6d2b8','#e8b896','#c98e68','#8d5a3c','#f2c9a8','#a8704c'].map(lin);

function personGeo(){
  const parts=[];
  const P=(g,id,c=[1,1,1])=>{g=g.index?g.toNonIndexed():g;const n=g.attributes.position.count;g.setAttribute('part',new THREE.Float32BufferAttribute(new Array(n).fill(id),1));
    const col=new Float32Array(n*3);for(let i=0;i<n;i++){col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2];}g.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(g);};
  P(new THREE.CapsuleGeometry(.2,.42,2,7).scale(1,1,.8).translate(0,1.2,0),0);
  P(new THREE.SphereGeometry(.15,8,6).translate(0,1.66,0),5);
  P(new THREE.SphereGeometry(.155,8,4,0,Math.PI*2,0,Math.PI*.55).translate(-.015,1.68,0),6);
  for(const [id,z] of [[1,-.1],[2,.1]])P(new THREE.CapsuleGeometry(.075,.62,1,5).translate(0,.47,z),id);
  for(const [id,z] of [[3,-.27],[4,.27]])P(new THREE.CapsuleGeometry(.06,.5,1,5).translate(0,1.12,z),id);
  return mergeGeometries(parts);
}

export function buildPeople(W){
  const {root,rng,U}=W;
  const walkers=[];
  // sidewalk loops around every block: rounded rectangle 1 m outside the building line
  const loopPt=(b,s,out)=>{
    const h=BLOCK/2-4,r=3,side=2*(h-r),arc=Math.PI*r/2,per=4*side+4*arc;s=((s%per)+per)%per;
    const C=[[h-r,h-r],[h-r,-(h-r)],[-(h-r),-(h-r)],[-(h-r),h-r]],Nn=[[0,1],[1,0],[0,-1],[-1,0]];
    for(let k=0;k<4;k++){
      if(s<side){const n=Nn[k],t=[n[1],-n[0]],a=C[(k+3)%4];const x=a[0]+n[0]*r+t[0]*s,z=a[1]+n[1]*r+t[1]*s;out.x=b.cx+x;out.z=b.cz+z;out.dx=t[0];out.dz=t[1];return;}
      s-=side;
      if(s<arc){const a0=Math.atan2(Nn[k][1],Nn[k][0]),a=a0-s/r;const c=C[k];out.x=b.cx+c[0]+Math.cos(a)*r;out.z=b.cz+c[1]+Math.sin(a)*r;out.dx=Math.sin(a);out.dz=-Math.cos(a);return;}
      s-=arc;
    }
  };
  for(const b of W.blocks){
    if(b.district==='center')continue;
    const park=b.district==='park',theme=PARK_THEME[b.i+','+b.j];
    const n=park?7:4+((rng()*4)|0);
    for(let k=0;k<n;k++){
      const inPark=park&&k<4&&theme!=='fair';
      const rx=theme==='pond'?20:18,rz=theme==='pond'?16:18;
      walkers.push({kind:inPark?'circle':'block',b,s:rng()*300,dir:rng()<.5?1:-1,v:1+rng()*.6,rx,rz,
        shirt:SHIRTS[(rng()*SHIRTS.length)|0],pants:PANTS[(rng()*PANTS.length)|0],skin:SKIN[(rng()*SKIN.length)|0],ph:rng()*6,sc:.92+rng()*.16,balloon:rng()<.08?SHIRTS[(rng()*8)|0]:null});
    }
  }
  for(let k=0;k<70;k++)walkers.push({kind:'line',x0:-WALK_OUT+6,x1:WALK_OUT-6,z:RIVER_Z0-6-rng()*8,s:rng()*600,dir:rng()<.5?1:-1,v:1+rng()*.5,
    shirt:SHIRTS[(rng()*SHIRTS.length)|0],pants:PANTS[(rng()*PANTS.length)|0],skin:SKIN[(rng()*SKIN.length)|0],ph:rng()*6,sc:.92+rng()*.16,balloon:rng()<.15?SHIRTS[(rng()*8)|0]:null});
  for(let k=0;k<16;k++)walkers.push({kind:'bridge',x:BRIDGE_X+(k%2?-8:8),s:rng()*200,dir:rng()<.5?1:-1,v:1+rng()*.4,
    shirt:SHIRTS[(rng()*SHIRTS.length)|0],pants:PANTS[(rng()*PANTS.length)|0],skin:SKIN[(rng()*SKIN.length)|0],ph:rng()*6,sc:.95,balloon:null});
  const geo=personGeo(),n=walkers.length;
  for(const [k,sz] of [['aShirt',3],['aPants',3],['aSkin',3],['aWalk',2]])geo.setAttribute(k,new THREE.InstancedBufferAttribute(new Float32Array(n*sz),sz));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7});
  hook(mat,'people',s=>{s.uniforms.uTime=U.uTime;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float part;attribute vec3 aShirt,aPants,aSkin;attribute vec2 aWalk;uniform float uTime;')
      .replace('#include <color_vertex>','vColor=part<.5||(part>2.5&&part<4.5)?aShirt:part<2.5?aPants:part<5.5?aSkin:aSkin*.35;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
{float ph=uTime*aWalk.y*5.2+aWalk.x;float sw=sin(ph);float mv=step(.05,aWalk.y);
 if(part>.5&&part<2.5){float a=sw*.5*(part<1.5?1.:-1.)*mv;vec2 q=vec2(transformed.x,transformed.y-.86);transformed.x=q.x*cos(a)-q.y*sin(a);transformed.y=q.x*sin(a)+q.y*cos(a)+.86;}
 if(part>2.5&&part<4.5){float a=-sw*.45*(part<3.5?1.:-1.)*mv;vec2 q=vec2(transformed.x,transformed.y-1.4);transformed.x=q.x*cos(a)-q.y*sin(a);transformed.y=q.x*sin(a)+q.y*cos(a)+1.4;}
 transformed.y+=abs(cos(ph))*.045*mv;}`);});
  const mesh=new THREE.InstancedMesh(geo,mat,n);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;mesh.layers.set(1);root.add(mesh);
  const bg=mergeGeometries([new THREE.SphereGeometry(.32,12,10).scale(1,1.15,1).translate(0,2.75,0),new THREE.CylinderGeometry(.006,.006,1.25,3).translate(0,2.0,.0)].map(g=>g.toNonIndexed()));
  const bmesh=new THREE.InstancedMesh(bg,new THREE.MeshPhysicalMaterial({roughness:.2,clearcoat:1}),80);bmesh.count=0;bmesh.frustumCulled=false;bmesh.layers.set(1);root.add(bmesh);
  bmesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(80*3),3);
  const pt={x:0,z:0,dx:1,dz:0},m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3(),Y=new THREE.Vector3(0,1,0);
  const A=geo.attributes;
  W.people=walkers;
  W.updatePeople=(dt,cam,maxD)=>{
    let j=0,bj=0;const md2=maxD*maxD;
    for(const w of walkers){
      w.s+=w.v*w.dir*dt;
      let y=SLAB;
      if(w.kind==='block')loopPt(w.b,w.s,pt);
      else if(w.kind==='circle'){const a=w.s/w.rx;pt.x=w.b.cx+Math.cos(a)*w.rx;pt.z=w.b.cz+Math.sin(a)*w.rz;pt.dx=-Math.sin(a);pt.dz=Math.cos(a)*w.rz/w.rx;}
      else if(w.kind==='line'){const L=w.x1-w.x0,u=((w.s%(2*L))+2*L)%(2*L);const fw=u<L;pt.x=fw?w.x0+u:w.x1-(u-L);pt.z=w.z;pt.dx=fw?1:-1;pt.dz=0;}
      else{const L=260,u=((w.s%(2*L))+2*L)%(2*L);const fw=u<L;pt.z=RIVER_Z0-12+(fw?u:2*L-u);pt.x=w.x;pt.dx=0;pt.dz=fw?1:-1;y=deckY(pt.z)+.25;}
      const dx=pt.x-cam.x,dz=pt.z-cam.z;if(dx*dx+dz*dz>md2)continue;
      const fx=pt.dx*w.dir,fz=pt.dz*w.dir;
      q.setFromAxisAngle(Y,Math.atan2(-fz,fx));m.compose(p.set(pt.x,y,pt.z),q,sc.set(w.sc,w.sc,w.sc));mesh.setMatrixAt(j,m);
      A.aShirt.array.set(w.shirt,j*3);A.aPants.array.set(w.pants,j*3);A.aSkin.array.set(w.skin,j*3);A.aWalk.array[j*2]=w.ph;A.aWalk.array[j*2+1]=w.v;
      if(w.balloon&&bj<80){m.compose(p.set(pt.x+fz*.3,y+Math.sin(U.uTime.value*1.7+w.ph)*.06,pt.z-fx*.3),q,sc.set(1,1,1));bmesh.setMatrixAt(bj,m);bmesh.instanceColor.array.set(w.balloon,bj*3);bj++;}
      j++;
    }
    mesh.count=j;bmesh.count=bj;
    mesh.instanceMatrix.needsUpdate=true;bmesh.instanceMatrix.needsUpdate=true;bmesh.instanceColor.needsUpdate=true;
    for(const k of ['aShirt','aPants','aSkin','aWalk'])A[k].needsUpdate=true;
  };
}
