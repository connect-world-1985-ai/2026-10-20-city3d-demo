import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {GB,lin,paint,paintF,Instances,hook,canvas,tex,mulberry32} from './util.js';
import {BLOCK,SLAB,PARK_THEME} from './layout.js';
import {swirl,dome,M} from './buildings.js';
import * as T from './textures.js';

const PATH=lin('#f6d9cf'),PATH2=lin('#fff1e6'),WHITE=lin('#fffaf4');
const GREENS=['#7fcf6a','#6cc27a','#8fd97a','#a8e07c','#79c98f','#9bd66b'].map(lin);
const BLOSSOM=['#ffb3cf','#ff9ec4','#f7c6e0','#ffc2d9'].map(lin);
const OTHER=['#c9b3f2','#ffb36b','#ffd97a','#9fe3d1'].map(lin);
const JELLY=['#ff5d8f','#ffb84d','#7bdc5a','#5fc8ff','#b57bff','#ff7a5c','#ffe14d'].map(lin);

function ribbon(gb,pts,w,y,col,closed){
  const n=pts.length;
  for(let i=0;i<(closed?n:n-1);i++){
    const a=pts[i],b=pts[(i+1)%n];
    const pa=pts[(i-1+n)%n],nb=pts[(i+2)%n];
    const ta=closed||i>0?[b[0]-pa[0],b[1]-pa[1]]:[b[0]-a[0],b[1]-a[1]],tb=closed||i<n-2?[nb[0]-a[0],nb[1]-a[1]]:[b[0]-a[0],b[1]-a[1]];
    const la=Math.hypot(...ta),lb=Math.hypot(...tb);
    const oa=[-ta[1]/la*w/2,ta[0]/la*w/2],ob=[-tb[1]/lb*w/2,tb[0]/lb*w/2];
    gb.quad([a[0]-oa[0],y,a[1]-oa[1]],[a[0]+oa[0],y,a[1]+oa[1]],[b[0]+ob[0],y,b[1]+ob[1]],[b[0]-ob[0],y,b[1]-ob[1]],[0,1,0],[[0,0],[1,0],[1,1],[0,1]],col);
  }
}
const circle=(cx,cz,r,n=48,rz=r)=>Array.from({length:n},(_,i)=>[cx+Math.cos(i/n*Math.PI*2)*r,cz+Math.sin(i/n*Math.PI*2)*rz]);
function disc(gb,cx,cz,r,y,col,n=48,rz=r){const c=gb.v([cx,y,cz],[0,1,0],[0,0],col);const ids=circle(cx,cz,r,n,rz).map(p=>gb.v([p[0],y,p[1]],[0,1,0],[0,0],col));for(let i=0;i<n;i++)gb.idx.push(c,ids[(i+1)%n],ids[i]);}

