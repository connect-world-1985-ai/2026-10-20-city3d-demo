import * as THREE from 'three';
import {mulberry32,GB,hook} from './util.js';
import {BLOCK,N,P,SLAB,EDGE,WALK_OUT,RIVER_Z0,RIVER_Z1,BRIDGE_X,ROAD,bc,district,isPark,PARK_THEME} from './layout.js';
import {makeFacadeMaterial} from './facade.js';
import {buildBuildings,cottage} from './buildings.js';
import {buildLandmark} from './landmark.js';
import {buildParks,buildTrees} from './nature.js';
import {buildStreets,buildLamps} from './streets.js';
import {buildWater,deckY} from './water.js';
import {buildLandscape} from './landscape.js';
import {buildTraffic} from './traffic.js';
import {buildPeople} from './people.js';
import {buildFx} from './fx.js';
import * as T from './textures.js';

export {BLOCK,N,P,EDGE,WALK_OUT,RIVER_Z0,RIVER_Z1,BRIDGE_X,bc};

export function makeUniforms(){
  const u=v=>({value:v});
  return {uTime:u(0),uLit:u(0),uDayIn:u(.4),uNight:u(0),uLamp:u(0),uHead:u(0),uDay:u(1),uPointScale:u(400)};
}

// cottages along the far bank of the river
function buildFarBank(W){
  const {rng}=W;
  for(let k=0;k<70;k++){
    const x=-650+rng()*1400,z=RIVER_Z1+30+rng()*260;
    if(Math.abs(x-BRIDGE_X)<22)continue;
    const w=9+((rng()*3)|0)*3,d=9+((rng()*2)|0)*3;
    const h=W.groundH(x,z),h2=W.groundH(x+w,z+d);if(h<-1||Math.abs(h-h2)>2.5||h>30)continue;
    if(W.buildings.some(b=>x<b.x1+4&&x+w>b.x0-4&&z<b.z1+4&&z+d>b.z0-4))continue;
    cottage(W,x,z,x+w,z+d,Math.min(h,h2),1+((rng()*2)|0));
  }
  W.farTrees=W.farTrees.filter(t=>!W.buildings.some(b=>t.x>b.x0-3&&t.x<b.x1+3&&t.z>b.z0-3&&t.z<b.z1+3));
}

