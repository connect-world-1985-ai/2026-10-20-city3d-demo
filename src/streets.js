import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {GB,lin,paint,paintF,Instances,hook,mixc} from './util.js';
import {BLOCK,ROAD,P,N,SLAB,EDGE,WALK_OUT,RIVER_Z0,BRIDGE_X,bc,rc,SIGNAL_GLSL,sigPhase} from './layout.js';
import {outline} from './buildings.js';
import * as T from './textures.js';

const CORNER_R=3.5;
const CURB=lin('#f3e9e4'),CURB_PINK=lin('#ff8fb1');

function slab(gb,x0,z0,x1,z1,r,y=SLAB){
  const E=outline(x0,z0,x1,z1,r>0?'round':'rect',r);
  const pts=[],nrm=[];for(const e of E)for(let i=0;i<e.pts.length-1;i++){pts.push(e.pts[i]);nrm.push(e.nrm[i]);}
  const s=.25,c=gb.v([(x0+x1)/2,y,(z0+z1)/2],[0,1,0],[(x0+x1)/2*s,(z0+z1)/2*s],[1,1,1]);
  const ids=pts.map(p=>gb.v([p[0],y,p[1]],[0,1,0],[p[0]*s,p[1]*s],[1,1,1]));
  for(let i=0;i<ids.length;i++)gb.idx.push(c,ids[i],ids[(i+1)%ids.length]);
  // curb side: candy stripes near the corners
  let acc=0;
  for(const e of E)for(let i=0;i<e.pts.length-1;i++){
    const a=e.pts[i],b=e.pts[i+1],na=e.nrm[i],nb=e.nrm[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const m=Math.max(1,Math.round(l/1.2));
    for(let k=0;k<m;k++){
      const t0=k/m,t1=(k+1)/m,p0=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],p1=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1];
      const col=e.face<0||(k<3||k>=m-3)?(((acc+k)%2)?CURB_PINK:CURB):CURB;
      const i0=gb.v([p0[0],0,p0[1]],[na[0],0,na[1]],[0,0],col);gb.v([p1[0],0,p1[1]],[nb[0],0,nb[1]],[0,0],col);gb.v([p1[0],y,p1[1]],[nb[0],0,nb[1]],[0,0],col);gb.v([p0[0],y,p0[1]],[na[0],0,na[1]],[0,0],col);
      gb.idx.push(i0,i0+1,i0+2,i0,i0+2,i0+3);
    }
    acc+=m;
  }
}