export function buildParks(W){
  const {root,rng,U}=W;
  const grass=new GB(),paths=new GB();
  W.parkLamps=[];W.trees=[];W.flowers=[];W.gumdrops=[];W.lollipops=[];W.ducks=[];
  const grassRect=(cx,cz,w,d,y=SLAB+.012)=>{const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2,s=1/6;grass.quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0],[0,1,0],[[x0*s,z1*s],[x1*s,z1*s],[x1*s,z0*s],[x0*s,z0*s]],[1,1,1]);};
  const PY=SLAB+.03;
  const tree=(x,z,s,kind='puff',y=SLAB)=>{W.trees.push({x,z,s,kind,y});W.circles.push({x,z,r:.45*s});};
  const water=new THREE.MeshStandardMaterial({color:0x8fdcea,roughness:.06,metalness:.1,envMapIntensity:1.3});
  hook(water,'ripple',s=>{s.uniforms.uTime=U.uTime;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWq;').replace('#include <project_vertex>','#include <project_vertex>\nvWq=(modelMatrix*vec4(transformed,1.)).xyz;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;varying vec3 vWq;')
     .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{vec2 p=vWq.xz;float a=sin(p.x*1.3+uTime*1.7)+sin(p.y*1.7-uTime*1.3)+sin((p.x+p.y)*2.3+uTime*2.1)*.5;float b=cos(p.x*1.1-uTime*1.5)+cos(p.y*1.9+uTime*1.2);normal=normalize(normal+(viewMatrix*vec4(a*.04,0.,b*.04,0.)).xyz);}');});
  W.mats.smallWater=water;
  const waterG=new GB();
  for(const b of W.blocks){
    const {cx,cz}=b,ch=W.chunk(b.i,b.j);
    if(b.district==='center'){
      // plaza around the landmark: lawns in the corners, paving elsewhere
      for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        grassRect(cx+sx*23.5,cz+sz*23.5,11,11);
        for(let k=0;k<3;k++)tree(cx+sx*(21+k*2.5),cz+sz*(26-k*2.5),1.2,k===1?'blossom':'puff');
        W.flowers.push(...bedFlowers(rng,cx+sx*20.5,cz+sz*20.5,2.2,40));
      }
      for(let k=0;k<12;k++){const a=(k+.5)/12*Math.PI*2;W.parkLamps.push({x:Math.cos(a)*25,z:Math.sin(a)*25,nx:-Math.cos(a),nz:-Math.sin(a)});}
      continue;
    }
    if(b.district!=='park')continue;
    const theme=PARK_THEME[b.i+','+b.j],R=BLOCK/2-2.6;
    grassRect(cx,cz,R*2,R*2);
    const loopR=theme==='pond'?[20,16]:[18,18];
    let featR=8;
    if(theme!=='fair'){
      ribbon(paths,circle(cx,cz,loopR[0],64,loopR[1]),3,PY,PATH,true);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])ribbon(paths,[[cx+dx*(R+.5),cz+dz*(R+.5)],[cx+dx*(loopR[dx?0:1]-1),cz+dz*(loopR[dx?0:1]-1)]],3,PY+.002,PATH,false);
    }
    if(theme==='fair'){
      disc(paths,cx,cz,R-1,PY,PATH2,64);featR=R;
      buildFerris(W,cx+4,cz);buildCarousel(W,cx-16,cz-16);
      for(const [dx,dz] of [[-20,20],[20,-22],[22,22]])tree(cx+dx,cz+dz,1.2,'blossom');
      W.umbrellas.push([cx-18,PY,cz+10],[cx-12,PY,cz+20]);
      for(let k=0;k<10;k++){const a=k/10*Math.PI*2;W.parkLamps.push({x:cx+Math.cos(a)*25,z:cz+Math.sin(a)*25,nx:-Math.cos(a),nz:-Math.sin(a)});}
      W.circles.push({x:cx+4,z:cz,r:3},{x:cx+4,z:cz-13,r:1.5},{x:cx+4,z:cz+13,r:1.5},{x:cx-16,z:cz-16,r:7.5});
      continue;
    }
    if(theme==='pond'){
      disc(waterG,cx,cz,15,SLAB-.25,[1,1,1],64,11);
      const rim=new THREE.TorusGeometry(1,.28,6,72);rim.rotateX(-Math.PI/2);rim.scale(15,1,11);ch.trim.add(rim,M(cx,SLAB+.02,cz),lin('#fbe9e4'));rim.dispose();
      for(let k=0;k<6;k++)W.ducks.push({cx,cz,r:4+rng()*7,a:rng()*6.28,s:(rng()<.5?-1:1)*(.15+rng()*.12),k});
      for(let k=0;k<14;k++){const a=rng()*6.28,r=.5+rng()*.4;W.flowers.push({x:cx+Math.cos(a)*13*r,z:cz+Math.sin(a)*9.5*r,y:SLAB-.22,pad:true,c:lin('#7bcf6a')});}
      featR=16;W.circles.push({x:cx,z:cz,r:13,ellipse:[15.6,11.6]});
    }else if(theme==='fountain'){
      disc(paths,cx,cz,10,PY+.004,PATH2,48);buildFountain(W,cx,cz,waterG);featR=11;W.circles.push({x:cx,z:cz,r:6.6});
    }else if(theme==='lollipop'){
      disc(paths,cx,cz,6,PY+.004,PATH2,32);
      W.lollipops.push({x:cx,z:cz,s:2.6,k:0});W.circles.push({x:cx,z:cz,r:.6});featR=6;
      for(let k=0;k<26;k++){const a=rng()*6.28,r=8+rng()*18;const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(Math.abs(r-18)<2.4)continue;W.lollipops.push({x,z,s:.8+rng()*.5,k:(rng()*2)|0});W.circles.push({x,z,r:.3});}
      for(let k=0;k<40;k++){const x=cx+(rng()*2-1)*(R-2),z=cz+(rng()*2-1)*(R-2);if(Math.abs(Math.hypot(x-cx,z-cz)-18)<2.5||Math.abs(x-cx)<2.5||Math.abs(z-cz)<2.5)continue;W.gumdrops.push({x,z,s:.6+rng()*.9,c:JELLY[(rng()*JELLY.length)|0]});}
    }else if(theme==='garden'){
      disc(paths,cx,cz,7,PY+.004,PATH2,40);
      buildCupcake(W,ch,cx,cz);featR=7;W.circles.push({x:cx,z:cz,r:2.6});
      for(let q=0;q<4;q++){const a=(q+.5)/4*Math.PI*2;W.flowers.push(...bedFlowers(rng,cx+Math.cos(a)*11.5,cz+Math.sin(a)*11.5,3.4,90));}
    }else if(theme==='bandstand'){
      disc(paths,cx,cz,9,PY+.004,PATH2,40);buildBandstand(W,ch,cx,cz);featR=9;W.circles.push({x:cx,z:cz,r:5.6});
    }
    // park lamps on the loop
    for(let k=0;k<8;k++){const a=(k+.5)/8*Math.PI*2,r=loopR[0]+2;W.parkLamps.push({x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*(loopR[1]+2),nx:-Math.cos(a),nz:-Math.sin(a)});}
    // trees
    const nT=theme==='lollipop'?10:34+((rng()*10)|0);
    for(let k=0;k<nT;k++){
      const x=cx+(rng()*2-1)*(R-1.5),z=cz+(rng()*2-1)*(R-1.5),dx=x-cx,dz=z-cz;
      if(Math.abs(dx)<3||Math.abs(dz)<3)continue;
      const e=Math.hypot(dx/loopR[0],dz/loopR[1]);if(Math.abs(e-1)<.16)continue;
      if(Math.hypot(dx,dz)<featR+3)continue;
      const r=rng();tree(x,z,1+rng()*.6,r<.22?'blossom':r<.38?'cone':'puff');
    }
    for(let k=0;k<4;k++){const a=rng()*6.28,r=featR+2+rng()*3;W.gumdrops.push({x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*r,s:.7,c:GREENS[0]});}
  }
  // pocket gardens inside blocks
  for(const g of W.gardens){
    grassRect(g.cx,g.cz,g.w-1.5,g.d-1.5);
    const n=2+((rng()*4)|0);
    for(let k=0;k<n;k++){const r=rng();tree(g.cx+(rng()*2-1)*(g.w/2-2.5),g.cz+(rng()*2-1)*(g.d/2-2.5),.9+rng()*.5,r<.25?'blossom':r<.35?'cone':'puff');}
    for(let k=0;k<3;k++)W.gumdrops.push({x:g.cx+(rng()*2-1)*(g.w/2-2),z:g.cz+(rng()*2-1)*(g.d/2-2),s:.6+rng()*.4,c:GREENS[(rng()*3)|0]});
  }
  const grassTex=T.makeGrass(W.aniso);
  const gm=new THREE.Mesh(grass.geometry(),new THREE.MeshStandardMaterial({map:grassTex,vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));gm.receiveShadow=true;root.add(gm);
  W.mats.grassTex=grassTex;
  const pm=new THREE.Mesh(paths.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));pm.receiveShadow=true;root.add(pm);
  if(waterG.count){const wm=new THREE.Mesh(waterG.geometry(),water);wm.receiveShadow=true;root.add(wm);}
}
function bedFlowers(rng,cx,cz,r,n){const out=[];const pal=JELLY.concat([WHITE]);for(let k=0;k<n;k++){const a=rng()*6.28,d=Math.sqrt(rng())*r;out.push({x:cx+Math.cos(a)*d,z:cz+Math.sin(a)*d,y:SLAB,c:pal[(rng()*pal.length)|0]});}return out;}

