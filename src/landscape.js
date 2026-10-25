import * as THREE from 'three';
import {lin,mulberry32} from './util.js';
import {EDGE,WALK_OUT,RIVER_Z0,RIVER_Z1,BRIDGE_X,ROAD} from './layout.js';

// value-noise fbm on the CPU
function makeNoise(seed){
  const r=mulberry32(seed),perm=new Uint8Array(512),g=new Float32Array(256);
  for(let i=0;i<256;i++){perm[i]=i;g[i]=r();}
  for(let i=255;i>0;i--){const j=(r()*(i+1))|0;[perm[i],perm[j]]=[perm[j],perm[i]];}
  for(let i=0;i<256;i++)perm[i+256]=perm[i];
  const h=(x,y)=>g[perm[(perm[x&255]+y)&255]];
  const n=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
    return (h(xi,yi)*(1-u)+h(xi+1,yi)*u)*(1-v)+(h(xi,yi+1)*(1-u)+h(xi+1,yi+1)*u)*v;};
  return (x,y,o=5)=>{let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*n(x*f,y*f);f*=2.03;a*=.5;}return s;};
}
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

export function buildLandscape(W){
  const {root,rng}=W,fbm=makeNoise(42);
  const H=(x,z)=>{
    if(z>RIVER_Z0-.01&&z<RIVER_Z1+.01)return -7;
    // distance outside the city / river corridor
    let d;
    if(z<RIVER_Z0)d=Math.max(Math.abs(x)-WALK_OUT,-z-WALK_OUT);
    else d=z-RIVER_Z1-30;
    if(z>RIVER_Z1&&Math.abs(x-BRIDGE_X)<ROAD)return -.03;
    const road=z>RIVER_Z1?sm(ROAD,ROAD*3,Math.abs(x-BRIDGE_X)):1;
    const n=fbm(x*.0016+3,z*.0016+7),n2=fbm(x*.006,z*.006,3);
    const hills=sm(60,700,d)*(30+260*Math.pow(n,2.2))+sm(10,80,d)*n2*6;
    return d<0?-.06:(hills-.06)*road;
  };
  // grid with extra lines at the river banks
  const xs=[],zs=[];
  for(let v=-3000;v<=3000;v+=v>-700&&v<700?20:45)xs.push(v);
  for(let v=-3000;v<=3000;v+=v>-700&&v<900?20:45)zs.push(v);
  zs.push(RIVER_Z0-.02,RIVER_Z0+.02,RIVER_Z1-.02,RIVER_Z1+.02,-WALK_OUT,WALK_OUT);xs.push(-WALK_OUT,WALK_OUT,BRIDGE_X-ROAD,BRIDGE_X+ROAD);
  xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);
  const nx=xs.length,nz=zs.length,pos=new Float32Array(nx*nz*3),col=new Float32Array(nx*nz*3),uv=new Float32Array(nx*nz*2);
  const grass=lin('#a8dc8a'),grass2=lin('#8fd18a'),mint=lin('#bfe9c9'),pink=lin('#f6b9cf'),lav=lin('#d9c4f0'),cream=lin('#fff6ec'),sand=lin('#f1dccb');
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=xs[i],z=zs[j],h=H(x,z),k=j*nx+i;
    pos[k*3]=x;pos[k*3+1]=h;pos[k*3+2]=z;uv[k*2]=x/8;uv[k*2+1]=z/8;
    let c;
    const tint=fbm(x*.0009+11,z*.0009+5,3);
    if(h<-1)c=sand;
    else{
      c=grass.map((v,q)=>v+(grass2[q]-v)*fbm(x*.01,z*.01,2));
      const hh=Math.max(0,h);
      const hillC=tint>.55?pink:tint<.42?lav:mint;
      c=c.map((v,q)=>v+(hillC[q]-v)*sm(25,110,hh));
      c=c.map((v,q)=>v+(cream[q]-v)*sm(150,215,hh+fbm(x*.02,z*.02,2)*30));
    }
    col[k*3]=c[0];col[k*3+1]=c[1];col[k*3+2]=c[2];
  }
  const idx=[];
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
    // skip the cells fully inside the city (covered by road and sidewalks)
    const cx=(xs[i]+xs[i+1])/2,cz=(zs[j]+zs[j+1])/2;
    if(Math.abs(cx)<WALK_OUT-1&&cz>-WALK_OUT+1&&cz<RIVER_Z0-1)continue;
    idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();
  const gt=W.mats.grassTex.clone();gt.needsUpdate=true;
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:gt,vertexColors:true,roughness:1}));
  m.receiveShadow=true;root.add(m);
  W.groundH=H;
  // far trees: meadows around the city and the far bank
  W.farTrees=[];
  for(let k=0;k<900;k++){
    const x=(rng()*2-1)*1400,z=(rng()*2-1)*1400;
    const h=H(x,z);if(h<-.5||h>140)continue;
    const inCity=Math.abs(x)<WALK_OUT+6&&z>-WALK_OUT-6&&z<RIVER_Z1+8;if(inCity)continue;
    if(z>RIVER_Z1&&Math.abs(x-BRIDGE_X)<ROAD*2)continue;
    if(fbm(x*.004+1,z*.004+2,2)<.45&&Math.abs(h)<5)continue;
    const r=rng();W.farTrees.push({x,z,y:h-.3,s:1.1+rng()*.9,kind:r<.25?'cone':r<.4?'blossom':'puff'});
  }
  // a few cottages on the far bank (simple, read as silhouettes)
  return H;
}