export function buildStreets(W){
  const {root,rng,U,aniso}=W;
  /* ---------- ground: asphalt ---------- */
  const asphalt=T.makeAsphalt(aniso);asphalt.repeat.set(EDGE*2/14,EDGE*2/14);
  const roadMat=new THREE.MeshStandardMaterial({map:asphalt,roughness:.78,envMapIntensity:.7});
  hook(roadMat,'wet',s=>{ // a little wetness/sheen in puddles that shows at night
    s.uniforms.uNight=U.uNight;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;').replace('#include <project_vertex>','#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;uniform float uNight;float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nfloat pud=smoothstep(.62,.7,vn(vWp.xz*.09)*.65+vn(vWp.xz*.31)*.35);roughnessFactor=mix(roughnessFactor,.08,pud*(.35+.65*uNight));diffuseColor.rgb*=1.-pud*.25;');
  });
  W.mats.road=roadMat;
  const road=new THREE.Mesh(new THREE.PlaneGeometry(EDGE*2,EDGE*2).rotateX(-Math.PI/2),roadMat);
  road.receiveShadow=true;root.add(road);
  // the bridge approach crosses the promenade
  const ap=new THREE.Mesh(new THREE.PlaneGeometry(ROAD,RIVER_Z0-EDGE+.2).rotateX(-Math.PI/2).translate(BRIDGE_X,0,(EDGE+RIVER_Z0)/2),roadMat);ap.receiveShadow=true;root.add(ap);

  /* ---------- sidewalks ---------- */
  const paving=T.makePaving(aniso);
  const walkMat=new THREE.MeshStandardMaterial({map:paving,vertexColors:true,roughness:.85});
  const walk=new GB();
  for(const b of W.blocks)slab(walk,b.cx-BLOCK/2,b.cz-BLOCK/2,b.cx+BLOCK/2,b.cz+BLOCK/2,CORNER_R);
  // outer ring sidewalk (north, east, west) and the south promenade split by the bridge road
  slab(walk,-WALK_OUT,-WALK_OUT,WALK_OUT,-EDGE,0);
  slab(walk,-WALK_OUT,-EDGE,-EDGE,EDGE,0);slab(walk,EDGE,-EDGE,WALK_OUT,EDGE,0);
  slab(walk,-WALK_OUT,EDGE,BRIDGE_X-ROAD/2,RIVER_Z0,0);slab(walk,BRIDGE_X+ROAD/2,EDGE,WALK_OUT,RIVER_Z0,0);
  const wm=new THREE.Mesh(walk.geometry(),walkMat);wm.receiveShadow=true;root.add(wm);

  /* ---------- markings ---------- */
  const mk=[];const WHITE=0xf4f1ec,PINK=0xffa8c5,YEL=0xffe08a;
  const line=(x,z,sx,sz,c)=>mk.push([x,z,sx,sz,c]);
  for(let k=-1;k<=8;k++){
    const c=rc(k);
    for(let seg=0;seg<N;seg++){
      const m=bc(seg),a0=m-BLOCK/2,a1=m+BLOCK/2,L=BLOCK-2*CORNER_R;
      for(const o of [-.2,.2]){line(c+o,m,.13,BLOCK-20,YEL);line(m,c+o,BLOCK-20,.13,YEL);}
      for(const o of [-6.3,6.3]){line(c+o,m,.15,L-1,WHITE);line(m,c+o,L-1,.15,WHITE);}
      // zebra crossings near both ends of the segment, stop lines behind them
      for(const [e,sg] of [[a0+5,1],[a1-5,-1]]){
        for(let w=-6;w<=6.01;w+=1.2){line(c+w,e,.62,2.8,WHITE);line(e,c+w,2.8,.62,WHITE);}
      }
      line(c+3.5,a0+7.6,6.6,.4,WHITE);line(c-3.5,a1-7.6,6.6,.4,WHITE);
      line(a0+7.6,c-3.5,.4,6.6,WHITE);line(a1-7.6,c+3.5,.4,6.6,WHITE);
      // painted pink hearts... as a pastel bus-lane style block at a few segments
      if(rng()<.08){line(c+3.5,m,4.2,6,PINK);}
    }
  }
  const lineMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const lines=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),lineMat,mk.length);
  {const m=new THREE.Matrix4(),c=new THREE.Color();mk.forEach((v,i)=>{m.makeScale(v[2],1,v[3]).setPosition(v[0],.012,v[1]);lines.setMatrixAt(i,m);lines.setColorAt(i,c.setHex(v[4]));});}
  lines.receiveShadow=true;root.add(lines);
  // manholes
  {const n=180,mh=new THREE.InstancedMesh(new THREE.CircleGeometry(.6,16).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x4a3f44,roughness:.5,metalness:.4,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),n);
   const m=new THREE.Matrix4();for(let i=0;i<n;i++){const k=((rng()*10)|0)-1,s=(rng()-.5)*EDGE*1.9,o=(rng()<.5?-1:1)*(2+rng()*2.5);if(rng()<.5)m.makeTranslation(rc(k)+o,.014,s);else m.makeTranslation(s,.014,rc(k)+o);mh.setMatrixAt(i,m);}
   mh.receiveShadow=true;root.add(mh);}

  /* ---------- traffic signals ---------- */
  const poleG=(()=>{
    const c=lin('#e9f3f0'),k=lin('#7cc9b6');
    const pole=paintF(new THREE.CylinderGeometry(.1,.13,6.6,8,12).translate(0,3.3,0),(x,y)=>y<1.1||(y>3&&y<3.6)?k:c);
    const arm=paint(new THREE.CylinderGeometry(.07,.07,5.8,6).rotateZ(Math.PI/2).translate(-2.9,6.4,0),c);
    const sign=paint(new THREE.BoxGeometry(1.5,.32,.05).translate(-1.1,5.8,0),lin('#ff8fb1'));
    const ped=paint(new THREE.BoxGeometry(.3,.5,.28).translate(.25,2.7,0),lin('#5d5560'));
    return mergeGeometries([pole,arm,sign,ped].map(g=>g.toNonIndexed()));
  })();
  const headG=(()=>{
    const parts=[];const housing=paint(new THREE.BoxGeometry(.48,1.36,.36).translate(-5.5,6.05,0),lin('#ffd84d'));
    housing.setAttribute('bulb',new THREE.Float32BufferAttribute(new Array(housing.attributes.position.count).fill(-1),1));parts.push(housing.toNonIndexed());
    for(let b=0;b<3;b++){
      const y=6.05+(1-b)*.42;
      const g=paint(new THREE.CylinderGeometry(.15,.15,.04,12).rotateX(Math.PI/2).translate(-5.5,y,.19),[1,1,1]);
      g.setAttribute('bulb',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(b),1));parts.push(g.toNonIndexed());
      const v=paint(new THREE.BoxGeometry(.36,.04,.2).translate(-5.5,y+.17,.28),lin('#3a3438'));
      v.setAttribute('bulb',new THREE.Float32BufferAttribute(new Array(v.attributes.position.count).fill(-1),1));parts.push(v.toNonIndexed());
    }
    return mergeGeometries(parts);
  })();
  const headMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4});
  hook(headMat,'signal',s=>{
    s.uniforms.uTime=U.uTime;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float bulb;attribute vec2 aSig;varying float vBulb;varying vec2 vSig;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBulb=bulb;vSig=aSig;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;varying float vBulb;varying vec2 vSig;'+SIGNAL_GLSL)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
if(vBulb>-.5){float st=sigState(uTime,vSig.x,vSig.y);float b=floor(vBulb+.5);
  vec3 bc=b<.5?vec3(1.,.08,.1):b<1.5?vec3(1.,.62,.05):vec3(.1,1.,.45);
  float on=(b<.5&&st>1.5)||(b>.5&&b<1.5&&st>.5&&st<1.5)||(b>1.5&&st<.5)?1.:0.;
  diffuseColor.rgb=bc*.15;totalEmissiveRadiance=bc*(on*4.+.04);}`);
  });
  const poleI=new Instances([{geo:poleG,mat:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4,metalness:.2}),max:420}]);
  const headI=new Instances([{geo:headG,mat:headMat,max:420,shadow:false}],{extras:{aSig:2}});
  W.signals=[];
  for(let kx=0;kx<8;kx++)for(let kz=0;kz<8;kz++){
    const cx=rc(kx),cz=rc(kz),ph=sigPhase(kx,kz);
    W.signals.push({cx,cz,ph});
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){ // approach direction of travel
      const rx=-dz,rz=dx; // driver's right
      const px=cx-dx*7+rx*7+(rx-dx)*1.1,pz=cz-dz*7+rz*7+(rz-dz)*1.1;
      const ry=Math.atan2(-dx,-dz),axis=dx!==0?0:1;
      poleI.add(px,SLAB,pz,ry);headI.add(px,SLAB,pz,ry,1,null,{aSig:[ph,axis]});
      W.circles.push({x:px,z:pz,r:.25});
    }
  }
  poleI.build(root,{layer:1});headI.build(root,{shadow:false,layer:1});W.inst.push(poleI,headI);

  /* ---------- street furniture ---------- */
  buildFurniture(W);
}

export function buildLamps(W){
  const {root,rng,U}=W;
  /* ---------- candy cane street lamps ---------- */
  const lamps=[];
  for(const b of W.blocks){
    for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const tx=-nz,tz=nx,bx=b.cx+nx*(BLOCK/2-.8),bz=b.cz+nz*(BLOCK/2-.8);
      for(const t of [-17,0,17])lamps.push({x:bx+tx*t,z:bz+tz*t,nx,nz});
    }
  }
  // promenade + outer ring
  for(let x=-WALK_OUT+12;x<WALK_OUT-6;x+=24){if(Math.abs(x-BRIDGE_X)>12)lamps.push({x,z:RIVER_Z0-1.2,nx:0,nz:-1,prom:true});lamps.push({x,z:-EDGE-.9,nx:0,nz:1});}
  for(let z=-EDGE+20;z<EDGE;z+=38){lamps.push({x:EDGE+.9,z,nx:-1,nz:0});lamps.push({x:-EDGE-.9,z,nx:1,nz:0});}
  for(const p of W.parkLamps)lamps.push(p);
  for(const p of W.bridgeLamps)lamps.push(p);
  for(const p of W.farLamps)lamps.push(p);
  const stripes=(x,y,z)=>{const a=Math.atan2(z,x)/(Math.PI*2);return (Math.floor((a+y*.55)*2+40)%2)?lin('#ff4f7b'):lin('#fff7f2');};
  const caneGeo=(()=>{
    const pole=paintF(new THREE.CylinderGeometry(.11,.13,6.2,8,26).translate(0,3.1,0),stripes);
    const hook=paintF(new THREE.TorusGeometry(.75,.11,6,12,Math.PI).translate(.75,6.2,0),(x,y,z,t)=>((t>>4)%2)?lin('#ff4f7b'):lin('#fff7f2'));
    const base=new THREE.CylinderGeometry(.3,.38,.5,8).translate(0,.25,0);paint(base,lin('#fff7f2'));
    const cap=new THREE.ConeGeometry(.42,.42,8).translate(1.5,5.62,0);paint(cap,lin('#ff4f7b'));
    const rod=new THREE.CylinderGeometry(.03,.03,.5,4).translate(1.5,5.95,0);paint(rod,lin('#5a4048'));
    return mergeGeometries([pole,hook,base,cap,rod].map(g=>g.toNonIndexed()));
  })();
  const farGeo=(()=>{const g=new THREE.BoxGeometry(.22,6.4,.22).translate(0,3.2,0);paint(g,lin('#ffd0dc'));const h=new THREE.BoxGeometry(1.6,.18,.18).translate(.8,6.3,0);paint(h,lin('#ff4f7b'));return mergeGeometries([g.toNonIndexed(),h.toNonIndexed()]);})();
  const lampMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.25});
  const lampI=new Instances([{geo:caneGeo,mat:lampMat,max:200},{geo:farGeo,mat:lampMat,max:650,shadow:false}]);
  const bulbGeo=new THREE.SphereGeometry(.3,7,4).scale(1,1.15,1).translate(1.5,5.25,0);
  const bulbMat=new THREE.MeshBasicMaterial({color:0xffffff});W.mats.bulb=bulbMat;
  const bulbI=new Instances([{geo:bulbGeo,mat:bulbMat,max:900,shadow:false}]);
  const pools=[];
  for(const l of lamps){
    const ry=Math.atan2(-l.nz,l.nx); // local +x -> outward over the road
    const ly=l.y??SLAB;lampI.add(l.x,ly,l.z,ry);bulbI.add(l.x,ly,l.z,ry);
    const hx=l.x+l.nx*1.5,hz=l.z+l.nz*1.5;
    W.glow.push([hx,ly+5.25,hz,1,.74,.5,5,0]);pools.push([hx,hz,ly]);
    W.circles.push({x:l.x,z:l.z,r:.3});
  }
  lampI.build(root,{shadow:true});bulbI.build(root,{shadow:false});W.inst.push(lampI,bulbI);
  // light pools on the ground
  const poolMat=new THREE.MeshBasicMaterial({map:T.makePool(),color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,fog:false});
  W.mats.pool=poolMat;
  const poolMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(13,13).rotateX(-Math.PI/2),poolMat,pools.length);
  {const m=new THREE.Matrix4();pools.forEach((p,i)=>{m.makeTranslation(p[0],p[2]+.03,p[1]);poolMesh.setMatrixAt(i,m);});}
  poolMesh.renderOrder=2;poolMesh.userData.noAO=true;root.add(poolMesh);
  W.lampCount=lamps.length;

}

function buildFurniture(W){
  const {root,rng}=W;
  const wood=lin('#f2a7bf'),iron=lin('#fff4ee'),mint=lin('#8fd9c4');
  const benchG=(()=>{const g=new GB();
    for(let k=0;k<3;k++)g.box(-1,.45+k*.0,-.25+k*.17,1,.5,-.1+k*.17,wood);
    for(let k=0;k<2;k++)g.box(-1,.62+k*.18,.27,1,.74+k*.18,.33,wood);
    for(const x of [-.85,.85]){g.box(x-.05,0,-.25,x+.05,.47,.3,iron);g.box(x-.05,.47,.27,x+.05,1,.33,iron);}
    return g.geometry();})();
  const binG=(()=>{const c=paintF(new THREE.CylinderGeometry(.3,.26,.9,12,4).translate(0,.45,0),(x,y)=>Math.floor(y/.225)%2?lin('#ff8fb1'):iron);const l=paint(new THREE.CylinderGeometry(.33,.33,.08,12).translate(0,.92,0),lin('#7a5a66'));return mergeGeometries([c.toNonIndexed(),l.toNonIndexed()]);})();
  const hydG=(()=>{const b=paint(new THREE.CylinderGeometry(.17,.2,.62,10).translate(0,.31,0),lin('#ff5d73'));const t=paint(new THREE.SphereGeometry(.18,10,6,0,Math.PI*2,0,Math.PI/2).translate(0,.62,0),lin('#ffd84d'));const s=paint(new THREE.CylinderGeometry(.07,.07,.5,6).rotateZ(Math.PI/2).translate(0,.42,0),lin('#ff5d73'));return mergeGeometries([b.toNonIndexed(),t.toNonIndexed(),s.toNonIndexed()]);})();
  const bollG=(()=>{const b=paintF(new THREE.CylinderGeometry(.11,.13,.85,8,4).translate(0,.42,0),(x,y)=>y>.63?lin('#ff8fb1'):iron);const t=paint(new THREE.SphereGeometry(.12,8,4).translate(0,.86,0),iron);return mergeGeometries([b.toNonIndexed(),t.toNonIndexed()]);})();
  const potG=(()=>{const p=paint(new THREE.CylinderGeometry(.55,.42,.6,10).translate(0,.3,0),lin('#f6efe8'));const g=paint(new THREE.IcosahedronGeometry(.62,1).scale(1,.75,1).translate(0,.85,0),(x,y,z,i)=>((i*7)%11<2)?lin('#ff7aa8'):((i*5)%13<2)?lin('#ffe066'):lin('#6cc56b'));return mergeGeometries([p.toNonIndexed(),g.toNonIndexed()]);})();
  const shelterG=(()=>{const g=new GB(),c=lin('#ffffff'),r=lin('#ff8fb1');
    g.box(-2.4,2.5,-.9,2.4,2.7,.9,r,true);for(const x of [-2.3,2.3])g.box(x-.06,0,-.8,x+.06,2.5,-.68,c);
    g.box(-2.3,.45,-.75,2.3,.5,-.35,lin('#f2a7bf'));return g.geometry();})();
  const glassG=new THREE.BoxGeometry(4.5,2.1,.05).translate(0,1.35,-.82);
  const adG=new THREE.PlaneGeometry(1.3,1.9).translate(2.42,1.3,0).rotateY(0);
  const tableG=(()=>{const g=new GB();const t=paint(new THREE.CylinderGeometry(.45,.45,.05,12).translate(0,.74,0),iron);g.add(t,null,null);g.box(-.04,0,-.04,.04,.74,.04,lin('#7a5a66'));
    for(const a of [0,Math.PI]){const c=paint(new THREE.CylinderGeometry(.22,.22,.05,10).translate(Math.cos(a)*.8,.46,Math.sin(a)*.8),lin('#ff8fb1'));g.add(c,null,null);g.box(Math.cos(a)*.8-.03,0,Math.sin(a)*.8-.03,Math.cos(a)*.8+.03,.46,Math.sin(a)*.8+.03,lin('#7a5a66'));}
    return g.geometry();})();
  const umbG=(()=>{const g=new GB();const cone=new THREE.ConeGeometry(1.5,.55,12,1,true).translate(0,2.55,0);g.add(cone,null,(v,i)=>Math.floor((Math.atan2(v.z,v.x)+Math.PI)/(Math.PI*2)*12)%2?lin('#ff6f9c'):lin('#fffaf4'));g.box(-.03,0,-.03,.03,2.6,.03,iron);return g.geometry();})();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,side:THREE.DoubleSide});
  const near=(geo,max=170,shadow=true)=>new Instances([{geo,mat,max,shadow}]);
  const bench=near(benchG),bin=near(binG),hyd=near(hydG,140),boll=near(bollG,140,false),pot=near(potG),shel=near(shelterG,220),table=near(tableG,150),umb=near(umbG,200);
  const glass=new Instances([{geo:glassG,mat:new THREE.MeshStandardMaterial({color:0xcfeaff,transparent:true,opacity:.35,roughness:.05}),max:220,shadow:false}]);
  const adMat=new THREE.MeshStandardMaterial({map:T.makeBillboards(W.aniso),emissiveMap:null,emissive:0xffffff,roughness:.4});W.mats.ad=adMat;
  hook(adMat,'ad',s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=diffuseColor.rgb;');});
  const ad=new Instances([{geo:adG,mat:adMat,max:260,shadow:false}]);
  const treeSpots=[];
  for(const b of W.blocks){
    const edges=[[1,0],[-1,0],[0,1],[0,-1]];
    let stopUsed=false;
    for(const [nx,nz] of edges){
      const tx=-nz,tz=nx,ry=Math.atan2(nx,nz);
      const base=(o)=>[b.cx+nx*(BLOCK/2-o),b.cz+nz*(BLOCK/2-o)];
      const [ex,ez]=base(2.5);
      // street trees
      for(const t of [-24,-8.5,8.5,24]){if(b.district==='park'&&rng()<.5)continue;if(rng()<.1)continue;treeSpots.push([ex+tx*t,ez+tz*t]);}
      // benches / bins / planters between trees
      for(const t of [-16,16]){const r=rng(),[x,z]=[ex+tx*t,ez+tz*t];
        if(r<.4){bench.add(x,SLAB,z,ry+Math.PI);W.circles.push({x,z,r:.6});}
        else if(r<.65){pot.add(x,SLAB,z,rng()*6);W.circles.push({x,z,r:.6});}
        else if(r<.8){bin.add(x,SLAB,z,0);W.circles.push({x,z,r:.35});}
      }
      // hydrant near one end
      if(rng()<.5){const [x,z]=base(1.2);hyd.add(x+tx*21,SLAB,z+tz*21,rng()*6);}
      // bollards at the corners
      for(const s of [-1,1])for(const o of [3.6,4.6,5.6]){const [x,z]=base(.55);boll.add(x+tx*s*(BLOCK/2-o-1.2),SLAB,z+tz*s*(BLOCK/2-o-1.2),0);}
      // bus stop
      if(!stopUsed&&b.district!=='park'&&rng()<.18){stopUsed=true;const [x,z]=base(1.9);const sx=x+tx*12.6,sz=z+tz*12.6;shel.add(sx,SLAB,sz,ry);glass.add(sx,SLAB,sz,ry);ad.add(sx,SLAB,sz,ry);ad.add(sx,SLAB,sz,ry+Math.PI);W.boxes.push({x0:sx-Math.abs(tx)*2.4-Math.abs(nx)*.9,z0:sz-Math.abs(tz)*2.4-Math.abs(nz)*.9,x1:sx+Math.abs(tx)*2.4+Math.abs(nx)*.9,z1:sz+Math.abs(tz)*2.4+Math.abs(nz)*.9});}
    }
  }
  // cafe terraces from the building generator (skip ones that collide with trees)
  for(const c of W.cafes){
    const [x,,z]=c.p;if(treeSpots.some(t=>Math.hypot(t[0]-x,t[1]-z)<2.6))continue;
    table.add(x,SLAB,z,rng()*3);umb.add(x,SLAB,z,rng()*3);W.circles.push({x,z,r:1});
  }
  for(const u of W.umbrellas){table.add(u[0],u[1],u[2],rng()*3);umb.add(u[0],u[1],u[2],rng()*3);}
  // promenade benches
  for(let x=-WALK_OUT+24;x<WALK_OUT-10;x+=24){if(Math.abs(x-BRIDGE_X)<14)continue;bench.add(x,SLAB,RIVER_Z0-3.5,Math.PI);}
  for(const i of [bench,bin,hyd,boll,pot,shel,glass,ad,table,umb]){i.build(root,{layer:1});W.inst.push(i);}
  W.streetTrees=treeSpots;
}