/* ---------- features ---------- */
function buildFerris(W,x,z){
  const g=new THREE.Group();g.position.set(x,SLAB,z);W.root.add(g);
  const R=21,hubY=25,half=1.6;
  const geos=[],steel=lin('#ffffff');
  const ng=x=>{const n=x.index?x.toNonIndexed():x;return n;};
  for(const xx of [-half,half]){const t=paintF(new THREE.TorusGeometry(R,.34,6,64),(x,y)=>Math.floor((Math.atan2(y,x)+Math.PI)/(Math.PI*2)*32)%2?lin('#ff8fb1'):steel);t.rotateY(Math.PI/2);t.translate(xx,0,0);geos.push(ng(t));}
  for(let k=0;k<16;k++){const sp=paint(new THREE.BoxGeometry(2*half,.16,R).translate(0,0,R/2),steel);sp.rotateX(k/16*Math.PI*2);geos.push(ng(sp));}
  geos.push(ng(paint(new THREE.CylinderGeometry(1.5,1.5,2*half+1.4,16).rotateZ(Math.PI/2),lin('#ff5d8f'))));
  const wm=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshStandardMaterial({vertexColors:true,metalness:.2,roughness:.35}));
  wm.castShadow=true;const rim=new THREE.Group();rim.position.y=hubY;rim.add(wm);g.add(rim);
  const legs=[];
  for(const xx of [-half-.3,half+.3])for(const sz of [-1,1]){
    const a=new THREE.Vector3(xx,0,sz*R*.62),b=new THREE.Vector3(xx,hubY,0),d=b.clone().sub(a),len=d.length();
    const bg=paint(new THREE.BoxGeometry(.6,len,.6),lin('#bfeee0'));
    bg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
    const mid=a.clone().add(b).multiplyScalar(.5);bg.translate(mid.x,mid.y,mid.z);legs.push(ng(bg));
  }
  const booth=paint(new THREE.BoxGeometry(3,2.6,3).translate(0,1.3,-R*.62-3.5),lin('#fff1f6'));legs.push(ng(booth));
  const lm=new THREE.Mesh(mergeGeometries(legs),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5}));lm.castShadow=true;g.add(lm);
  const gc=16,gg=(()=>{const b=new THREE.SphereGeometry(1.25,14,10).scale(1,1.05,1).translate(0,-1.5,0);const r=new THREE.CylinderGeometry(.06,.06,1,5).translate(0,-.4,0);const top=new THREE.ConeGeometry(1.1,.6,14).translate(0,-.05,0);return mergeGeometries([paint(b,[1,1,1]).toNonIndexed(),paint(r,lin('#fff')).toNonIndexed(),paint(top,lin('#fffaf4')).toNonIndexed()]);})();
  const gm=new THREE.InstancedMesh(gg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.25}),gc);
  const gcols=['#ff7aa8','#ffd36b','#6fd8ff','#9ae07a','#c8a2ff','#ffa36b'];
  for(let k=0;k<gc;k++)gm.setColorAt(k,new THREE.Color(gcols[k%gcols.length]));
  gm.castShadow=true;gm.frustumCulled=false;g.add(gm);
  const nb=64,bm=new THREE.InstancedMesh(new THREE.SphereGeometry(.26,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),nb);
  W.mats.wheelBulb=bm.material;bm.frustumCulled=false;g.add(bm);
  const bcol=['#ff6a9a','#ffe36a','#6fd8ff','#9aff7a','#e29bff'];
  for(let k=0;k<nb;k++)bm.setColorAt(k,new THREE.Color(bcol[k%bcol.length]));
  W.glow.push([x,SLAB+hubY,z,1,.75,.85,24,2]);
  const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1);let rot=0;
  const upd=dt=>{
    rot+=dt*.1;rim.rotation.x=rot;
    for(let k=0;k<gc;k++){const a=rot+k/gc*Math.PI*2;p.set(0,hubY-Math.sin(a)*R,Math.cos(a)*R);m.compose(p,q,s);gm.setMatrixAt(k,m);}
    gm.instanceMatrix.needsUpdate=true;
    for(let k=0;k<nb;k++){const a=rot+k/nb*Math.PI*2;p.set((k%2?1:-1)*(half+.1),hubY-Math.sin(a)*(R+.4),Math.cos(a)*(R+.4));m.compose(p,q,s);bm.setMatrixAt(k,m);}
    bm.instanceMatrix.needsUpdate=true;
  };
  upd(0);W.updaters.push(upd);
}
function buildCarousel(W,x,z){
  const g=new THREE.Group();g.position.set(x,SLAB,z);W.root.add(g);
  const st=new GB(),rot=new GB();
  const base=new THREE.CylinderGeometry(7,7.2,.6,32);base.translate(0,.3,0);st.add(base,null,lin('#fff1e6'));
  const plat=new THREE.CylinderGeometry(6.6,6.6,.25,32);plat.translate(0,.72,0);rot.add(plat,null,(v)=>Math.floor((Math.atan2(v.z,v.x)+Math.PI)/(Math.PI*2)*16)%2?lin('#ffd1e0'):lin('#fffaf4'));
  const pole=new THREE.CylinderGeometry(.6,.6,5.2,16,8);pole.translate(0,3.2,0);rot.add(pole,null,(v)=>Math.floor((Math.atan2(v.z,v.x)/(Math.PI*2)+v.y*.3)*6+30)%2?lin('#ff5d8f'):lin('#fffaf4'));
  const roof=new THREE.ConeGeometry(7.6,3.2,32,2);roof.translate(0,7.4,0);rot.add(roof,null,(v)=>Math.floor((Math.atan2(v.z,v.x)+Math.PI)/(Math.PI*2)*16)%2?lin('#ff7aa8'):lin('#fffaf4'));
  const val=new THREE.CylinderGeometry(7.6,7.6,.7,32,1,true);val.translate(0,5.45,0);rot.add(val,null,(v)=>Math.floor((Math.atan2(v.z,v.x)+Math.PI)/(Math.PI*2)*32)%2?lin('#ffd84d'):lin('#ff7aa8'));
  const top=new THREE.SphereGeometry(.6,12,8);top.translate(0,9.3,0);rot.add(top,null,lin('#ffd84d'));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,side:THREE.DoubleSide});
  const sm=new THREE.Mesh(st.geometry(),mat);sm.receiveShadow=true;g.add(sm);
  const spin=new THREE.Group();g.add(spin);
  const rm=new THREE.Mesh(rot.geometry(),mat);rm.castShadow=true;spin.add(rm);
  const horses=[];const hc=['#ffffff','#ffd1e0','#cfeeff','#fff3b0','#e6d4ff','#d4f5e6'].map(c=>lin(c));
  for(let k=0;k<12;k++){
    const a=k/12*Math.PI*2,r=k%2?4.9:3.5,h=new GB(),c=hc[k%hc.length];
    const body=new THREE.SphereGeometry(.55,10,8);body.scale(1.6,.8,.7);h.add(body,null,c);
    const head=new THREE.SphereGeometry(.32,8,6);head.scale(1.2,.9,.8);h.add(head,M(.85,.55,0),c);
    const neck=new THREE.CylinderGeometry(.18,.24,.7,6);h.add(neck,M(.65,.35,0,1,1,1).multiply(new THREE.Matrix4().makeRotationZ(-.6)),c);
    for(const lx of [-.5,.5])for(const lz of [-.2,.2]){const leg=new THREE.CylinderGeometry(.08,.07,.7,5);h.add(leg,M(lx,-.55,lz).multiply(new THREE.Matrix4().makeRotationZ(lx>0?.5:-.4)),c);}
    h.box(-.25,.42,-.36,.25,.5,.36,lin('#ff5d8f'));
    const pl=new THREE.CylinderGeometry(.05,.05,5,6);h.add(pl,M(0,.9,0),lin('#ffd84d'));
    const mesh=new THREE.Mesh(h.geometry(),mat);mesh.castShadow=true;
    const holder=new THREE.Group();holder.position.set(Math.cos(a)*r,2.2,Math.sin(a)*r);holder.rotation.y=-a;mesh.rotation.y=Math.PI/2;holder.add(mesh);spin.add(holder);
    horses.push({m:mesh,ph:k*.9});
  }
  for(let k=0;k<16;k++){const a=k/16*Math.PI*2;W.glow.push([x+Math.cos(a)*7.4,SLAB+5.2,z+Math.sin(a)*7.4,1,.85,.55,3.2,0]);}
  let t=0;W.updaters.push(dt=>{t+=dt;spin.rotation.y=t*.35;for(const h of horses)h.m.position.y=Math.sin(t*2.2+h.ph)*.35;});
}
function buildFountain(W,cx,cz,waterG){
  const ch=W.chunk(...W.blockOf(cx,cz));
  const basin=new THREE.TorusGeometry(6.2,.45,8,64);basin.rotateX(-Math.PI/2);ch.trim.add(basin,M(cx,SLAB+.4,cz),lin('#fff1f6'));basin.dispose();
  const wall=new THREE.CylinderGeometry(6.2,6.2,.8,64,1,true);ch.trim.add(wall,M(cx,SLAB+.2,cz),lin('#ffd1e0'));wall.dispose();
  disc(waterG,cx,cz,6.1,SLAB+.55,[1,1,1],64);
  // three tier cake
  const tiers=[[3.4,1.6,lin('#ffb3cc')],[2.4,1.3,lin('#fffaf4')],[1.5,1.1,lin('#bfeee0')]];
  let y=SLAB+.5;
  for(const [r,h,c] of tiers){
    const cyl=new THREE.CylinderGeometry(r,r,h,40);ch.candy.add(cyl,M(cx,y+h/2,cz),c);cyl.dispose();
    const ring=new THREE.TorusGeometry(r,.22,8,48);ring.rotateX(-Math.PI/2);ch.icing.add(ring,M(cx,y+h,cz),lin('#fffaf4'));ring.dispose();
    for(let k=0;k<Math.round(r*5);k++){const a=k/Math.round(r*5)*Math.PI*2,dl=.3+((k*7)%5)*.12;const dr=new THREE.CapsuleGeometry(.12,dl,3,6);ch.icing.add(dr,M(cx+Math.cos(a)*(r+.05),y+h-dl/2-.05,cz+Math.sin(a)*(r+.05)),lin('#fffaf4'));dr.dispose();}
    y+=h;
  }
  const ch2=new THREE.SphereGeometry(.45,12,8);ch.icing.add(ch2,M(cx,y+.4,cz),lin('#e8213f'));ch2.dispose();
  // falling water sheets (animated) + spray particles
  const sheetMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:W.U.uTime,uDay:W.U.uDay},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uTime,uDay;varying vec2 vUv;void main(){float s=fract(vUv.y*3.+uTime*1.6+sin(vUv.x*40.)*.1);float a=(.25+.35*smoothstep(.6,1.,s))*smoothstep(0.,.15,vUv.y);gl_FragColor=vec4(mix(vec3(.75,.92,1.),vec3(1.),s)*(.5+.5*uDay)+.15,a);}'});
  let yy=SLAB+.5;
  for(const [r,h] of tiers){yy+=h;const sh=new THREE.CylinderGeometry(r+.35,r+.75,h+.4,40,1,true);const m=new THREE.Mesh(sh,sheetMat);m.position.set(cx,yy-h/2-.2,cz);m.userData.noAO=true;W.root.add(m);}
  const n=500,pos=new Float32Array(n*3),seed=new Float32Array(n*4),r=mulberry32(3);
  for(let i=0;i<n;i++){pos[i*3]=cx;pos[i*3+1]=y+.6;pos[i*3+2]=cz;seed[i*4]=r()*6.28;seed[i*4+1]=.8+r()*1.6;seed[i*4+2]=r();seed[i*4+3]=5+r()*3;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('seed',new THREE.BufferAttribute(seed,4));
  const pm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:W.U.uTime,uScale:W.U.uPointScale,uDay:W.U.uDay},
    vertexShader:`attribute vec4 seed;uniform float uTime,uScale;varying float vA;void main(){float T=1.6;float t=fract(uTime/T+seed.z)*T;
      vec3 v=vec3(cos(seed.x)*seed.y,seed.w,sin(seed.x)*seed.y);vec3 p=position+v*t-vec3(0.,4.9,0.)*t*t;
      vA=smoothstep(0.,.1,t)*(1.-t/T);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(.16*uScale/-mv.z,1.,24.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:'uniform float uDay;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=1.-smoothstep(.2,.5,length(c));gl_FragColor=vec4(vec3(.9,.97,1.)*(.4+.6*uDay)+.1,d*vA*.8);}'});
  const pts=new THREE.Points(g,pm);pts.frustumCulled=false;pts.userData.noAO=true;W.root.add(pts);
}
function buildCupcake(W,ch,cx,cz){
  const ped=new THREE.CylinderGeometry(2.2,2.5,1,24);ch.trim.add(ped,M(cx,SLAB+.5,cz),lin('#fff1e6'));ped.dispose();
  const wrap=new THREE.CylinderGeometry(2.3,1.7,2.4,32);ch.candy.add(wrap,M(cx,SLAB+2.2,cz),(v)=>Math.floor((Math.atan2(v.z-cz,v.x-cx)+Math.PI)/(Math.PI*2)*32)%2?lin('#ff8fb1'):lin('#ffb3cc'));wrap.dispose();
  swirl(ch.icing,cx,cz,SLAB+3.3,2.5,lin('#fff3f8'),mulberry32(9));
  // sprinkles
  const r=mulberry32(4);for(let k=0;k<60;k++){const a=r()*6.28,h=r()*2.2,rad=2.1*(1-h/2.6);const b=new THREE.CapsuleGeometry(.05,.18,2,4);ch.candy.add(b,M(cx+Math.cos(a)*rad,SLAB+3.6+h,cz+Math.sin(a)*rad,1,1,1,r()*3).multiply(new THREE.Matrix4().makeRotationZ(r()*3)),JELLY[k%JELLY.length]);b.dispose();}
}
function buildBandstand(W,ch,cx,cz){
  const base=new THREE.CylinderGeometry(5.4,5.6,.9,8);ch.trim.add(base,M(cx,SLAB+.45,cz),lin('#fff1e6'));base.dispose();
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2+Math.PI/8,p=new THREE.CylinderGeometry(.14,.14,4,8);ch.candy.add(p,M(cx+Math.cos(a)*4.9,SLAB+2.9,cz+Math.sin(a)*4.9),(v)=>Math.floor(v.y*2.5)%2?lin('#ff5d8f'):lin('#fffaf4'));p.dispose();}
  const rim=new THREE.CylinderGeometry(5.6,5.6,.5,8,1,true);ch.trim.add(rim,M(cx,SLAB+5.1,cz),lin('#ff8fb1'));rim.dispose();
  dome(ch.candy,cx,cz,SLAB+5.3,5.6,lin('#ff8fb1'),lin('#fffaf4'),.6);
  for(let k=0;k<24;k++){const a=k/24*Math.PI*2;W.glow.push([cx+Math.cos(a)*5.7,SLAB+4.9,cz+Math.sin(a)*5.7,1,.8,.55,2.4,0]);}
}

/* ---------- trees, flowers, gumdrops, lollipops, ducks ---------- */
export function buildTrees(W){
  const {root,rng,U}=W;
  for(const [x,z] of W.streetTrees){const r=rng();W.trees.push({x,z,s:.85+rng()*.3,kind:r<.2?'blossom':'puff',y:SLAB});W.circles.push({x,z,r:.4});}
  for(const t of W.roofTrees)W.trees.push({x:t[0],z:t[2],s:.55+rng()*.2,kind:rng()<.4?'blossom':'puff',y:t[1]});
  for(const t of (W.farTrees||[]))W.trees.push(t);
  const fol=(g,f)=>{g.setAttribute('fol',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(f),1));return g.index?g.toNonIndexed():g;};
  const blob=(r,x,y,z,det)=>{const g=new THREE.IcosahedronGeometry(r,det);const p=g.attributes.position;
    const nr=g.attributes.normal;
    for(let i=0;i<p.count;i++){const vx=p.getX(i),vy=p.getY(i),vz=p.getZ(i);const n=1+.08*Math.sin(vx*5.1+vz*3.7)+.06*Math.sin(vy*6.3+vx*2.1);p.setXYZ(i,vx*n+x,vy*n*.92+y,vz*n+z);const l=Math.hypot(vx,vy,vz)||1;nr.setXYZ(i,vx/l,vy/l,vz/l);}paint(g,(px,py)=>{const t=Math.min(1,Math.max(0,(py-(y-r))/(2*r)));const c=.62+.38*t;return [c,c,c];});return fol(g,1);};
  const trunk=(h,r)=>fol(paint(new THREE.CylinderGeometry(r*.7,r,h,7).translate(0,h/2,0),lin('#9b6a52')),0);
  const puffNear=mergeGeometries([trunk(2.6,.22),blob(1.75,0,3.9,0,2),blob(1.25,1,3.3,.5,1),blob(1.3,-.85,3.5,-.55,1),blob(1.1,.1,4.9,-.3,1),blob(1.05,-.4,3.1,.95,1)]);
  const puffFar=mergeGeometries([trunk(2.6,.24),blob(2.2,0,3.9,0,1)]);
  const coneNear=(()=>{const parts=[trunk(1.6,.2)];[[2,1.6,2.2],[1.6,3,2],[1.1,4.3,1.8]].forEach(([r,y,h])=>{const c=new THREE.ConeGeometry(r,h,10,2).translate(0,y+h/2-.3,0);paint(c,(x,yy)=>{const t=(yy-y)/h;const v=.7+.3*t;return[v,v,v];});parts.push(fol(c,1));});return mergeGeometries(parts);})();
  const coneFar=mergeGeometries([trunk(1.6,.22),fol(paint(new THREE.ConeGeometry(2,4.6,7).translate(0,3.6,0),[.85,.85,.85]),1)]);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});
  hook(mat,'tree',s=>{s.uniforms.uTime=U.uTime;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float fol;uniform float uTime;')
      .replace('#include <color_vertex>','vColor=vec3(color);\n#ifdef USE_INSTANCING_COLOR\nvColor*=mix(vec3(1.),instanceColor,fol);\n#endif')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\n{vec2 ip=instanceMatrix[3].xz;float sw=sin(uTime*1.3+ip.x*.11+ip.y*.07)*.5+sin(uTime*2.3+ip.y*.13)*.25;transformed.xz+=vec2(sw,sw*.6)*.06*fol*max(0.,position.y-2.);}\n#endif');});
  const puff=new Instances([{geo:puffNear,mat,max:190},{geo:puffFar,mat,max:1300}]);
  const cone=new Instances([{geo:coneNear,mat,max:190},{geo:coneFar,mat,max:1300}]);
  for(const t of W.trees){
    const pal=t.kind==='blossom'?BLOSSOM:rng()<.12?OTHER:GREENS;const c=pal[(rng()*pal.length)|0];
    const I=t.kind==='cone'?cone:puff;I.add(t.x,t.y,t.z,rng()*6.28,t.s*(.9+rng()*.2),c,null,t.s*(.9+rng()*.3));
  }
  puff.build(root);cone.build(root);W.inst.push(puff,cone);
  // flowers & lily pads
  const flG=(()=>{const h=paint(new THREE.IcosahedronGeometry(.13,0).translate(0,.32,0),[1,1,1]);const st=paint(new THREE.CylinderGeometry(.02,.02,.3,3).translate(0,.15,0),[.35,.6,.3]);return mergeGeometries([h.toNonIndexed(),st.toNonIndexed()]);})();
  const padG=new THREE.CircleGeometry(.55,10,.3,5.8).rotateX(-Math.PI/2);
  const fmat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7});
  const flowers=new Instances([{geo:flG,mat:fmat,max:110,shadow:false}]);
  const pads=new Instances([{geo:padG,mat:new THREE.MeshStandardMaterial({color:0x7bcf6a,roughness:.6}),max:200,shadow:false}]);
  for(const f of W.flowers){if(f.pad)pads.add(f.x,f.y,f.z,rng()*6);else flowers.add(f.x,f.y,f.z,rng()*6,.8+rng()*.5,f.c);}
  flowers.build(root,{shadow:false,layer:1});pads.build(root,{shadow:false,layer:1});W.inst.push(flowers,pads);
  // gumdrop bushes: glossy jelly with sugar sparkle
  const gumG=(()=>{const g=new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*.62);g.scale(1,.95,1);g.translate(0,-.25,0);return g;})();
  const gumMat=new THREE.MeshPhysicalMaterial({roughness:.35,clearcoat:.6,clearcoatRoughness:.3,sheen:.6,sheenColor:new THREE.Color(1,1,1),sheenRoughness:.4});
  hook(gumMat,'sugar',s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
{vec3 q=floor(vViewPosition*18.);float h=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5);totalEmissiveRadiance+=vec3(step(.985,h))*.6;}`);});
  const gum=new Instances([{geo:gumG,mat:gumMat,max:230}]);
  for(const g of W.gumdrops)gum.add(g.x,SLAB,g.z,0,g.s,g.c,null,g.s*.9);
  gum.build(root,{layer:1});W.inst.push(gum);
  // lollipops
  const swirlTex=(cols)=>{const c=canvas(256,256),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,256,256);
    for(let a=0;a<Math.PI*2*5;a+=.02){const r=a/(Math.PI*10)*124;const k=Math.floor(a/(Math.PI/1.5))%cols.length;x.strokeStyle=cols[k];x.lineWidth=13;x.beginPath();x.arc(128,128,Math.max(1,r),a,a+.03);x.stroke();}
    const g=x.createRadialGradient(100,90,4,128,128,128);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.4,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,256,256);return tex(c,{repeat:false,aniso:4});};
  const lolG=(()=>{const d=new THREE.CylinderGeometry(1.3,1.3,.32,40,1);d.rotateX(Math.PI/2);d.translate(0,4.2,0);return d;})();
  const stickG=new THREE.CylinderGeometry(.08,.08,4,8).translate(0,2,0);
  const lolMats=[swirlTex(['#ff4d6d','#ffd23f','#3fc1ff','#7bdc5a','#b57bff']),swirlTex(['#ff5d8f','#ffffff'])].map(t=>new THREE.MeshPhysicalMaterial({map:t,roughness:.15,clearcoat:1,clearcoatRoughness:.1}));
  const lolI=lolMats.map(m=>new Instances([{geo:lolG,mat:m,max:400}]));
  const stickI=new Instances([{geo:stickG,mat:new THREE.MeshStandardMaterial({color:0xfffaf4,roughness:.5}),max:300}]);
  for(const l of W.lollipops){const ry=rng()*6.28;lolI[l.k].add(l.x,SLAB,l.z,ry,l.s);stickI.add(l.x,SLAB,l.z,ry,l.s);}
  lolI.forEach(i=>{i.build(root);W.inst.push(i);});stickI.build(root);W.inst.push(stickI);
  // rubber ducks
  if(W.ducks.length){
    const dg=new GB(),Y=lin('#ffd93d'),O=lin('#ff9a3d');
    const b=new THREE.SphereGeometry(.5,12,8);b.scale(1.25,.8,1);dg.add(b,M(0,.25,0),Y);
    const h=new THREE.SphereGeometry(.32,12,8);dg.add(h,M(.42,.78,0),Y);
    const bk=new THREE.ConeGeometry(.12,.3,8);bk.rotateZ(-Math.PI/2);dg.add(bk,M(.8,.74,0),O);
    const tail=new THREE.ConeGeometry(.18,.35,6);tail.rotateZ(.9);dg.add(tail,M(-.65,.45,0),Y);
    const dm=new THREE.InstancedMesh(dg.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3}),W.ducks.length);
    dm.frustumCulled=false;dm.castShadow=true;root.add(dm);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(1,1,1),Yax=new THREE.Vector3(0,1,0);let t=0;
    W.updaters.push(dt=>{t+=dt;W.ducks.forEach((d,i)=>{d.a+=d.s*dt;p.set(d.cx+Math.cos(d.a)*d.r,SLAB-.3+Math.sin(t*2+i)*.04,d.cz+Math.sin(d.a)*d.r*.7);q.setFromAxisAngle(Yax,-d.a-Math.sign(d.s)*Math.PI/2);m.compose(p,q,s);dm.setMatrixAt(i,m);});dm.instanceMatrix.needsUpdate=true;});
  }
}
