import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mulberry32,Buf,hexToLinear} from './util.js';
import * as T from './textures.js';

export const BLOCK=62, ROAD=14, P=76, N=9, HALF=342, SLAB=0.18;
export const bc=i=>(i-4)*P;
const FLOOR=3.6, TILE_W=24, TILE_H=28.8;
const PARKS=[[6,2],[2,6],[2,2],[6,6],[4,7],[7,4],[1,4],[4,1]];
const isPark=(i,j)=>PARKS.some(p=>p[0]===i&&p[1]===j);

function colorize(g,c){const n=g.attributes.position.count;const a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c[0];a[i*3+1]=c[1];a[i*3+2]=c[2];}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;}
function ensureUV(g){if(!g.attributes.uv){const n=g.attributes.position.count;g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));}return g;}

export function buildCity(opts){
  const aniso=opts.aniso||8;
  const rng=mulberry32(20261019);
  const root=new THREE.Group();
  const mats={}; // exposed for time-of-day control
  const casters=[];

  /* ---------- textures & materials ---------- */
  const facades=[
    T.makeFacade(0,.42,101,aniso),T.makeFacade(1,.38,202,aniso),T.makeFacade(2,.5,303,aniso)
  ];
  const facadeMats=facades.map((f,i)=>new THREE.MeshStandardMaterial({map:f.map,emissiveMap:f.emissive,emissive:0xffffff,emissiveIntensity:1,vertexColors:true,roughness:[.85,.6,.22][i],metalness:[0,.05,.35][i],envMapIntensity:[1,1,1.6][i]}));
  mats.facades=facadeMats;
  const roofMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95});
  const signsTex=T.makeSigns(aniso);
  const signMat=new THREE.MeshStandardMaterial({map:signsTex,emissiveMap:signsTex,emissive:0xffffff,emissiveIntensity:1,roughness:.6,vertexColors:true});
  mats.sign=signMat;
  const asphaltTex=T.makeAsphalt(aniso);asphaltTex.repeat.set(HALF*2/16,HALF*2/16);
  const pavingTex=T.makePaving(aniso);
  const grassTex=T.makeGrass(aniso);

  /* ---------- ground ---------- */
  const road=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,HALF*2).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:asphaltTex,roughness:.72,metalness:0,envMapIntensity:.8}));
  road.receiveShadow=true;root.add(road);
  const terrainTex=grassTex.clone();terrainTex.needsUpdate=true;terrainTex.repeat.set(500,500);
  const terrain=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:terrainTex,color:0x8a8f80,roughness:1}));
  terrain.position.y=-.06;terrain.receiveShadow=true;root.add(terrain);

  // distant hills
  {
    const seg=200,rings=7,pos=[],col=[],idx=[];
    for(let r=0;r<=rings;r++)for(let s=0;s<=seg;s++){
      const a=s/seg*Math.PI*2, rad=950+r*140;
      const n=Math.sin(a*3+1)*.5+Math.sin(a*7+2)*.3+Math.sin(a*13)*.2+Math.sin(a*29+4)*.1;
      const ramp=Math.sin(Math.min(1,r/rings)*Math.PI*.9+.2);
      const h=Math.max(0,(0.55+n*.45))*(70+r*18)*ramp-6;
      pos.push(Math.cos(a)*rad,h,Math.sin(a)*rad);
      const t=h/200;col.push(.13+t*.1,.16+t*.1,.2+t*.08);
    }
    for(let r=0;r<rings;r++)for(let s=0;s<seg;s++){const a=r*(seg+1)+s,b=a+1,c=a+seg+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
    const hills=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:false,side:THREE.DoubleSide}));
    root.add(hills);mats.hills=hills;
  }

  /* ---------- block slabs (sidewalks), parks ---------- */
  const slabBuf=new Buf(), grassBuf=new Buf(), pathBuf=new Buf();
  const concrete=hexToLinear('#d8d3c8'), curbC=hexToLinear('#a9a69f');
  const blocks=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const cx=bc(i),cz=bc(j),x0=cx-BLOCK/2,x1=cx+BLOCK/2,z0=cz-BLOCK/2,z1=cz+BLOCK/2,h=SLAB,s=1/4;
    slabBuf.quad([x0,h,z1],[x1,h,z1],[x1,h,z0],[x0,h,z0],[0,1,0],[[x0*s,z1*s],[x1*s,z1*s],[x1*s,z0*s],[x0*s,z0*s]],concrete);
    const sideUV=(a,b)=>[[a*s,0],[b*s,0],[b*s,h*s],[a*s,h*s]];
    slabBuf.quad([x0,0,z1],[x1,0,z1],[x1,h,z1],[x0,h,z1],[0,0,1],sideUV(x0,x1),curbC);
    slabBuf.quad([x1,0,z0],[x0,0,z0],[x0,h,z0],[x1,h,z0],[0,0,-1],sideUV(x0,x1),curbC);
    slabBuf.quad([x1,0,z1],[x1,0,z0],[x1,h,z0],[x1,h,z1],[1,0,0],sideUV(z0,z1),curbC);
    slabBuf.quad([x0,0,z0],[x0,0,z1],[x0,h,z1],[x0,h,z0],[-1,0,0],sideUV(z0,z1),curbC);
    blocks.push({i,j,cx,cz,park:isPark(i,j),center:i===4&&j===4});
  }
  const slabMesh=new THREE.Mesh(slabBuf.geometry(),new THREE.MeshStandardMaterial({map:pavingTex,vertexColors:true,roughness:.9}));
  slabMesh.receiveShadow=true;root.add(slabMesh);

  /* ---------- buildings ---------- */
  const sideBufs=[new Buf(),new Buf(),new Buf()], roofBuf=new Buf(), signBuf=new Buf();
  const crownBuf=new Buf(); // emissive landmark crown
  const buildings=[]; // collision AABBs
  const beacons=[]; // [x,y,z]
  const palettes=[
    ['#e2d3bd','#d6c4a8','#c9b79c','#e8dfd0','#d9a98c','#c28f73','#b98a6a','#ece4d6'],
    ['#d7dde3','#c3ccd4','#e5e0d6','#b9a690','#a9b4bf','#d8c8b4'],
    ['#9fb9c9','#8aa8bd','#b4c6d1','#7f9bb0','#a8b8c4','#97aeb8']
  ].map(p=>p.map(hexToLinear));
  const roofCols=['#585c63','#6a6862','#4f5258','#767a80'].map(hexToLinear);
  const equipCols=['#8b9097','#a3a7ac','#70747a','#b4b0a6'].map(hexToLinear);
  const pick=a=>a[(rng()*a.length)|0];
  const snap3=v=>Math.round(v/3)*3;

  function addSign(face,x0,z0,x1,z1,len0,wd,yb){}
  function addBuilding(bx0,bz0,bw,bd,F,variant,blk,opt={}){
    const x0=bx0,z0=bz0,x1=bx0+bw,z1=bz0+bd;
    const color=pick(palettes[variant]);
    const uo=((rng()*8)|0)/8;
    const sb=sideBufs[variant];
    const tiers=[];
    const minDim=Math.min(bw,bd);
    if(opt.tiers){tiers.push(...opt.tiers);}
    else if(F<8||minDim<15){tiers.push({ins:0,f:F});}
    else if(F<18){
      if(rng()<.55&&minDim>=21){const f1=Math.max(3,Math.round(F*.6));tiers.push({ins:0,f:f1},{ins:3,f:F});}
      else tiers.push({ins:0,f:F});
    }else{
      const pod=3+((rng()*2)|0);
      let ins=minDim>=27?6:3;
      const f2=Math.max(pod+4,Math.round(F*.78));
      tiers.push({ins:0,f:pod},{ins:ins,f:f2});
      if(F-f2>=3&&minDim-ins*2-6>=9)tiers.push({ins:ins+3,f:F});
    }
    let prevF=0;
    let topInfo=null;
    for(const t of tiers){
      const tx0=x0+t.ins,tx1=x1-t.ins,tz0=z0+t.ins,tz1=z1-t.ins;
      if(tx1-tx0<9||tz1-tz0<9)continue;
      const y0=0,y1=t.f*FLOOR;
      sb.sides(tx0,y0,tz0,tx1,y1,tz1,color,uo,TILE_W,TILE_H);
      roofBuf.top(tx0,y1,tz0,tx1,tz1,pick(roofCols));
      topInfo={tx0,tx1,tz0,tz1,y1};prevF=t.f;
    }
    // collision = base tier footprint
    buildings.push({x0,z0,x1,z1});
    // roof equipment
    const ti=topInfo;
    if(ti){
      const nEq=1+((rng()*4)|0);
      for(let k=0;k<nEq;k++){
        const w=2+rng()*3.5,d=2+rng()*3.5,h=1+rng()*2.2;
        const ex=ti.tx0+1+rng()*Math.max(.1,ti.tx1-ti.tx0-w-2),ez=ti.tz0+1+rng()*Math.max(.1,ti.tz1-ti.tz0-d-2);
        roofBuf.fullBox(ex,ti.y1,ez,ex+w,ti.y1+h,ez+d,pick(equipCols));
      }
      // parapet
      const pc=pick(roofCols),pw=.5,ph=.9;
      roofBuf.fullBox(ti.tx0,ti.y1,ti.tz0,ti.tx1,ti.y1+ph,ti.tz0+pw,pc);
      roofBuf.fullBox(ti.tx0,ti.y1,ti.tz1-pw,ti.tx1,ti.y1+ph,ti.tz1,pc);
      roofBuf.fullBox(ti.tx0,ti.y1,ti.tz0+pw,ti.tx0+pw,ti.y1+ph,ti.tz1-pw,pc);
      roofBuf.fullBox(ti.tx1-pw,ti.y1,ti.tz0+pw,ti.tx1,ti.y1+ph,ti.tz1-pw,pc);
      if(F>=16&&!opt.noAntenna){
        const ax=(ti.tx0+ti.tx1)/2,az=(ti.tz0+ti.tz1)/2,ah=8+rng()*16;
        roofBuf.fullBox(ax-.25,ti.y1,az-.25,ax+.25,ti.y1+ah,az+.25,equipCols[2]);
        roofBuf.fullBox(ax-1.2,ti.y1+ah*.6,az-.08,ax+1.2,ti.y1+ah*.6+.15,az+.08,equipCols[2]);
        beacons.push([ax,ti.y1+ah+.5,az]);
      }
    }
    // signs on street-facing sides of base tier
    if(blk&&F>=2&&!opt.noSigns){
      const lim=26.5-6;
      const faces=[];
      if(x1>blk.cx+lim)faces.push('px');
      if(x0<blk.cx-lim)faces.push('nx');
      if(z1>blk.cz+lim)faces.push('pz');
      if(z0<blk.cz-lim)faces.push('nz');
      for(const f of faces){
        const horiz=(f==='px'||f==='nx')?[z0,z1]:[x0,x1];
        const len=horiz[1]-horiz[0];
        if(len<12||rng()>.55)continue;
        const sw=5.6,ta=horiz[0]+2+rng()*(len-sw-4),tb=ta+sw;
        const k=(rng()*16)|0,u0=(k%4)/4,v0=1-(((k/4)|0)+1)/4,u1=u0+.25,v1=v0+.25;
        const yb=3.2,yt=yb+2.8,o=.12,uvs=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],W=[1,1,1];
        if(f==='pz')signBuf.quad([ta,yb,z1+o],[tb,yb,z1+o],[tb,yt,z1+o],[ta,yt,z1+o],[0,0,1],uvs,W);
        if(f==='nz')signBuf.quad([tb,yb,z0-o],[ta,yb,z0-o],[ta,yt,z0-o],[tb,yt,z0-o],[0,0,-1],uvs,W);
        if(f==='px')signBuf.quad([x1+o,yb,tb],[x1+o,yb,ta],[x1+o,yt,ta],[x1+o,yt,tb],[1,0,0],uvs,W);
        if(f==='nx')signBuf.quad([x0-o,yb,ta],[x0-o,yb,tb],[x0-o,yt,tb],[x0-o,yt,ta],[-1,0,0],uvs,W);
      }
    }
  }

  const gardenLots=[]; // {cx,cz,w,d}
  function splitLots(x0,z0,w,d,out,depth){
    const minS=22;
    const canX=w>=minS*2+2,canZ=d>=minS*2+2;
    if((canX||canZ)&&depth<3&&!(depth===0&&rng()<.12)){
      const sx=canX&&(!canZ||w>d||rng()<.4);
      if(sx){const a=Math.round(w*(.38+rng()*.24));splitLots(x0,z0,a,d,out,depth+1);splitLots(x0+a,z0,w-a,d,out,depth+1);}
      else{const a=Math.round(d*(.38+rng()*.24));splitLots(x0,z0,w,a,out,depth+1);splitLots(x0,z0+a,w,d-a,out,depth+1);}
    }else out.push({x0,z0,w,d});
  }
  const treeSpots=[], lampSpots=[]; // collected below
  for(const blk of blocks){
    if(blk.park||blk.center)continue;
    const R=BLOCK/2-4.5;
    const lots=[];splitLots(blk.cx-R,blk.cz-R,R*2,R*2,lots,0);
    const dist=Math.hypot(blk.i-4,blk.j-4),f=Math.max(0,1-dist/5.4);
    for(const lot of lots){
      if(rng()<.1&&lot.w*lot.d<900){gardenLots.push({cx:lot.x0+lot.w/2,cz:lot.z0+lot.d/2,w:lot.w,d:lot.d});continue;}
      const g=1.5+rng()*1.5;
      let bw=Math.floor((lot.w-2*g)/3)*3,bd=Math.floor((lot.d-2*g)/3)*3;
      if(bw<12||bd<12){gardenLots.push({cx:lot.x0+lot.w/2,cz:lot.z0+lot.d/2,w:lot.w,d:lot.d});continue;}
      const bx0=snap3(lot.x0+g+rng()*(lot.w-2*g-bw)),bz0=snap3(lot.z0+g+rng()*(lot.d-2*g-bd));
      const tallMax=14+150*Math.pow(f,1.5);
      let h=9+Math.pow(rng(),1.5)*tallMax;
      if(rng()<.1)h*=.6;
      const F=Math.max(2,Math.round(h/FLOOR));
      let variant;const r=rng();
      if(F<8)variant=r<.7?0:1;else if(F<18)variant=r<.35?0:r<.7?1:2;else variant=r<.6?2:r<.8?1:0;
      addBuilding(bx0,bz0,bw,bd,F,variant,blk);
    }
  }
  // landmark tower in the centre block
  const LM={tiers:[{ins:0,f:4},{ins:6,f:38},{ins:9,f:50}],noAntenna:true};
  addBuilding(-15,-15,30,30,50,2,null,{...LM,noSigns:true});
  // crown & spire (emissive)
  const topY=50*FLOOR, cr=hexToLinear('#7fe3ff');
  crownBuf.fullBox(-6.3,topY-6,-6.3,6.3,topY-3.6,6.3,cr);
  crownBuf.fullBox(-6.3,topY-1.2,-6.3,6.3,topY+.4,6.3,cr);
  crownBuf.fullBox(-.5,topY,-.5,.5,topY+34,.5,hexToLinear('#d8f6ff'));
  crownBuf.fullBox(-3,topY+.4,-3,3,topY+1.2,3,cr);
  beacons.push([0,topY+35,0]);
  buildings.push({x0:-15,z0:-15,x1:15,z1:15});

  const sideMeshes=sideBufs.map((b,i)=>{const g=b.geometry();if(!g)return null;const m=new THREE.Mesh(g,facadeMats[i]);m.castShadow=m.receiveShadow=true;root.add(m);casters.push(m);return m;});
  const roofMesh=new THREE.Mesh(roofBuf.geometry(),roofMat);roofMesh.castShadow=roofMesh.receiveShadow=true;root.add(roofMesh);casters.push(roofMesh);
  const signMesh=new THREE.Mesh(signBuf.geometry(),signMat);root.add(signMesh);
  const crownMat=new THREE.MeshBasicMaterial({vertexColors:true,color:0xffffff});mats.crown=crownMat;
  root.add(new THREE.Mesh(crownBuf.geometry(),crownMat));

  /* ---------- parks & gardens ---------- */
  const treeList=[]; // {x,z,s,kind}
  const obstacles=[];
  const addTree=(x,z,s,y=SLAB)=>{treeList.push({x,z,s,y});obstacles.push({x,z,r:.4});};
  const grassMeshes=[];
  const grassQuad=(cx,cz,w,d)=>{const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2,s=1/6,y=SLAB+.015;grassBuf.quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0],[0,1,0],[[x0*s,z1*s],[x1*s,z1*s],[x1*s,z0*s],[x0*s,z0*s]],[1,1,1]);};
  const pathQuad=(x0,z0,x1,z1,c)=>{pathBuf.quad([x0,SLAB+.03,z1],[x1,SLAB+.03,z1],[x1,SLAB+.03,z0],[x0,SLAB+.03,z0],[0,1,0],[[0,0],[1,0],[1,1],[0,1]],c);};
  const sand=hexToLinear('#d9c9a2');
  const parkLamps=[];
  for(const blk of blocks){
    if(!blk.park&&!blk.center)continue;
    const R=BLOCK/2-3.2;
    if(blk.park){
      grassQuad(blk.cx,blk.cz,R*2,R*2);
      pathQuad(blk.cx-1.6,blk.cz-R,blk.cx+1.6,blk.cz+R,sand);
      pathQuad(blk.cx-R,blk.cz-1.6,blk.cx+R,blk.cz+1.6,sand);
      const n=38+((rng()*14)|0);
      for(let k=0;k<n;k++){
        const x=blk.cx+(rng()*2-1)*(R-1),z=blk.cz+(rng()*2-1)*(R-1);
        if(Math.abs(x-blk.cx)<4||Math.abs(z-blk.cz)<4)continue;
        if(blk.i===6&&blk.j===2&&Math.hypot(x-blk.cx,z-blk.cz)<14)continue;
        addTree(x,z,1.1+rng()*.7);
      }
      for(const [dx,dz] of [[-6,-6],[6,-6],[-6,6],[6,6],[-20,-4],[20,4],[4,-20],[-4,20]])parkLamps.push([blk.cx+dx,blk.cz+dz]);
    }else{
      // centre plaza: lawns + ring of trees around landmark
      grassQuad(blk.cx,blk.cz-22,R*2,10);grassQuad(blk.cx,blk.cz+22,R*2,10);
      for(let k=0;k<14;k++){const a=k/14*Math.PI*2;addTree(Math.cos(a)*24,Math.sin(a)*24,1.3);}
      for(let k=0;k<8;k++){const a=(k+.5)/8*Math.PI*2;parkLamps.push([Math.cos(a)*19,Math.sin(a)*19]);}
    }
  }
  for(const g of gardenLots){
    const gw=g.w-2,gd=g.d-2;grassQuad(g.cx,g.cz,gw,gd);
    const n=3+((rng()*5)|0);
    for(let k=0;k<n;k++)addTree(g.cx+(rng()*2-1)*(gw/2-2),g.cz+(rng()*2-1)*(gd/2-2),.9+rng()*.6);
  }
  if(grassBuf.idx.length){const m=new THREE.Mesh(grassBuf.geometry(),new THREE.MeshStandardMaterial({map:grassTex,vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));m.receiveShadow=true;root.add(m);}
  if(pathBuf.idx.length){const m=new THREE.Mesh(pathBuf.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.receiveShadow=true;root.add(m);}

  /* ---------- road markings (instanced) ---------- */
  const markers=[];// {x,z,sx,sz,col}
  const WHITE=0xe8e8e0, YEL=0xf2b928;
  const lineBox=new THREE.BoxGeometry(1,.05,1);
  const lineMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const roadCoord=k=>(k-4)*P+P/2; // k=-1..8
  for(let k=-1;k<=8;k++){
    const c=roadCoord(k);
    for(let seg=-1;seg<=8;seg++){ // between intersections seg and seg+1 along the other axis: block centre
      const m=bc(seg); // block centre along road axis (seg index 0..8 are blocks; -1 and 9 outside)
      if(seg<0||seg>8)continue;
      const a0=m-BLOCK/2,a1=m+BLOCK/2; // segment extent along road axis
      // double yellow centre line
      for(const o of [-.22,.22]){
        markers.push([c+o,m,.14,BLOCK-6,YEL,'x']);   // road runs along z at x=c  -> thin in x
        markers.push([m,c+o,BLOCK-6,.14,YEL,'z']);   // road runs along x at z=c
      }
      // dashed lane dividers at +-3.5
      const dl=3,gap=3.2;
      for(let t=a0+3;t<a1-3-dl;t+=dl+gap){
        for(const o of [-3.5,3.5]){
          markers.push([c+o,t+dl/2,.14,dl,WHITE,'x']);
          markers.push([t+dl/2,c+o,dl,.14,WHITE,'z']);
        }
      }
      // zebra crossings at both ends of the segment
      for(const e of [a0-1.6,a1+1.6]){ // sits in the arm next to the intersection
        for(let w=-6.3;w<=6.3;w+=1.25){
          markers.push([c+w,e,.6,2.6,WHITE,'x']);
          markers.push([e,c+w,2.6,.6,WHITE,'z']);
        }
      }
      // stop lines
      markers.push([c+3.5,a0-4.4,7,.35,WHITE,'x']); markers.push([c-3.5,a1+4.4,7,.35,WHITE,'x']);
      markers.push([a0-4.4,c-3.5,.35,7,WHITE,'z']); markers.push([a1+4.4,c+3.5,.35,7,WHITE,'z']);
    }
  }
  const lineMesh=new THREE.InstancedMesh(lineBox,lineMat,markers.length);
  {const m=new THREE.Matrix4(),col=new THREE.Color(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();
   markers.forEach((mk,i)=>{ // [x,z,sx,sz,col]
     p.set(mk[0],.025,mk[1]);s.set(mk[2],1,mk[3]);
     m.compose(p,q,s);lineMesh.setMatrixAt(i,m);lineMesh.setColorAt(i,col.setHex(mk[4]));
   });lineMesh.instanceMatrix.needsUpdate=true;}
  lineMesh.receiveShadow=true;root.add(lineMesh);

  /* ---------- street furniture: lamps & trees along block edges ---------- */
  const lampM=[]; // {x,z,nx,nz}
  for(const blk of blocks){
    const edges=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const [nx,nz] of edges){
      const tx=-nz,tz=nx; // tangent
      const baseX=blk.cx+nx*(BLOCK/2-1.0),baseZ=blk.cz+nz*(BLOCK/2-1.0);
      for(const t of [-19,0,19]){lampM.push({x:baseX+tx*t,z:baseZ+tz*t,nx,nz});}
      if(!(blk.park&&false)){
        const tbase=[blk.cx+nx*(BLOCK/2-2.7),blk.cz+nz*(BLOCK/2-2.7)];
        for(const t of [-26.5,-9.5,9.5,26.5]){
          if(rng()<.12)continue;
          addTree(tbase[0]+tx*t,tbase[1]+tz*t,.8+rng()*.35);
        }
      }
    }
  }
  for(const [x,z] of parkLamps)lampM.push({x,z,nx:rng()<.5?1:-1,nz:0,park:true});
  lampM.forEach(l=>obstacles.push({x:l.x,z:l.z,r:.3}));

  // lamp geometry
  const lampGeo=(()=>{
    const pole=colorize(new THREE.CylinderGeometry(.07,.11,8,6).translate(0,4,0),[1,1,1]);ensureUV(pole);
    const b=new Buf();
    b.fullBox(0,7.85,-.05,3.1,7.97,.05,[1,1,1]);
    b.fullBox(2.2,7.7,-.2,3.3,7.86,.2,[1,1,1]);
    b.fullBox(-.15,0,-.15,.15,.35,.15,[1,1,1]);
    return mergeGeometries([pole,b.geometry()]);
  })();
  const lampMesh=new THREE.InstancedMesh(lampGeo,new THREE.MeshStandardMaterial({color:0x3d434c,vertexColors:true,metalness:.6,roughness:.45}),lampM.length);
  const bulbGeo=new THREE.BoxGeometry(.9,.05,.3).translate(2.75,7.68,0);
  const bulbMat=new THREE.MeshBasicMaterial({color:0xffffff});mats.bulb=bulbMat;
  const bulbMesh=new THREE.InstancedMesh(bulbGeo,bulbMat,lampM.length);
  const poolGeo=new THREE.PlaneGeometry(15,15).rotateX(-Math.PI/2);
  const poolMat=new THREE.MeshBasicMaterial({map:T.makePool(),color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,fog:false});
  mats.pool=poolMat;
  const poolMesh=new THREE.InstancedMesh(poolGeo,poolMat,lampM.length);
  const glowPts=[];// x,y,z,r,g,b,size
  {
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1),p=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0);
    lampM.forEach((l,i)=>{
      const ang=Math.atan2(-l.nz,l.nx);q.setFromAxisAngle(yAxis,ang);
      p.set(l.x,l.park?SLAB:SLAB,l.z);m.compose(p,q,one);lampMesh.setMatrixAt(i,m);bulbMesh.setMatrixAt(i,m);
      const hx=l.x+l.nx*2.75,hz=l.z+l.nz*2.75;
      glowPts.push([hx,SLAB+7.6,hz,1,.72,.38,4.5]);
      m.compose(p.set(hx+l.nx*.3,.2,hz+l.nz*.3),new THREE.Quaternion(),one);poolMesh.setMatrixAt(i,m);
    });
    lampMesh.instanceMatrix.needsUpdate=bulbMesh.instanceMatrix.needsUpdate=poolMesh.instanceMatrix.needsUpdate=true;
  }
  lampMesh.castShadow=false;root.add(lampMesh,bulbMesh);
  poolMesh.frustumCulled=true;root.add(poolMesh);poolMesh.renderOrder=2;

  // trees
  {
    const trunk=colorize(new THREE.CylinderGeometry(.14,.22,2.6,6).translate(0,1.3,0),hexToLinear('#5b4332'));ensureUV(trunk);
    const parts=[trunk];
    const blob=(r,x,y,z,sc)=>{
      const g=new THREE.IcosahedronGeometry(r,1);g.scale(1,sc,1);g.translate(x,y,z);g.deleteAttribute('uv');
      const pos=g.attributes.position,n=pos.count,col=new Float32Array(n*3);
      for(let i=0;i<n;i++){const t=THREE.MathUtils.clamp((pos.getY(i)-(y-r))/(r*2),0,1);const c=.55+.45*t;col[i*3]=c*.85;col[i*3+1]=c;col[i*3+2]=c*.7;}
      g.setAttribute('color',new THREE.BufferAttribute(col,3));ensureUV(g);return g;
    };
    const treeBlobs=[blob(1.7,0,3.9,0,.95),blob(1.2,.9,3.3,.5,.9),blob(1.25,-.8,3.5,-.5,.9)];
    // trunk needs non-indexed for merge compat
    parts[0]=parts[0].toNonIndexed();
    const geo=mergeGeometries([...parts,...treeBlobs]);
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true});
    const mesh=new THREE.InstancedMesh(geo,mat,treeList.length);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),yAxis=new THREE.Vector3(0,1,0),s=new THREE.Vector3(),p=new THREE.Vector3(),c=new THREE.Color();
    const greens=['#5f9a45','#4f8a3c','#6da64a','#7aa84a','#3f7a3a','#8aa54a','#d08a3c','#c9703a'];
    treeList.forEach((t,i)=>{
      q.setFromAxisAngle(yAxis,rng()*6.28);s.set(t.s*(.9+rng()*.2),t.s*(.9+rng()*.3),t.s*(.9+rng()*.2));p.set(t.x,t.y,t.z);
      m.compose(p,q,s);mesh.setMatrixAt(i,m);
      const k=rng();c.set(k<.86?greens[(rng()*6)|0]:greens[6+((rng()*2)|0)]);mesh.setColorAt(i,c);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);casters.push(mesh);
    mats.trees=mat;
  }

  /* ---------- Ferris wheel ---------- */
  const wheel={group:new THREE.Group(),rot:0};
  {
    const wb=blocks.find(b=>b.i===6&&b.j===2);
    const g=wheel.group;g.position.set(wb.cx,SLAB,wb.cz);root.add(g);
    const R=21,hubY=25,half=1.6;
    const steel=hexToLinear('#c9ced6');
    const ng=x=>{const n=x.index?x.toNonIndexed():x;if(n.attributes.uv===undefined)ensureUV(n);return n;};
    const geos=[];
    for(const xx of [-half,half]){const t=colorize(new THREE.TorusGeometry(R,.32,6,56),steel);t.rotateY(Math.PI/2);t.translate(xx,0,0);geos.push(ng(t));}
    const nSp=16;
    for(let k=0;k<nSp;k++){
      const sp=colorize(new THREE.BoxGeometry(2*half,.16,R).translate(0,0,R/2),steel);sp.rotateX(k/nSp*Math.PI*2);geos.push(ng(sp));
    }
    geos.push(ng(colorize(new THREE.CylinderGeometry(1.4,1.4,2*half+1.2,12).rotateZ(Math.PI/2),hexToLinear('#e04a5a'))));
    const wm=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.5}));
    wm.castShadow=true;wheel.rim=new THREE.Group();wheel.rim.position.set(0,hubY,0);wheel.rim.add(wm);g.add(wheel.rim);
    // A-frame legs
    const legGeoms=[];
    for(const xx of [-half,half])for(const sz of [-1,1]){
      const a=new THREE.Vector3(xx,0,sz*R*.62),b2=new THREE.Vector3(xx,hubY,0);
      const d=b2.clone().sub(a),len=d.length();
      const bg=colorize(new THREE.BoxGeometry(.5,len,.5),hexToLinear('#e9edf2'));
      bg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
      const mid=a.clone().add(b2).multiplyScalar(.5);bg.translate(mid.x,mid.y,mid.z);legGeoms.push(ng(bg));
    }
    const legMesh=new THREE.Mesh(mergeGeometries(legGeoms),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.3}));legMesh.castShadow=true;g.add(legMesh);
    // gondolas (stay upright)
    const gcount=16;
    const gg=mergeGeometries([ng(colorize(new THREE.BoxGeometry(1.6,1.5,2.4).translate(0,-1.1,0),[1,1,1])),ng(colorize(new THREE.BoxGeometry(1.8,.2,2.6).translate(0,-.3,0),[1,1,1]))]);
    const gm=new THREE.InstancedMesh(gg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5}),gcount);
    const gcols=['#ff5a6e','#ffc64d','#5ad1ff','#8cf06a','#c58bff','#ff9a4d'];
    for(let k=0;k<gcount;k++)gm.setColorAt(k,new THREE.Color(gcols[k%gcols.length]));
    gm.castShadow=true;gm.frustumCulled=false;g.add(gm);
    // bulbs on rim
    const nb=56,bm=new THREE.InstancedMesh(new THREE.SphereGeometry(.28,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),nb);
    mats.wheelBulb=bm.material;bm.frustumCulled=false;g.add(bm);
    const bcol=['#ff6a8a','#ffd35a','#6fd8ff','#9aff7a','#d29bff'];
    for(let k=0;k<nb;k++)bm.setColorAt(k,new THREE.Color(bcol[k%bcol.length]));
    Object.assign(wheel,{R,hubY,gondolas:gm,count:gcount,bulbs:bm,nb,half});
    // static glow at hub + cardinal rim lights
    glowPts.push([wb.cx,SLAB+hubY,wb.cz,1,.8,.5,26]);
  }
  const _wm=new THREE.Matrix4(),_wq=new THREE.Quaternion(),_wp=new THREE.Vector3(),_ws=new THREE.Vector3(1,1,1);
  function updateWheel(dt){
    wheel.rot+=dt*.12;wheel.rim.rotation.x=wheel.rot;
    for(let k=0;k<wheel.count;k++){
      const a=wheel.rot+k/wheel.count*Math.PI*2;
      _wp.set(0,wheel.hubY-Math.sin(a)*wheel.R,Math.cos(a)*wheel.R);
      _wm.compose(_wp,_wq,_ws);wheel.gondolas.setMatrixAt(k,_wm);
    }
    wheel.gondolas.instanceMatrix.needsUpdate=true;
    for(let k=0;k<wheel.nb;k++){
      const a=wheel.rot+k/wheel.nb*Math.PI*2;
      _wp.set((k%2?1:-1)*(wheel.half+.05),wheel.hubY-Math.sin(a)*(wheel.R+.35),Math.cos(a)*(wheel.R+.35));
      _wm.compose(_wp,_wq,_ws);wheel.bulbs.setMatrixAt(k,_wm);
    }
    wheel.bulbs.instanceMatrix.needsUpdate=true;
  }
  updateWheel(0);

  /* ---------- beacons ---------- */
  const beaconMat=new THREE.MeshBasicMaterial({color:0xff2a2a});mats.beacon=beaconMat;
  const beaconMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(.7,8,6),beaconMat,beacons.length);
  beacons.forEach((b,i)=>{beaconMesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(b[0],b[1],b[2]));glowPts.push([b[0],b[1],b[2],1,.12,.1,12]);});
  beaconMesh.frustumCulled=false;root.add(beaconMesh);

  /* ---------- glow points ---------- */
  const glowGeo=new THREE.BufferGeometry();
  glowGeo.setAttribute('position',new THREE.Float32BufferAttribute(glowPts.flatMap(g=>[g[0],g[1],g[2]]),3));
  glowGeo.setAttribute('color',new THREE.Float32BufferAttribute(glowPts.flatMap(g=>[g[3],g[4],g[5]]),3));
  glowGeo.setAttribute('size',new THREE.Float32BufferAttribute(glowPts.map(g=>g[6]),1));
  glowGeo.computeBoundingSphere();
  const glowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
    uniforms:{map:{value:T.makeGlow()},opacity:{value:1},scale:{value:400},pulse:{value:1}},
    vertexShader:`attribute float size;attribute vec3 color;varying vec3 vC;varying float vA,vF;uniform float scale;
      void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);float d=-mv.z;gl_PointSize=clamp(size*scale/max(d,.1),1.,120.);vA=smoothstep(2.,12.,d);vF=1.3-.7*smoothstep(80.,500.,d);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D map;uniform float opacity;varying vec3 vC;varying float vA,vF;
      void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC*t.rgb*t.a*opacity*vA*vF,1.);}`});
  const glowPoints=new THREE.Points(glowGeo,glowMat);glowPoints.frustumCulled=true;glowPoints.renderOrder=3;root.add(glowPoints);
  mats.glow=glowMat;

  /* ---------- cars ---------- */
  const carGeo=(()=>{
    const b=new Buf();
    b.fullBox(-2.1,.32,-.9,2.1,.95,.9,[1,1,1]);
    b.fullBox(-1.3,.95,-.8,.95,1.5,.8,[1,1,1]);
    const dark=hexToLinear('#10151d');
    b.fullBox(-1.25,1.0,-.83,.9,1.42,.83,dark);
    b.fullBox(-2.1,.32,-.9,2.1,.45,.9,hexToLinear('#202226'));
    const parts=[b.geometry().toNonIndexed()];
    for(const x of [-1.3,1.3])for(const z of [-.88,.88]){const w=colorize(new THREE.CylinderGeometry(.38,.38,.3,10).rotateX(Math.PI/2).translate(x,.38,z),hexToLinear('#15161a')).toNonIndexed();ensureUV(w);parts.push(w);}
    return mergeGeometries(parts);
  })();
  const lightGeo=(()=>{const b=new Buf();
    b.fullBox(2.1,.55,-.8,2.16,.72,-.42,[1,.95,.8]);b.fullBox(2.1,.55,.42,2.16,.72,.8,[1,.95,.8]);
    b.fullBox(-2.16,.55,-.82,-2.1,.7,-.45,[1,.06,.05]);b.fullBox(-2.16,.55,.45,-2.1,.7,.82,[1,.06,.05]);
    return b.geometry();})();
  const beamGeo=new THREE.PlaneGeometry(10,3.6).rotateX(-Math.PI/2).translate(2.2+5,.07,0);

  // paths: tile blocks into rectangles, one clockwise ring per tile
  const used=new Set(),tiles=[];
  const order=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++)order.push([i,j]);
  for(let k=order.length-1;k>0;k--){const r=(rng()*(k+1))|0;[order[k],order[r]]=[order[r],order[k]];}
  const shapes=[[1,1],[1,1],[2,1],[1,2],[2,2],[3,1],[1,3]];
  for(const [i,j] of order){
    if(used.has(i+','+j))continue;
    let placed=false;
    for(let tries=0;tries<4&&!placed;tries++){
      const [w,h]=shapes[(rng()*shapes.length)|0];
      let ok=i+w<=N&&j+h<=N;
      if(ok)for(let a=0;a<w;a++)for(let b=0;b<h;b++)if(used.has((i+a)+','+(j+b)))ok=false;
      if(ok){for(let a=0;a<w;a++)for(let b=0;b<h;b++)used.add((i+a)+','+(j+b));tiles.push({i,j,w,h});placed=true;}
    }
    if(!placed){used.add(i+','+j);tiles.push({i,j,w:1,h:1});}
  }
  function ringPoints(xmin,xmax,zmin,zmax,r){
    const pts=[];const arc=(cx,cz,fn)=>{for(let k=0;k<=8;k++){const a=k/8*Math.PI/2;const [dx,dz]=fn(a);pts.push([cx+dx*r,cz+dz*r]);}};
    pts.push([xmin+r,zmin]);
    arc(xmax-r,zmin+r,a=>[Math.sin(a),-Math.cos(a)]);
    arc(xmax-r,zmax-r,a=>[Math.cos(a),Math.sin(a)]);
    arc(xmin+r,zmax-r,a=>[-Math.sin(a),Math.cos(a)]);
    arc(xmin+r,zmin+r,a=>[-Math.cos(a),-Math.sin(a)]);
    pts.push(pts[0]);
    return pts;
  }
  const cars=[];
  for(const t of tiles){
    if(rng()<.12)continue;
    const xmin=bc(t.i)-BLOCK/2-3.5,xmax=bc(t.i+t.w-1)+BLOCK/2+3.5,zmin=bc(t.j)-BLOCK/2-3.5,zmax=bc(t.j+t.h-1)+BLOCK/2+3.5;
    const pts=ringPoints(xmin,xmax,zmin,zmax,6);
    const cum=[0];for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]));
    const L=cum[cum.length-1],speed=6+rng()*6;
    const n=Math.max(2,Math.floor(L/(30+rng()*16)));
    const off=rng()*L;
    for(let k=0;k<n;k++)cars.push({pts,cum,L,s:(off+k*L/n+(rng()-.5)*4)%L,speed,seg:0,sc:.92+rng()*.28,col:rng()});
  }
  const carMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.55,envMapIntensity:1.4});
  const carMesh=new THREE.InstancedMesh(carGeo,carMat,cars.length);carMesh.castShadow=true;carMesh.frustumCulled=false;
  const carLights=new THREE.InstancedMesh(lightGeo,new THREE.MeshBasicMaterial({vertexColors:true,color:0xffffff}),cars.length);carLights.frustumCulled=false;mats.carLights=carLights.material;
  const beamMat=new THREE.MeshBasicMaterial({map:T.makeBeam(),color:0xffe9b8,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});mats.beam=beamMat;
  const beamMesh=new THREE.InstancedMesh(beamGeo,beamMat,cars.length);beamMesh.frustumCulled=false;beamMesh.renderOrder=2;
  const carCols=['#c8322f','#e6e6e6','#1f2a3a','#f0b429','#2f7fc1','#3a3d44','#8b9aa6','#2e8b57','#f2f2f2','#7a1f2b','#d9822b','#ffffff'];
  const cc=new THREE.Color();
  cars.forEach((c,i)=>{cc.set(carCols[(c.col*carCols.length)|0]);carMesh.setColorAt(i,cc);});
  root.add(carMesh,carLights,beamMesh);
  const _cm=new THREE.Matrix4(),_cq=new THREE.Quaternion(),_cp=new THREE.Vector3(),_cs=new THREE.Vector3(),_cy=new THREE.Vector3(0,1,0);
  function updateCars(dt){
    for(let i=0;i<cars.length;i++){
      const c=cars[i];c.s=(c.s+c.speed*dt)%c.L;
      // find segment (cursor)
      let k=c.seg;if(c.cum[k]>c.s||c.cum[k+1]<c.s){k=0;let lo=0,hi=c.cum.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(c.cum[mid]<=c.s)lo=mid;else hi=mid;}k=lo;c.seg=k;}
      const a=c.pts[k],b=c.pts[k+1],seglen=c.cum[k+1]-c.cum[k]||1,u=(c.s-c.cum[k])/seglen;
      const dx=b[0]-a[0],dz=b[1]-a[1];
      const ang=Math.atan2(-dz,dx);
      // smooth heading with next segment slightly
      _cq.setFromAxisAngle(_cy,ang);_cp.set(a[0]+dx*u,0,a[1]+dz*u);_cs.set(c.sc,c.sc,c.sc);
      _cm.compose(_cp,_cq,_cs);carMesh.setMatrixAt(i,_cm);carLights.setMatrixAt(i,_cm);beamMesh.setMatrixAt(i,_cm);
    }
    carMesh.instanceMatrix.needsUpdate=carLights.instanceMatrix.needsUpdate=beamMesh.instanceMatrix.needsUpdate=true;
  }
  updateCars(0);

  /* ---------- collision ---------- */
  const CELL=32,grid=new Map();
  const key=(a,b)=>a+','+b;
  const add=(ix,iz,o)=>{const k=key(ix,iz);let l=grid.get(k);if(!l){l=[];grid.set(k,l);}l.push(o);};
  buildings.forEach(b=>{b.t='b';for(let ix=Math.floor((b.x0-1)/CELL);ix<=Math.floor((b.x1+1)/CELL);ix++)for(let iz=Math.floor((b.z0-1)/CELL);iz<=Math.floor((b.z1+1)/CELL);iz++)add(ix,iz,b);});
  obstacles.forEach(o=>{o.t='c';add(Math.floor(o.x/CELL),Math.floor(o.z/CELL),o);});
  function resolve(pos,r){
    let hit=false;
    const cx=Math.floor(pos.x/CELL),cz=Math.floor(pos.z/CELL);
    for(let ix=cx-1;ix<=cx+1;ix++)for(let iz=cz-1;iz<=cz+1;iz++){
      const l=grid.get(key(ix,iz));if(!l)continue;
      for(const o of l){
        if(o.t==='b'){
          const nx=Math.max(o.x0,Math.min(pos.x,o.x1)),nz=Math.max(o.z0,Math.min(pos.z,o.z1));
          let dx=pos.x-nx,dz=pos.z-nz;const d2=dx*dx+dz*dz;
          if(d2<r*r){
            hit=true;
            if(d2>1e-8){const d=Math.sqrt(d2);pos.x=nx+dx/d*r;pos.z=nz+dz/d*r;}
            else{ // inside: push out along smallest axis
              const l1=pos.x-o.x0,l2=o.x1-pos.x,l3=pos.z-o.z0,l4=o.z1-pos.z,m=Math.min(l1,l2,l3,l4);
              if(m===l1)pos.x=o.x0-r;else if(m===l2)pos.x=o.x1+r;else if(m===l3)pos.z=o.z0-r;else pos.z=o.z1+r;
            }
          }
        }else{
          const dx=pos.x-o.x,dz=pos.z-o.z,rr=r+o.r,d2=dx*dx+dz*dz;
          if(d2<rr*rr&&d2>1e-8){const d=Math.sqrt(d2);pos.x=o.x+dx/d*rr;pos.z=o.z+dz/d*rr;hit=true;}
        }
      }
    }
    return hit;
  }
  function groundAt(x,z){
    const i=Math.round(x/P)+4,j=Math.round(z/P)+4;
    if(i<0||i>=N||j<0||j>=N)return 0;
    return(Math.abs(x-bc(i))<BLOCK/2&&Math.abs(z-bc(j))<BLOCK/2)?SLAB:0;
  }

  return {root,mats,casters,buildings,blocks,cars,updateCars,updateWheel,resolve,groundAt,tiles,treeCount:treeList.length,lampCount:lampM.length,markerCount:markers.length,glowCount:glowPts.length,beaconMesh,
    stats:{buildings:buildings.length,cars:cars.length,trees:treeList.length,lamps:lampM.length,markers:markers.length}};
}
