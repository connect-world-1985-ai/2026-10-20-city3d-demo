import * as THREE from 'three';
import {GB,lin,mixc,mulc} from './util.js';
import {BLOCK,bc,district} from './layout.js';

const L=a=>a.map(lin);
const PAL={
  res:L(['#f6b8c9','#b9ead6','#fbe7a0','#d7c8f0','#fbcfa9','#bfe0f6','#d5e8b0','#fbf1dc','#f7a59a','#e6bfe9']),
  mid:L(['#f9d3dc','#cfeee2','#fdf0c4','#e3daf6','#ffe0c4','#d3ebfa','#f2e6d8','#f4c4d0','#c9e9f2']),
  old:L(['#8a5a3c','#6b4030','#c58b52','#a8703f','#efe0c8','#d9a77a','#b07a56']),
  core:L(['#f4c6d2','#bfe8dc','#d6cdf2','#c4e2f4','#f3dfc0','#fde2ea','#cfd8f6']),
};
export const ICING=L(['#fffaf4','#ffc9dc','#c8f2df','#6b3f2a','#fff0a6','#cfe6ff','#e9d5ff']);
const CHERRY=lin('#e8213f'),WHITE=lin('#fffaf4'),CREAM=lin('#fbf1dc');
const ROOFC=L(['#ffd6e2','#d4f5e6','#fff2c2','#e6dcff','#ffe1cc','#d9efff','#fffaf4']);
const TILEC=L(['#ef7d9c','#7cc9a8','#f2b45f','#9b86d8','#e8846e','#6fb2de','#8a5a3c']);
const STRIPE=L(['#ff6f9c','#58c9b0','#ffb84d','#8f7dff','#ff8a6b','#4fb6ef']);

