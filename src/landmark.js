import * as THREE from 'three';
import {GB,lin} from './util.js';
import {outline,walls,icing,cap,spire,M} from './buildings.js';

/* Sugar Spire: podium + twisted, tapering curtain-wall shaft + glowing frosting crown + candy spire */
export function buildLandmark(W){
  const ch=W.chunk(4,4),fb=ch.facade;
  const PINK=lin('#ffb3cc'),WHITE=lin('#fffaf4'),GLASS=lin('#f2c4d6');
  // podium
  const pod=outline(-17,-17,17,17,'round',7);
  walls(fb,pod,0,14.6,{cell:3.4,fh:4.6,ww:.55,wh:.6,seed:77.7,kind:0,gH:5.4,shop:true,shopFaces:new Set([0,1,2,3]),arch:true,col:lin('#fde7ee')});
  cap(ch.roof,pod,14.6,lin('#ffd6e2'));icing(ch.icing,pod,14.6,lin('#ffc9dc'),W.rng,.9);
  // shaft: lofted rounded square, twisting 50 degrees and tapering
  const y0=14.6,y1=172,fh=3.9,rings=Math.round((y1-y0)/fh),seg=6;
  const profile=(t)=>{ // returns [[x,z,nx,nz,u]] for a ring at height fraction t
    const hs=13.5-5*t,r=3+3.5*t,tw=t*0.87,pts=[];
    const c=Math.cos(tw),s=Math.sin(tw);
    const E=outline(-hs,-hs,hs,hs,'round',r,6);
    let u=0;const cellsSide=8,cellsCorner=2;
    for(const e of E){
      const n=e.face>=0?cellsSide:cellsCorner;let len=0;const cum=[0];
      for(let i=1;i<e.pts.length;i++){len+=Math.hypot(e.pts[i][0]-e.pts[i-1][0],e.pts[i][1]-e.pts[i-1][1]);cum.push(len);}
      for(let i=0;i<e.pts.length;i++){
        if(i===0&&pts.length)continue;
        const [x,z]=e.pts[i],[nx,nz]=e.nrm[i];
        pts.push([x*c-z*s,x*s+z*c,nx*c-nz*s,nx*s+nz*c,u+n*cum[i]/len]);
      }
      u+=n;
    }
    return pts;
  };
  {
    const base=fb.count;let P=0;
    for(let r=0;r<=rings;r++){
      const t=r/rings,y=y0+(y1-y0)*t,pts=profile(t);P=pts.length;
      const hsT=(13.5-5*t);fb.set('aWin',[hsT*2/8,fh,.9,.9]).set('aFac',[31.3,1,y0,0]);
      for(const p of pts){fb.set('fuv',[p[4],y]);fb.v([p[0],y,p[1]],[p[2],.03,p[3]],[0,0],GLASS);}
    }
    for(let r=0;r<rings;r++)for(let i=0;i<P-1;i++){const a=base+r*P+i,b=a+1,c=a+P+1,d=a+P;fb.idx.push(a,b,c,a,c,d);}
    // floor bands every 6 floors (frosted white rings)
    for(let r=6;r<rings;r+=6){
      const t=r/rings,y=y0+(y1-y0)*t,pts=profile(t);
      const g=new GB();
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],b=pts[i+1],o=.45;
        g.quad([a[0]+a[2]*o,y-.25,a[1]+a[3]*o],[b[0]+b[2]*o,y-.25,b[1]+b[3]*o],[b[0]+b[2]*o,y+.25,b[1]+b[3]*o],[a[0]+a[2]*o,y+.25,a[1]+a[3]*o],[a[2],0,a[3]],[[0,0],[1,0],[1,1],[0,1]],WHITE);
        g.quad([a[0],y+.25,a[1]],[a[0]+a[2]*o,y+.25,a[1]+a[3]*o],[b[0]+b[2]*o,y+.25,b[1]+b[3]*o],[b[0],y+.25,b[1]],[0,1,0],[[0,0],[1,0],[1,1],[0,1]],WHITE);
      }
      const gg=g.geometry();ch.trim.add(gg,null,WHITE);gg.dispose();
    }
  }
  // crown: observation deck + three glowing frosting rings + spire
  const yc=y1;
  const deck=outline(-11,-11,11,11,'round',8);
  const rot=new THREE.Matrix4().makeRotationY(.87);
  const deckG=new GB({fuv:[0,0],aWin:[3,4,.9,.9],aFac:[55.5,1,0,0]});
  walls(deckG,deck,yc,yc+8,{cell:2.4,fh:4,ww:.9,wh:.9,seed:55.5,kind:1,gH:yc,shop:false,shopFaces:new Set(),col:lin('#ffd0e0')});
  const dg=deckG.geometry();dg.applyMatrix4(rot);
  // merge into facade buffer preserving attributes
  {const base=fb.count,p=dg.attributes.position,n=dg.attributes.normal;
   for(let i=0;i<p.count;i++){fb.set('fuv',[dg.attributes.fuv.getX(i),dg.attributes.fuv.getY(i)]).set('aWin',[dg.attributes.aWin.getX(i),4,.9,.9]).set('aFac',[55.5,1,yc,0]);
     fb.v([p.getX(i),p.getY(i),p.getZ(i)],[n.getX(i),n.getY(i),n.getZ(i)],[0,0],lin('#ffd0e0'));}
   const ix=dg.index.array;for(let i=0;i<ix.length;i++)fb.idx.push(base+ix[i]);}
  const deckTop=new GB();cap(deckTop,deck,yc+8,WHITE);icing(deckTop,deck,yc+8,PINK,W.rng,.6);
  const dt=deckTop.geometry();dt.applyMatrix4(rot);ch.icing.add(dt,null,null);
  // floor plate under the deck overhang
  const under=new GB();cap(under,deck,yc,WHITE);const ug=under.geometry();ug.applyMatrix4(rot);ch.trim.add(ug,null,null);
  // glowing rings (emissive at night)
  const crown=new GB();
  let y=yc+8.4,R=9.5;
  for(let k=0;k<3;k++){
    const tube=R*.3;y+=tube;
    const t=new THREE.TorusGeometry(R,tube,12,48);t.rotateX(-Math.PI/2);
    crown.add(t,M(0,y,0,1,1.2,1),k%2?WHITE:PINK);t.dispose();
    const band=new THREE.TorusGeometry(R+tube*.98,.16,4,64);band.rotateX(-Math.PI/2);
    W.crownGlow.add(band,M(0,y,0),lin(k%2?'#7fe3ff':'#ff7fb6'));band.dispose();
    y+=tube*.55;R*=.68;
  }
  const crownG=crown.geometry();ch.icing.add(crownG,null,null);
  const top=spire(ch.candy,0,0,y,2.6,38,lin('#ff5d8f'),WHITE);
  const ball=new THREE.SphereGeometry(1.6,16,12);W.crownGlow.add(ball,M(0,top+1.2,0),lin('#fff1f8'));ball.dispose();
  W.beacons.push([0,top+3.2,0]);
  W.glow.push([0,top+1.2,0,1,.6,.8,40,2]);
  W.buildings.push({x0:-17,z0:-17,x1:17,z1:17,h:top,col:lin('#ffd0e0'),landmark:true});
  W.landmarkTop=top;
}