export function buildCity(opts){
  const U=opts.U,aniso=opts.aniso||8;
  const W={root:new THREE.Group(),rng:mulberry32(20261024),U,aniso,mats:{},
    blocks:[],buildings:[],gardens:[],beacons:[],billboards:[],cafes:[],umbrellas:[],roofTrees:[],pools:[],glow:[],
    boxes:[],circles:[],inst:[],updaters:[],bridgeLamps:[],farLamps:[],crownGlow:new GB()};
  for(let i=0;i<N;i++)for(let j=0;j<N;j++)W.blocks.push({i,j,cx:bc(i),cz:bc(j),district:district(i,j),park:isPark(i,j),theme:PARK_THEME[i+','+j]});
  W.blockOf=(x,z)=>[Math.max(0,Math.min(N-1,Math.round(x/P)+4)),Math.max(0,Math.min(N-1,Math.round(z/P)+4))];

  /* chunked geometry buffers: 3x3 chunks so off-screen parts of the city are culled */
  const chunks=new Map();
  W.chunk=(i,j)=>{
    const k=((i/3)|0)+','+((j/3)|0);
    let c=chunks.get(k);
    if(!c){c={facade:new GB({fuv:[0,0],aWin:[3,3.6,.5,.5],aFac:[0,0,4,0]}),trim:new GB(),icing:new GB(),candy:new GB(),roof:new GB(),tiles:new GB(),sign:new GB({aSeed:[0]})};chunks.set(k,c);}
    return c;
  };

  buildBuildings(W);
  buildLandmark(W);
  buildParks(W);
  buildStreets(W);
  buildWater(W);
  buildLandscape(W);
  buildFarBank(W);
  buildLamps(W);
  buildTrees(W);
  buildTraffic(W);
  buildPeople(W);

  /* materials for the chunk buffers */
  const M=W.mats;
  M.facade=makeFacadeMaterial(U);
  M.trim=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,side:THREE.DoubleSide});
  M.icing=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,side:THREE.DoubleSide});
  hook(M.icing,'icing',s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
{vec3 q=floor(vViewPosition*22.);float h=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5);totalEmissiveRadiance+=vec3(step(.992,h))*.35;}`);});
  M.candy=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.16,envMapIntensity:1.25,side:THREE.DoubleSide});
  const spr=T.makeSprinkles(aniso);
  M.roof=new THREE.MeshStandardMaterial({vertexColors:true,map:spr,roughness:.5});
  hook(M.roof,'sprinkles',s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec4 spr=texture2D(map,vMapUv);').replace('#include <color_fragment>','diffuseColor.rgb=mix(vColor,spr.rgb,spr.a);');});
  M.tiles=new THREE.MeshStandardMaterial({vertexColors:true,map:T.makeShingles(aniso),roughness:.55,side:THREE.DoubleSide});
  const signs=T.makeSigns(aniso);
  M.sign=new THREE.MeshStandardMaterial({map:signs,emissiveMap:signs,emissive:0xffffff,emissiveIntensity:1,roughness:.5,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  hook(M.sign,'neon',s=>{s.uniforms.uTime=U.uTime;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aSeed;varying float vSeed;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSeed=aSeed;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;varying float vSeed;')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(vSeed<.12){float f=fract(sin(floor(uTime*(6.+vSeed*40.))*(vSeed*91.7+1.))*43758.5);totalEmissiveRadiance*=f<.25?.15:1.;}');});
  const meshes=[];
  for(const c of chunks.values()){
    for(const [k,mat,shadow] of [['facade',M.facade,1],['trim',M.trim,1],['icing',M.icing,1],['candy',M.candy,1],['roof',M.roof,1],['tiles',M.tiles,1],['sign',M.sign,0]]){
      const g=c[k].geometry();if(!g)continue;
      const m=new THREE.Mesh(g,mat);m.castShadow=!!shadow;m.receiveShadow=true;W.root.add(m);meshes.push(m);
    }
  }
  const fx=buildFx(W);

  /* ---------- collision ---------- */
  const CELL=32,grid=new Map(),key=(a,b)=>a+','+b;
  const addG=(ix,iz,o)=>{const k=key(ix,iz);let l=grid.get(k);if(!l){l=[];grid.set(k,l);}l.push(o);};
  for(const b of [...W.buildings,...W.boxes]){b.t='b';for(let ix=Math.floor((b.x0-1)/CELL);ix<=Math.floor((b.x1+1)/CELL);ix++)for(let iz=Math.floor((b.z0-1)/CELL);iz<=Math.floor((b.z1+1)/CELL);iz++)addG(ix,iz,b);}
  for(const o of W.circles){o.t='c';const R=o.ellipse?Math.max(...o.ellipse):o.r;for(let ix=Math.floor((o.x-R)/CELL);ix<=Math.floor((o.x+R)/CELL);ix++)for(let iz=Math.floor((o.z-R)/CELL);iz<=Math.floor((o.z+R)/CELL);iz++)addG(ix,iz,o);}
  function resolve(pos,r){
    let hit=false;const seen=new Set();
    const cx=Math.floor(pos.x/CELL),cz=Math.floor(pos.z/CELL);
    for(let ix=cx-1;ix<=cx+1;ix++)for(let iz=cz-1;iz<=cz+1;iz++){
      const l=grid.get(key(ix,iz));if(!l)continue;
      for(const o of l){
        if(seen.has(o))continue;seen.add(o);
        if(o.t==='b'){
          const nx=Math.max(o.x0,Math.min(pos.x,o.x1)),nz=Math.max(o.z0,Math.min(pos.z,o.z1));
          const dx=pos.x-nx,dz=pos.z-nz,d2=dx*dx+dz*dz;
          if(d2<r*r){hit=true;
            if(d2>1e-8){const d=Math.sqrt(d2);pos.x=nx+dx/d*r;pos.z=nz+dz/d*r;}
            else{const l1=pos.x-o.x0,l2=o.x1-pos.x,l3=pos.z-o.z0,l4=o.z1-pos.z,m=Math.min(l1,l2,l3,l4);
              if(m===l1)pos.x=o.x0-r;else if(m===l2)pos.x=o.x1+r;else if(m===l3)pos.z=o.z0-r;else pos.z=o.z1+r;}}
        }else if(o.ellipse){
          const [ex,ez]=o.ellipse,dx=(pos.x-o.x)/(ex+r),dz=(pos.z-o.z)/(ez+r),d=Math.hypot(dx,dz);
          if(d<1&&d>1e-6){pos.x=o.x+dx/d*(ex+r);pos.z=o.z+dz/d*(ez+r);hit=true;}
        }else{
          const dx=pos.x-o.x,dz=pos.z-o.z,rr=r+o.r,d2=dx*dx+dz*dz;
          if(d2<rr*rr&&d2>1e-8){const d=Math.sqrt(d2);pos.x=o.x+dx/d*rr;pos.z=o.z+dz/d*rr;hit=true;}
        }
      }
    }
    // keep out of the river except on the bridge
    if(pos.z>RIVER_Z0-.6&&pos.z<RIVER_Z1+.6&&Math.abs(pos.x-BRIDGE_X)>8.5-r){
      if(Math.abs(pos.x-BRIDGE_X)<10&&pos.z>RIVER_Z0+1&&pos.z<RIVER_Z1-1)pos.x=BRIDGE_X+Math.sign(pos.x-BRIDGE_X)*(8.5-r);
      else pos.z=pos.z<(RIVER_Z0+RIVER_Z1)/2?RIVER_Z0-.6:RIVER_Z1+.6;
      hit=true;
    }
    return hit;
  }
  function groundAt(x,z){
    if(Math.abs(x-BRIDGE_X)<9.5&&z>RIVER_Z0-6&&z<RIVER_Z1+6)return deckY(z)+(Math.abs(x-BRIDGE_X)>ROAD/2?.25:.02);
    const i=Math.round(x/P)+4,j=Math.round(z/P)+4;
    if(i>=0&&i<N&&j>=0&&j<N&&Math.abs(x-bc(i))<BLOCK/2&&Math.abs(z-bc(j))<BLOCK/2)return SLAB;
    const ax=Math.abs(x);
    if(ax<=EDGE&&z>=-EDGE&&z<=EDGE)return 0;
    if(z>EDGE&&z<RIVER_Z0&&ax<WALK_OUT)return Math.abs(x-BRIDGE_X)<ROAD/2?0:SLAB;
    if(ax<WALK_OUT&&z>=-WALK_OUT&&z<=EDGE)return SLAB;
    return Math.max(0,W.groundH(x,z));
  }

  /* ---------- per-frame ---------- */
  const last=new THREE.Vector3(1e9,0,0);let lodScale=1,lodFrames=0;
  function update(dt,time,cam,opts2={}){
    W.updateCars(dt,time);
    for(const f of W.updaters)f(dt,time);
    W.updatePeople(dt,cam,opts2.peopleDist||140);
    lodFrames++;
    if(opts2.lodScale!==undefined&&opts2.lodScale!==lodScale){lodScale=opts2.lodScale;last.set(1e9,0,0);}
    if(last.distanceToSquared(cam)>36||lodFrames>40){
      last.copy(cam);lodFrames=0;
      for(const I of W.inst)I.update(cam,lodScale);
    }
  }
  const tris=meshes.reduce((a,m)=>a+(m.geometry.index?m.geometry.index.count/3:0),0);
  return {root:W.root,mats:W.mats,W,update,resolve,groundAt,blocks:W.blocks,buildings:W.buildings,water:W.water,beacons:fx.beacons,
    stats:{buildings:W.buildings.length,cars:W.cars.length,people:W.people.length,trees:W.trees.length,lamps:W.lampCount,staticTris:tris,chunks:chunks.size}};
}