/* ---------- footprint outlines ---------- */
// edges in perimeter order; each edge = {pts:[[x,z]..], nrm:[[nx,nz]..], face:0..3 for straight sides, -1 for corners}
export function outline(x0,z0,x1,z1,shape='rect',r=0,segs=0){
  const N=[[0,1],[1,0],[0,-1],[-1,0]];
  if(shape==='rect')r=0;
  r=Math.min(r,(x1-x0)/2-.5,(z1-z0)/2-.5);if(r<.3)r=0;
  const C=[[x1-r,z1-r],[x1-r,z0+r],[x0+r,z0+r],[x0+r,z1-r]];
  const edges=[];
  for(let k=0;k<4;k++){
    const pk=C[(k+3)%4],ck=C[k],n=N[k];
    edges.push({pts:[[pk[0]+n[0]*r,pk[1]+n[1]*r],[ck[0]+n[0]*r,ck[1]+n[1]*r]],nrm:[n,n],face:k});
    if(r>0){
      const n1=N[(k+1)%4];
      if(shape==='chamfer'){
        const nn=[(n[0]+n1[0])*Math.SQRT1_2,(n[1]+n1[1])*Math.SQRT1_2];
        edges.push({pts:[[ck[0]+n[0]*r,ck[1]+n[1]*r],[ck[0]+n1[0]*r,ck[1]+n1[1]*r]],nrm:[nn,nn],face:-1});
      }else{
        const seg=segs||Math.max(3,Math.round(r*1.4)),pts=[],nrm=[];
        for(let s=0;s<=seg;s++){const a=s/seg*Math.PI/2,c=Math.cos(a),sn=Math.sin(a),m=[n[0]*c+n1[0]*sn,n[1]*c+n1[1]*sn];pts.push([ck[0]+m[0]*r,ck[1]+m[1]*r]);nrm.push(m);}
        edges.push({pts,nrm,face:-1});
      }
    }
  }
  return edges;
}
function edgeLen(e){let l=0;for(let i=1;i<e.pts.length;i++)l+=Math.hypot(e.pts[i][0]-e.pts[i-1][0],e.pts[i][1]-e.pts[i-1][1]);return l;}
// dense closed perimeter path with round joins at sharp corners
function perim(edges,step){
  const out=[];
  for(let k=0;k<edges.length;k++){
    const e=edges[k],prev=edges[(k+edges.length-1)%edges.length],np=prev.nrm[prev.nrm.length-1],n0=e.nrm[0];
    const ang=Math.acos(Math.max(-1,Math.min(1,np[0]*n0[0]+np[1]*n0[1])));
    if(ang>.05){const a0=Math.atan2(np[1],np[0]);let da=Math.atan2(n0[1],n0[0])-a0;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
      const s=Math.max(2,Math.ceil(Math.abs(da)/.4));for(let i=1;i<s;i++){const a=a0+da*i/s;out.push({x:e.pts[0][0],z:e.pts[0][1],nx:Math.cos(a),nz:Math.sin(a)});}}
    for(let i=0;i<e.pts.length-1;i++){
      const a=e.pts[i],b=e.pts[i+1],na=e.nrm[i],nb=e.nrm[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.ceil(l/step));
      for(let j=0;j<m;j++){const t=j/m,nx=na[0]+(nb[0]-na[0])*t,nz=na[1]+(nb[1]-na[1])*t,nl=Math.hypot(nx,nz)||1;out.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,nx:nx/nl,nz:nz/nl});}
    }
  }
  return out;
}
// strips around a perimeter path; rows(i,p) -> [[out,y],...]; normals smooth within a strip
function ring(gb,path,rows,col){
  const n=path.length,R=rows(0,path[0]).length,pos=new Float32Array(n*R*3),idx=[];
  for(let i=0;i<n;i++){const p=path[i],rr=rows(i,p);for(let r=0;r<R;r++){const o=(i*R+r)*3;pos[o]=p.x+p.nx*rr[r][0];pos[o+1]=rr[r][1];pos[o+2]=p.z+p.nz*rr[r][0];}}
  for(let i=0;i<n;i++){const j=(i+1)%n;for(let r=0;r<R-1;r++){const a=i*R+r,b=j*R+r,c=j*R+r+1,d=i*R+r+1;idx.push(a,b,c,a,c,d);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  gb.add(g,null,col);g.dispose();
}
function band(gb,edges,y0,y1,out,col){
  const path=perim(edges,1e9);
  ring(gb,path,()=>[[0,y0],[out,y0]],col);
  ring(gb,path,()=>[[out,y0],[out,y1]],col);
  ring(gb,path,()=>[[out,y1],[0,y1]],col);
}
function cap(gb,edges,y,col,uvs=.25){
  const pts=[];for(const e of edges)for(let i=0;i<e.pts.length-1;i++)pts.push(e.pts[i]);
  let cx=0,cz=0;pts.forEach(p=>{cx+=p[0];cz+=p[1];});cx/=pts.length;cz/=pts.length;
  const c=gb.v([cx,y,cz],[0,1,0],[cx*uvs,cz*uvs],col);
  const ids=pts.map(p=>gb.v([p[0],y,p[1]],[0,1,0],[p[0]*uvs,p[1]*uvs],col));
  for(let i=0;i<ids.length;i++)gb.idx.push(c,ids[i],ids[(i+1)%ids.length]);
}
// puffy icing rim with drips hanging over the wall top
function icing(gb,edges,yT,col,rng,dripAmt=1){
  const ST=.55,path=perim(edges,ST);
  const drips=[];let s=0;
  while(s<path.length*ST){s+=.5+rng()*1.6;drips.push({s,w:.35+rng()*.45,l:(.25+Math.pow(rng(),1.5)*1.7)*dripAmt});}
  const tot=path.length*ST;
  const dr=i=>{const x=i*ST;let d=0;for(const q of drips){let dx=Math.abs(x-q.s);dx=Math.min(dx,tot-dx);if(dx<q.w)d=Math.max(d,q.l*Math.cos(dx/q.w*Math.PI/2));}return d;};
  ring(gb,path,i=>{const d=dr(i);return [[0,yT-.36-d],[.2,yT-.36-d],[.33,yT-.2-d*.6],[.32,yT+.12],[.05,yT+.34],[-.4,yT+.18]];},col);
}

/* ---------- walls ---------- */
function walls(fb,edges,y0,y1,o){
  let u=o.u0||0;
  for(const e of edges){
    const len=edgeLen(e);if(len<.05)continue;
    const shop=o.shop&&e.face>=0&&o.shopFaces.has(e.face)&&y0<.01;
    let n=Math.max(1,Math.round(len/o.cell));if(shop)n=Math.max(2,2*Math.round(len/(2*o.cell)));
    fb.set('aWin',[len/n,o.fh,o.ww,o.wh]).set('aFac',[o.seed,o.kind,o.gH,(shop?1:0)+(o.arch?2:0)]);
    let acc=0;
    for(let i=0;i<e.pts.length-1;i++){
      const a=e.pts[i],b=e.pts[i+1],na=e.nrm[i],nb=e.nrm[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const ua=u+n*acc/len,ub=u+n*(acc+l)/len;acc+=l;
      const N1=[na[0],0,na[1]],N2=[nb[0],0,nb[1]];
      fb.set('fuv',[ua,y0]);const i0=fb.v([a[0],y0,a[1]],N1,[0,0],o.col);
      fb.set('fuv',[ub,y0]);fb.v([b[0],y0,b[1]],N2,[0,0],o.col);
      fb.set('fuv',[ub,y1]);fb.v([b[0],y1,b[1]],N2,[0,0],o.col);
      fb.set('fuv',[ua,y1]);fb.v([a[0],y1,a[1]],N1,[0,0],o.col);
      fb.idx.push(i0,i0+1,i0+2,i0,i0+2,i0+3);
    }
    u+=n;
  }
  return u;
}

/* ---------- roof furniture ---------- */
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3();
const M=(x,y,z,sx=1,sy=1,sz=1,ry=0)=>_m.compose(_p.set(x,y,z),_q.setFromAxisAngle(new THREE.Vector3(0,1,0),ry),_s.set(sx,sy,sz)).clone();
function swirl(gb,cx,cz,y,R,col,rng){
  let yy=y,r=R;
  for(let k=0;k<5;k++){
    const tube=r*.36;yy+=tube*.95;
    const t=new THREE.TorusGeometry(r*.8,tube,8,Math.max(14,Math.round(r*6)));t.rotateX(-Math.PI/2);
    gb.add(t,M(cx,yy,cz,1,1.15,1,rng()*6),col);t.dispose();
    yy+=tube*.25;r*=.74;
  }
  const tip=new THREE.ConeGeometry(r*1.1,r*2.6,14,3);tip.translate(0,r*1.3,0);gb.add(tip,M(cx,yy+r*.2,cz),col);tip.dispose();
  const ch=new THREE.SphereGeometry(Math.max(.5,R*.16),12,8);gb.add(ch,M(cx,yy+r*2.9+R*.12,cz),CHERRY);ch.dispose();
  return yy+r*3+R*.3;
}
function dome(gb,cx,cz,y,R,c1,c2,h=1){
  const g=new THREE.SphereGeometry(R,24,10,0,Math.PI*2,0,Math.PI/2);
  gb.add(g,M(cx,y,cz,1,h,1),(v)=>{const a=Math.atan2(v.z-cz,v.x-cx);return (Math.floor((a+Math.PI)/(Math.PI*2)*12)%2)?c1:c2;});g.dispose();
  const f=new THREE.SphereGeometry(R*.12,10,6);gb.add(f,M(cx,y+R*h+R*.08,cz),c1);f.dispose();
  return y+R*h+R*.2;
}
function spire(gb,cx,cz,y,R,H,c1,c2){
  const g=new THREE.ConeGeometry(R,H,16,14,false);g.translate(0,H/2,0);
  gb.add(g,M(cx,y,cz),(v)=>{const a=Math.atan2(v.z-cz,v.x-cx)/(Math.PI*2);return (Math.floor((a+(v.y-y)/H*3)*6+60)%2)?c1:c2;});g.dispose();
  return y+H;
}
function waterTower(gb,cx,cz,y,c1,c2,legC){
  for(const [dx,dz] of [[-1,-1],[1,-1],[1,1],[-1,1]])gb.box(cx+dx*1.3-.12,y,cz+dz*1.3-.12,cx+dx*1.3+.12,y+3,cz+dz*1.3+.12,legC);
  const t=new THREE.CylinderGeometry(1.9,1.9,3.2,16,4);t.translate(0,1.6,0);
  gb.add(t,M(cx,y+3,cz),v=>Math.floor((v.y-y-3)/.8)%2?c1:c2);t.dispose();
  const r=new THREE.ConeGeometry(2.15,1.4,16);r.translate(0,.7,0);gb.add(r,M(cx,y+6.2,cz),c1);r.dispose();
}
function gable(trim,tiles,x0,z0,x1,z1,y,roofC,wallC,rng){
  const alongX=(x1-x0)>=(z1-z0),w=alongX?z1-z0:x1-x0,rise=w*(.32+rng()*.12),o=.45;
  if(alongX){
    const zm=(z0+z1)/2,yr=y+rise;
    const s=Math.hypot(w/2+o,rise+o*rise/(w/2));
    const nA=[0,w/2,rise],nl=Math.hypot(...nA);const nn=[0,(w/2)/nl,rise/nl];
    tiles.quad([x0-o,y-o*rise/(w/2),z1+o],[x1+o,y-o*rise/(w/2),z1+o],[x1+o,yr,zm],[x0-o,yr,zm],[0,nn[1],nn[2]],[[0,0],[(x1-x0+2*o)/4,0],[(x1-x0+2*o)/4,s/4],[0,s/4]],roofC);
    tiles.quad([x1+o,y-o*rise/(w/2),z0-o],[x0-o,y-o*rise/(w/2),z0-o],[x0-o,yr,zm],[x1+o,yr,zm],[0,nn[1],-nn[2]],[[0,0],[(x1-x0+2*o)/4,0],[(x1-x0+2*o)/4,s/4],[0,s/4]],roofC);
    trim.tri([x0,y,z1],[x0,y,z0],[x0,yr,zm],[-1,0,0],wallC);trim.tri([x1,y,z0],[x1,y,z1],[x1,yr,zm],[1,0,0],wallC);
    trim.box(x0-o,yr-.05,zm-.18,x1+o,yr+.22,zm+.18,WHITE);
    const cx=x0+(x1-x0)*(.2+rng()*.6);trim.box(cx-.5,y+rise*.4,z0+w*.2,cx+.5,yr+1.2,z0+w*.2+1,mulc(wallC,.8));
  }else{
    const xm=(x0+x1)/2,yr=y+rise;
    const s=Math.hypot(w/2+o,rise+o*rise/(w/2));const nl=Math.hypot(w/2,rise);const nn=[(w/2)/nl,rise/nl];
    tiles.quad([x1+o,y-o*rise/(w/2),z1+o],[x1+o,y-o*rise/(w/2),z0-o],[xm,yr,z0-o],[xm,yr,z1+o],[nn[1],nn[0],0],[[0,0],[(z1-z0+2*o)/4,0],[(z1-z0+2*o)/4,s/4],[0,s/4]],roofC);
    tiles.quad([x0-o,y-o*rise/(w/2),z0-o],[x0-o,y-o*rise/(w/2),z1+o],[xm,yr,z1+o],[xm,yr,z0-o],[-nn[1],nn[0],0],[[0,0],[(z1-z0+2*o)/4,0],[(z1-z0+2*o)/4,s/4],[0,s/4]],roofC);
    trim.tri([x0,y,z0],[x1,y,z0],[xm,yr,z0],[0,0,-1],wallC);trim.tri([x1,y,z1],[x0,y,z1],[xm,yr,z1],[0,0,1],wallC);
    trim.box(xm-.18,yr-.05,z0-o,xm+.18,yr+.22,z1+o,WHITE);
    const cz=z0+(z1-z0)*(.2+rng()*.6);trim.box(x0+w*.2,y+rise*.4,cz-.5,x0+w*.2+1,yr+1.2,cz+.5,mulc(wallC,.8));
  }
  return y+rise;
}

/* ---------- main generator ---------- */
export function buildBuildings(W){
  const {rng,blocks}=W;
  const pick=a=>a[(rng()*a.length)|0];
  const snap=v=>Math.round(v*2)/2;

  function building(blk,x0,z0,x1,z1,dist){
    const D=blk.district,ch=W.chunk(blk.i,blk.j),fb=ch.facade,trim=ch.trim,ice=ch.icing,candy=ch.candy,roof=ch.roof,tiles=ch.tiles;
    const w=x1-x0,d=z1-z0,minD=Math.min(w,d),seed=rng()*97+1;
    // archetype
    let F,kind,shape='rect',rad=0,crown,cell,fh=3.5,gH=4.4,ww=.5,wh=.52,arch=false;
    const centralF=Math.max(0,1-dist/3.2);
    if(D==='core'){
      F=Math.round(18+Math.pow(rng(),.8)*20+centralF*16);
      kind=rng()<.62?1:rng()<.6?2:0;fh=kind===1?3.9:3.7;cell=kind===1?2.6:kind===2?4.8:3.3;
      shape=rng()<.4?'round':rng()<.6?'chamfer':'rect';rad=3+rng()*5;
      crown=pick(['swirl','spire','dome','helipad','spire','swirl','deco']);
    }else if(D==='mid'){
      F=Math.round(7+Math.pow(rng(),1.3)*18);
      kind=pick([0,0,2,1,4]);fh=3.6;cell=kind===2?4.6:kind===1?2.8:3.4;
      shape=rng()<.25?'chamfer':rng()<.25?'round':'rect';rad=2+rng()*3;
      crown=F>16?pick(['swirl','dome','flat','spire']):pick(['flat','flat','drip','drip','dome','swirl']);
      arch=kind===0&&rng()<.35;
    }else if(D==='old'){
      F=3+((rng()*5)|0);kind=rng()<.55?3:0;fh=3.6;cell=kind===3?3:3.2;gH=4.2;
      crown=rng()<.6?'gable':'drip';arch=kind===0&&rng()<.6;ww=kind===3?.48:.46;wh=kind===3?.56:.58;
    }else{
      F=3+Math.round(Math.pow(rng(),1.6)*9);kind=rng()<.7?4:0;fh=3.4;cell=3.6;gH=F<5&&rng()<.5?0:4.2;
      crown=F<=5&&rng()<.6?'gable':pick(['drip','drip','garden','flat','pool']);arch=rng()<.25;ww=.42;wh=.5;
      shape=F>=7&&rng()<.25?'round':'rect';rad=2;
    }
    if(crown==='gable'&&minD>18)crown=rng()<.5?'drip':'garden';
    const wallC=pick(PAL[D==='center'?'core':D]);
    const icingC=D==='old'?pick([ICING[0],ICING[0],ICING[3],ICING[1]]):pick(ICING);
    const shopFaces=new Set(),lim=BLOCK/2-12;
    if(z1>blk.cz+lim)shopFaces.add(0);if(x1>blk.cx+lim)shopFaces.add(1);if(z0<blk.cz-lim)shopFaces.add(2);if(x0<blk.cx-lim)shopFaces.add(3);
    const shop=gH>0&&shopFaces.size>0;
    const gh=gH>0?gH:fh;const H=f=>gh+(f-1)*fh;
    // tiers
    const tiers=[];
    if(D==='core'&&F>14){
      const pod=2+((rng()*2)|0),ins=minD>=26?4.5:3;
      tiers.push({ins:0,f:pod,shape:'rect',kind:0,cell:3.4});
      const f2=crown==='deco'?Math.round(F*.62):F-(rng()<.5?0:Math.round(F*.2));
      tiers.push({ins,f:f2,shape,kind,cell});
      if(f2<F)tiers.push({ins:ins+3,f:F,shape,kind,cell});
      if(crown==='deco'){tiers[tiers.length-1].f=Math.round(F*.82);tiers.push({ins:ins+6,f:F,shape:'chamfer',kind,cell});}
    }else if(D==='mid'&&F>=12&&minD>=22&&rng()<.55){
      tiers.push({ins:0,f:Math.round(F*.6),shape,kind,cell},{ins:3,f:F,shape,kind,cell});
    }else tiers.push({ins:0,f:F,shape,kind,cell});
    let y0=0,top=null,uAcc=0,lastEdges=null;
    for(let t=0;t<tiers.length;t++){
      const T=tiers[t],tx0=x0+T.ins,tx1=x1-T.ins,tz0=z0+T.ins,tz1=z1-T.ins;
      if(tx1-tx0<8||tz1-tz0<8)break;
      const y1=H(T.f);
      const edges=outline(tx0,tz0,tx1,tz1,T.shape,T.shape==='rect'?0:Math.min(rad,(Math.min(tx1-tx0,tz1-tz0))*.3));
      uAcc=walls(fb,edges,y0,y1,{u0:uAcc+7,cell:T.cell,fh,ww,wh,seed,kind:T.kind,gH:gh,shop:shop&&t===0,shopFaces,arch,col:wallC});
      // floor bands / cornices
      if(T.kind===0||T.kind===4){if(y1-y0>10&&rng()<.5)band(trim,edges,gh-.05,gh+.35,.22,mixc(wallC,WHITE,.6));}
      if(t<tiers.length-1){ // setback terrace: cap + rim
        cap(roof,edges,y1,pick(ROOFC));
        if(D==='core'||rng()<.5)icing(ice,edges,y1,icingC,rng,.7);else band(trim,edges,y1-.4,y1+.8,.3,mixc(wallC,WHITE,.5));
      }
      top={x0:tx0,x1:tx1,z0:tz0,z1:tz1,y:y1,edges};lastEdges=edges;y0=y1;
    }
    if(!top)return;
    const cx=(top.x0+top.x1)/2,cz=(top.z0+top.z1)/2,tw=top.x1-top.x0,td=top.z1-top.z0,tm=Math.min(tw,td);
    let yTop=top.y;
    // street level: awnings + signs
    if(shop)shopFront(blk,ch,x0,z0,x1,z1,gh,shopFaces,D,wallC);
    if((kind===4||(kind===0&&D!=='old'))&&F>=4)balconies(trim,x0,z0,x1,z1,gh,fh,tiers[0].f,shopFaces,cell,wallC);
    // crown
    const roofCol=pick(ROOFC);
    if(crown==='gable'){
      yTop=gable(trim,tiles,top.x0,top.z0,top.x1,top.z1,top.y,pick(TILEC),wallC,rng);
      icing(ice,top.edges,top.y,icingC,rng,.55);
    }else{
      if(crown==='drip'||crown==='garden'||crown==='pool'||crown==='flat'||crown==='helipad'){
        cap(roof,top.edges,top.y,roofCol);
        if(crown==='flat'||crown==='helipad')band(trim,top.edges,top.y-.3,top.y+.9,.25,mixc(wallC,WHITE,.55));
        else icing(ice,top.edges,top.y,icingC,rng);
      }else{ cap(roof,top.edges,top.y,roofCol);icing(ice,top.edges,top.y,icingC,rng,.8); }
      const hv=()=>{const n=1+((rng()*3)|0);for(let k=0;k<n;k++){const w2=1.5+rng()*2.5,d2=1.5+rng()*2.5,h2=1+rng()*1.6,ex=top.x0+1.2+rng()*Math.max(.1,tw-w2-2.4),ez=top.z0+1.2+rng()*Math.max(.1,td-d2-2.4);trim.box(ex,top.y,ez,ex+w2,top.y+h2,ez+d2,mixc(pick(ROOFC),[.7,.7,.75],.35));}};
      if(crown==='swirl'){yTop=swirl(ice,cx,cz,top.y+.2,tm*.42,icingC===ICING[3]?ICING[1]:icingC,rng);}
      else if(crown==='dome'){const c1=pick(STRIPE);yTop=dome(candy,cx,cz,top.y,tm*.42,c1,WHITE,F>14?1.1:.8);}
      else if(crown==='spire'||crown==='deco'){
        const R=tm*.3;candy.box(cx-R*1.25,top.y,cz-R*1.25,cx+R*1.25,top.y+2.4,cz+R*1.25,WHITE);
        yTop=spire(candy,cx,cz,top.y+2.4,R*1.15,R*4+rng()*10,pick(STRIPE),WHITE);
        W.beacons.push([cx,yTop+.6,cz]);
      }else if(crown==='helipad'){
        const pad=new THREE.CylinderGeometry(tm*.36,tm*.36,.25,28);trim.add(pad,M(cx,top.y+.14,cz),lin('#6d6a78'));pad.dispose();
        const ring2=new THREE.TorusGeometry(tm*.3,.18,4,40);ring2.rotateX(-Math.PI/2);trim.add(ring2,M(cx,top.y+.3,cz),lin('#ffd84d'));ring2.dispose();
        trim.box(cx-1.6,top.y+.27,cz-2.2,cx-1,top.y+.32,cz+2.2,WHITE);trim.box(cx+1,top.y+.27,cz-2.2,cx+1.6,top.y+.32,cz+2.2,WHITE);trim.box(cx-1,top.y+.27,cz-.3,cx+1,top.y+.32,cz+.3,WHITE);
        W.beacons.push([top.x0+1,top.y+1.2,top.z0+1],[top.x1-1,top.y+1.2,top.z1-1]);
      }else if(crown==='garden'){
        trim.box(top.x0+1.5,top.y,top.z0+1.5,top.x1-1.5,top.y+.25,top.z1-1.5,lin('#9fdc7c'));
        W.roofTrees.push(...Array.from({length:2+((rng()*4)|0)},()=>[top.x0+2.5+rng()*(tw-5),top.y+.25,top.z0+2.5+rng()*(td-5)]));
        W.umbrellas.push([cx+(rng()-.5)*tw*.3,top.y+.25,cz+(rng()-.5)*td*.3]);
      }else if(crown==='pool'&&tm>11){
        const pw=Math.min(tw-5,10),pd=Math.min(td-5,5);trim.box(cx-pw/2-.6,top.y,cz-pd/2-.6,cx+pw/2+.6,top.y+.3,cz+pd/2+.6,WHITE);
        W.pools.push([cx,top.y+.31,cz,pw,pd]);
        W.umbrellas.push([cx+pw/2+.5,top.y,cz+pd/2+1.4]);
      }else if(crown==='flat'){
        hv();if(rng()<.55&&tm>9)waterTower(trim,top.x0+3+rng()*(tw-6),top.z0+3+rng()*(td-6),top.y,pick(STRIPE),WHITE,lin('#8a6a5c'));
        if(rng()<.18&&W.billboards.length<10&&tw>14)W.billboards.push({x:cx,z:cz,y:top.y,w:Math.min(tw*.8,16),axis:tw>td?0:1,k:W.billboards.length%2});
      }else hv();
      if(F>=20&&crown!=='spire'&&crown!=='deco'&&crown!=='helipad')W.beacons.push([cx,yTop+.5,cz]);
    }
    W.buildings.push({x0,z0,x1,z1,h:yTop,col:wallC});
  }

  function shopFront(blk,ch,x0,z0,x1,z1,gH,faces,D,wallC){
    const faceDef={0:{a:[x0,z1],t:[1,0],n:[0,1],len:x1-x0},1:{a:[x1,z1],t:[0,-1],n:[1,0],len:z1-z0},2:{a:[x1,z0],t:[-1,0],n:[0,-1],len:x1-x0},3:{a:[x0,z0],t:[0,1],n:[-1,0],len:z1-z0}};
    for(const f of faces){
      const F=faceDef[f],n=Math.max(1,Math.round(F.len/(2*3.4))),sw=F.len/n;
      for(let k=0;k<n;k++){
        const s0=k*sw+.3,s1=(k+1)*sw-.3,r=rng();
        const P=(s,o,y)=>[F.a[0]+F.t[0]*s+F.n[0]*o,y,F.a[1]+F.t[1]*s+F.n[1]*o];
        const NN=[F.n[0],0,F.n[1]];
        if(r<.62){ // striped awning with scalloped valance
          const c1=pick(STRIPE),c2=WHITE,yT=gH-1.32,yF=yT-.8,dep=1.5,ns=Math.max(4,Math.round((s1-s0)/.5));
          const nrm=[F.n[0]*.47,.88,F.n[1]*.47];
          for(let q=0;q<ns;q++){
            const a=s0+(s1-s0)*q/ns,b=s0+(s1-s0)*(q+1)/ns,c=q%2?c1:c2;
            ch.trim.quad(P(a,.05,yT),P(a,dep,yF),P(b,dep,yF),P(b,.05,yT),nrm,[[0,0],[0,1],[1,1],[1,0]],c);
            ch.trim.quad(P(a,dep,yF),P(a,dep,yF-.32),P(b,dep,yF-.32),P(b,dep,yF),NN,[[0,0],[0,1],[1,1],[1,0]],c);
            const m=(a+b)/2,hw=(b-a)/2;
            for(let z=0;z<4;z++){const a1=Math.PI*z/4,a2=Math.PI*(z+1)/4;ch.trim.tri(P(m,dep,yF-.32),P(m-Math.cos(a1)*hw,dep,yF-.32-Math.sin(a1)*hw*.8),P(m-Math.cos(a2)*hw,dep,yF-.32-Math.sin(a2)*hw*.8),NN,c);}
          }
          // underside so it reads from below
          ch.trim.quad(P(s0,.05,yT-.02),P(s1,.05,yT-.02),P(s1,dep,yF-.02),P(s0,dep,yF-.02),[0,-1,0],[[0,0],[1,0],[1,1],[0,1]],mulc(c1,.8));
          if(rng()<.3)W.cafes.push({p:P((s0+s1)/2,3.2,0),ry:Math.atan2(F.n[0],F.n[1])});
        }
        if(r>.3){ // sign in the fascia
          const sgn=ch.sign,tw2=Math.min(s1-s0-.4,5.2),m=(s0+s1)/2,ya=gH-1.2,yb=gH-.2,o=.14;
          const id=(rng()*16)|0,u0=(id%4)/4,v1=1-((id/4)|0)*.125,v0=v1-.125;
          sgn.set('aSeed',[rng()]);
          sgn.quad(P(m-tw2/2,o,ya),P(m+tw2/2,o,ya),P(m+tw2/2,o,yb),P(m-tw2/2,o,yb),NN,[[u0,v0],[u0+.25,v0],[u0+.25,v1],[u0,v1]],[1,1,1]);
        }
        if((D==='old'||D==='mid')&&rng()<(D==='old'?.55:.2)){ // vertical blade sign
          const sgn=ch.sign,m=k*sw+.25,ya=gH+.2,yb=ya+3.6,id=(rng()*8)|0,u0=id/8,u1=u0+1/8;
          const A=P(m,.2,ya),B=P(m,1.3,ya),C=P(m,1.3,yb),Dd=P(m,.2,yb),tn=[F.t[0],0,F.t[1]];
          sgn.set('aSeed',[rng()]);
          sgn.quad(A,B,C,Dd,tn,[[u0,0],[u1,0],[u1,.5],[u0,.5]],[1,1,1]);
          sgn.quad(B,A,Dd,C,[-tn[0],0,-tn[2]],[[u0,0],[u1,0],[u1,.5],[u0,.5]],[1,1,1]);
          ch.trim.box(Math.min(A[0],C[0])-.04,ya-.08,Math.min(A[2],C[2])-.04,Math.max(A[0],C[0])+.04,ya,Math.max(A[2],C[2])+.04,lin('#5a4048'));
        }
      }
    }
  }
  function balconies(trim,x0,z0,x1,z1,gH,fh,F,faces,cell,wallC){
    const faceDef={0:{a:[x0,z1],t:[1,0],n:[0,1],len:x1-x0},1:{a:[x1,z1],t:[0,-1],n:[1,0],len:z1-z0},2:{a:[x1,z0],t:[-1,0],n:[0,-1],len:x1-x0},3:{a:[x0,z0],t:[0,1],n:[-1,0],len:z1-z0}};
    const railC=rng()<.5?WHITE:pick(STRIPE),slabC=mixc(wallC,WHITE,.5);
    for(const f of faces){
      if(rng()<.35)continue;
      const D=faceDef[f],n=Math.max(1,Math.round(D.len/cell)),cw=D.len/n,every=rng()<.5?2:3;
      for(let fl=1;fl<Math.min(F,14);fl++){
        const y=gH+(fl-1)*fh;
        for(let k=0;k<n;k++){
          if((k+fl)%every)continue;
          const a=k*cw+cw*.12,b=(k+1)*cw-cw*.12;
          const P=(s,o)=>[D.a[0]+D.t[0]*s+D.n[0]*o,D.a[1]+D.t[1]*s+D.n[1]*o];
          const p0=P(a,0),p1=P(b,1.1),q0=P(a,1.02),q1=P(b,1.1);
          trim.box(Math.min(p0[0],p1[0]),y-.05,Math.min(p0[1],p1[1]),Math.max(p0[0],p1[0]),y+.15,Math.max(p0[1],p1[1]),slabC,true);
          trim.box(Math.min(q0[0],q1[0]),y+.15,Math.min(q0[1],q1[1]),Math.max(q0[0],q1[0]),y+1.05,Math.max(q0[1],q1[1]),railC);
        }
      }
    }
  }

  /* ---------- lots ---------- */
  function split(x0,z0,w,d,out,depth,minS){
    const canX=w>=minS*2+2,canZ=d>=minS*2+2;
    if((canX||canZ)&&depth<4&&!(depth===0&&rng()<.1)){
      const sx=canX&&(!canZ||w>d||rng()<.4);
      if(sx){const a=Math.round(w*(.4+rng()*.2));split(x0,z0,a,d,out,depth+1,minS);split(x0+a,z0,w-a,d,out,depth+1,minS);}
      else{const a=Math.round(d*(.4+rng()*.2));split(x0,z0,w,a,out,depth+1,minS);split(x0,z0+a,w,d-a,out,depth+1,minS);}
    }else out.push({x0,z0,w,d});
  }
  for(const blk of blocks){
    if(blk.district==='park'||blk.district==='center')continue;
    const R=BLOCK/2-4.5,lots=[],minS={core:24,mid:20,old:13,res:14}[blk.district];
    split(blk.cx-R,blk.cz-R,R*2,R*2,lots,0,minS);
    const dist=Math.hypot(blk.i-4,blk.j-4);
    for(const lot of lots){
      const interior=lot.x0>blk.cx-R+.5&&lot.x0+lot.w<blk.cx+R-.5&&lot.z0>blk.cz-R+.5&&lot.z0+lot.d<blk.cz+R-.5;
      if((rng()<.08&&lot.w*lot.d<700)||interior){W.gardens.push({cx:lot.x0+lot.w/2,cz:lot.z0+lot.d/2,w:lot.w,d:lot.d,blk});continue;}
      const g=blk.district==='old'?.4:1+rng()*1.2;
      // keep street faces close to the sidewalk, gaps inside the block
      let bx0=lot.x0+(lot.x0<=blk.cx-R+.1?.6:g),bx1=lot.x0+lot.w-(lot.x0+lot.w>=blk.cx+R-.1?.6:g);
      let bz0=lot.z0+(lot.z0<=blk.cz-R+.1?.6:g),bz1=lot.z0+lot.d-(lot.z0+lot.d>=blk.cz+R-.1?.6:g);
      if(bx1-bx0<9||bz1-bz0<9){W.gardens.push({cx:lot.x0+lot.w/2,cz:lot.z0+lot.d/2,w:lot.w,d:lot.d,blk});continue;}
      building(blk,snap(bx0),snap(bz0),snap(bx1),snap(bz1),dist);
    }
  }
}
// small pastel cottages for the far bank (no block context)
export function cottage(W,x0,z0,x1,z1,y,F){
  const {rng}=W,ch=W.chunk(40,40),pick=a=>a[(rng()*a.length)|0];
  const col=pick(PAL.res),edges=outline(x0,z0,x1,z1,'rect',0),fh=3.3,top=y+fh*F;
  const g=new GB({fuv:[0,0],aWin:[3,3.3,.42,.5],aFac:[0,4,fh,0]});
  walls(g,edges,y,top,{cell:3.4,fh,ww:.42,wh:.5,seed:rng()*90,kind:4,gH:fh,shop:false,shopFaces:new Set(),arch:rng()<.3,col});
  // walls() writes v as absolute height; shift so floors start at the ground
  const gg=g.geometry(),fu=gg.attributes.fuv;for(let i=0;i<fu.count;i++)fu.setY(i,fu.getY(i)-y);
  const base=ch.facade.count,p=gg.attributes.position,n=gg.attributes.normal,c=gg.attributes.color,aw=gg.attributes.aWin,af=gg.attributes.aFac;
  for(let i=0;i<p.count;i++){ch.facade.set('fuv',[fu.getX(i),fu.getY(i)]).set('aWin',[aw.getX(i),aw.getY(i),aw.getZ(i),aw.getW(i)]).set('aFac',[af.getX(i),af.getY(i),af.getZ(i),af.getW(i)]);ch.facade.v([p.getX(i),p.getY(i),p.getZ(i)],[n.getX(i),n.getY(i),n.getZ(i)],[0,0],[c.getX(i),c.getY(i),c.getZ(i)]);}
  for(const v of gg.index.array)ch.facade.idx.push(base+v);
  gable(ch.trim,ch.tiles,x0,z0,x1,z1,top,pick(TILEC),col,rng);
  ch.trim.box(x0-.3,y-1.5,z0-.3,x1+.3,y+.05,z1+.3,mixc(col,[.6,.55,.55],.4));
  W.buildings.push({x0,z0,x1,z1,h:top,col});
}
export {icing,band,cap,walls,swirl,dome,spire,M};
