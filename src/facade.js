import * as THREE from 'three';
import {GLSL_HASH,hook} from './util.js';

/* Procedural facade material.
   Per-vertex attributes written by the building generator:
     fuv  = (u in window cells along the perimeter, v = height in metres)
     aWin = (cell width m, floor height m, window width frac, window height frac)
     aFac = (seed, kind, ground floor height, flags)  flags: +1 shopfront, +2 arched windows
   kind: 0 punched, 1 curtain wall, 2 ribbon, 3 chocolate panels, 4 house (shutters + flower boxes)
   Windows show an interior-mapped room (parallax box: walls, floor, ceiling lamp,
   furniture, curtains); lights switch on per window as uLit rises. */
export function makeFacadeMaterial(U){
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:0,envMapIntensity:1});
  return hook(mat,'facade',s=>{
    Object.assign(s.uniforms,{uTime:U.uTime,uLit:U.uLit,uDayIn:U.uDayIn,uNight:U.uNight});
    s.vertexShader=s.vertexShader
      .replace('#include <common>',`#include <common>
attribute vec2 fuv;attribute vec4 aWin;attribute vec4 aFac;
varying vec2 vFuv;flat varying vec4 vWin;flat varying vec4 vFac;varying vec3 vWP;varying vec3 vWN;`)
      .replace('#include <project_vertex>',`#include <project_vertex>
vFuv=fuv;vWin=aWin;vFac=aFac;vWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);`);
    s.fragmentShader=s.fragmentShader
      .replace('#include <common>',`#include <common>
uniform float uTime,uLit,uDayIn,uNight;
varying vec2 vFuv;flat varying vec4 vWin;flat varying vec4 vFac;varying vec3 vWP;varying vec3 vWN;
${GLSL_HASH}
float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
vec2 gBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return q.x>q.y?vec2(sign(p.x),0.):vec2(0.,sign(p.y));}
float sdArch(vec2 p,vec2 b){ // box whose top is a half circle
  float r=b.x;vec2 q=p-vec2(0.,b.y-r);
  float d=sdBox(p-vec2(0.,-r*.5),vec2(b.x,b.y-r*.5));
  return q.y>0.?max(length(q)-r,-b.y-p.y):d;}
float gSimp=0.;
vec3 pastel(float h){return .62+.33*cos(6.2831*(h+vec3(0.,.33,.67)));}
vec3 lightCol(float h){
  if(h<.62)return mix(vec3(1.,.74,.45),vec3(1.,.86,.66),h/.62);
  if(h<.8)return vec3(1.,.68,.78);
  if(h<.92)return vec3(.78,.86,1.);
  return vec3(.85,.7,1.);}
// interior mapped room; lp = point on window plane (m), room = (w,h), rd = ray in room space (z into the room)
vec3 room(vec2 lp,vec2 rm,float depth,vec3 rd,float h,float lit,vec3 lc,float shop){
  vec3 o=vec3(lp,0.);rd.z=max(rd.z,.05);rd.x=abs(rd.x)<1e-3?1e-3:rd.x;rd.y=abs(rd.y)<1e-3?1e-3:rd.y;vec3 inv=1./rd;
  float tx=rd.x>0.?(rm.x-o.x)*inv.x:-o.x*inv.x;
  float ty=rd.y>0.?(rm.y-o.y)*inv.y:-o.y*inv.y;
  float tz=depth*inv.z;float t=min(min(tx,ty),tz);vec3 p=o+rd*t;
  vec3 wc=mix(pastel(h),vec3(.97,.93,.88),.45);vec3 c;float sh;
  if(t==tz){
    c=wc;sh=.9;
    if(shop>.5&&gSimp<.5){
      float row=fract(p.y/.5),rid=floor(p.y/.5);vec2 id=vec2(floor(p.x/.24),rid);
      vec3 cand=pastel(hash21(id+h*13.))*1.08;
      bool shelf=p.y>.5&&p.y<rm.y-.4;
      c=shelf?(row<.16?vec3(.96,.9,.86):(hash21(id*1.3+h)>.15?cand:wc)):wc;
    }else if(gSimp<.5){
      vec2 q=p.xy-vec2(rm.x*(.3+.4*hash11(h*7.)),rm.y*.58);
      if(abs(q.x)<.42&&abs(q.y)<.3&&hash11(h*3.1)>.35)c=mix(vec3(.3,.45,.7),vec3(1.,.75,.6),hash11(h*9.)+q.y);
    }
  }else if(t==ty){
    if(rd.y>0.){c=vec3(.96,.95,.93);sh=1.;}
    else{c=shop>.5?vec3(.93,.86,.86)*(.9+.1*step(.5,fract(p.x*1.25+floor(p.z*1.25)*.5))):mix(vec3(.6,.4,.28),vec3(.82,.62,.46),hash11(h*5.))*(.88+.12*step(.5,fract(p.x*1.6)));sh=.75;}
  }else{c=wc*.92;sh=.78;}
  if(shop<.5&&gSimp<.5&&hash11(h*11.)>.3){ // furniture block in front of the back wall
    vec3 bmin=vec3(rm.x*.16,0.,depth-1.2),bmax=vec3(rm.x*(.55+.3*hash11(h*17.)),.9,depth-.05);
    vec3 t0=(bmin-o)*inv,t1=(bmax-o)*inv,tn3=min(t0,t1),tf3=max(t0,t1);
    float tn=max(max(tn3.x,tn3.y),tn3.z),tf=min(min(tf3.x,tf3.y),tf3.z);
    if(tn<tf&&tn>0.&&tn<t){t=tn;p=o+rd*t;c=mix(vec3(.95,.55,.65),vec3(.55,.7,.95),hash11(h*13.));sh=tn3.y>=max(tn3.x,tn3.z)?1.:.7;}
  }
  vec3 lp3=vec3(rm.x*.5,rm.y-.15,depth*.45);vec3 dd=p-lp3;
  float fall=1./(1.+.22*dot(dd,dd));
  vec3 L=lit*lc*(.3+1.5*fall)*(1.+uNight*.6);
  vec3 D=vec3(uDayIn)*(1.15-.55*clamp(p.z/depth,0.,1.))*vec3(1.,.98,.96);
  if(rd.y>0.&&t==ty){float spot=exp(-dot(p.xz-lp3.xz,p.xz-lp3.xz)*1.6);L+=lit*lc*spot*2.5;}
  return c*sh*(L+D);
}`)
      .replace('#include <color_fragment>',`
vec3 fEmis=vec3(0.);float fRough=.85,fMetal=0.;vec2 fBump=vec2(0.);
vec3 fN=normalize(vWN);vec3 fT=normalize(cross(vec3(0.,1.,0.),fN));if(length(cross(vec3(0.,1.,0.),fN))<.01)fT=vec3(1.,0.,0.);
{
  vec3 V=normalize(vWP-cameraPosition);
  vec3 rd=vec3(dot(V,fT),V.y,-dot(V,fN));
  float seed=vFac.x,kind=floor(vFac.y+.5),gH=vFac.z;
  float shopF=mod(vFac.w,2.),arch=mod(floor(vFac.w*.5),2.);
  float cw=vWin.x,fh=vWin.y;
  vec3 wall=vColor;
  float bh=hash11(seed*3.7);
  vec3 trim=mix(vec3(1.,.97,.93),pastel(bh)*1.1,step(.6,bh));
  wall*=.95+.07*vnoise(vWP.xz*.35+vWP.y*.12);
  wall*=mix(.8,1.,smoothstep(0.,2.5,vFuv.y));
  vec3 col=wall;float glass=0.;vec3 gcol=vec3(0.);float gVis=1.;
  float Fr=.04+.96*pow(1.-abs(dot(V,fN)),5.);
  float fwu=max(fwidth(vFuv.x),fwidth(vFuv.y)/fh);gSimp=step(.045,fwu);
  if(shopF>.5&&vFuv.y<gH){
    // shopfront: 2 cells per shop
    float su=vFuv.x*.5;float sid=floor(su);float sw=cw*2.;vec2 l=vec2(fract(su)*sw,vFuv.y);
    float h=hash21(vec2(sid,fract(seed*.73)*61.));
    vec3 acc=pastel(h)*.95;
    col=acc;fRough=.5;
    float door=step(h,.45);
    vec2 wc=vec2(sw*.5,(.45+gH-1.3)*.5),wb=vec2(sw*.5-.28,(gH-1.3-.45)*.5);
    float dW=sdBox(l-wc,wb);
    float dD=sdBox(l-vec2(sw*.5,1.25),vec2(.62,1.25));
    if(door>.5)dW=max(dW,-(dD-.08));
    if(l.y>gH-1.25){col=mix(acc,vec3(1.),.35);fBump.y=l.y>gH-.1?.6:0.;}
    else if(dW<0.){glass=1.;vec2 lp=l-(wc-wb);
      gcol=room(lp,wb*2.,7.,rd,fract(h*41.),1.,lightCol(h*.7),1.)*mix(1.,1.35,uNight);}
    else if(door>.5&&dD<0.){glass=1.;gcol=room(l-vec2(sw*.5-.62,0.),vec2(1.24,2.5),7.,rd,fract(h*41.),1.,lightCol(h*.7),1.)*mix(.9,1.25,uNight);}
    else if(dW<.09||(door>.5&&dD<.08)){col=vec3(.98,.96,.94);fBump=-gBox(l-wc,wb)*.5;fRough=.4;}
    if(l.y<.45&&dW>0.)col=acc*.75;
  }else{
    float y=vFuv.y-gH;float rw=floor(y/fh);float fy=fract(y/fh);
    float cu=floor(vFuv.x),fx=fract(vFuv.x);
    vec2 l=vec2(fx*cw,fy*fh);vec2 cid=vec2(cu,rw);
    float h=hash21(cid+fract(seed*.1731)*97.),h2=hash21(cid*1.37+fract(seed*.33)*53.+11.);
    float litP=uLit*(.42+.45*bh);
    float lit=step(h,litP);
    vec3 lc=lightCol(h2);
    if(h2>.955&&lit>.5)lc=vec3(.45,.6,1.)*(.75+.25*sin(uTime*9.+h*60.)*sin(uTime*3.3+h2*20.));
    vec2 ws=vec2(cw*vWin.z,fh*vWin.w);
    if(kind<.5||kind>3.5){
      vec2 c=vec2(cw*.5,fh*.2+ws.y*.5);vec2 b=ws*.5;
      float d=arch>.5?sdArch(l-c,b):sdBox(l-c,b);
      float sill=sdBox(l-vec2(c.x,c.y-b.y-.08),vec2(b.x+.16,.08));
      if(d<0.){glass=1.;
        float mull=abs(l.x-c.x)<.035&&kind<.5?1.:0.;
        if(mull>.5){glass=0.;col=trim;}
        else gcol=room(l-(c-b),b*2.,4.5,rd,fract(h*7.13+seed*.0137),lit,lc,0.);
        // curtains / blinds
        float ch=hash11(h*23.+fract(seed*.37));vec2 q=l-(c-b);
        if(glass>.5&&gSimp<.5&&ch>.55){float cwid=b.x*2.*(.14+.12*ch);if(q.x<cwid||q.x>b.x*2.-cwid){vec3 fab=pastel(ch*3.)*.95;gcol=fab*(lit*lc*.9+vec3(uDayIn*1.5));gVis=1.;}}
        else if(glass>.5&&gSimp<.5&&ch<.18){if(q.y>b.y*2.*(.55+ch)&&fract(q.y*9.)<.75){gcol=vec3(.95,.92,.88)*(lit*lc*.8+vec3(uDayIn*1.4));}}
      }else if(d<.11){col=trim;fRough=.5;fBump=-gBox(l-c,b)*.45;}
      else if(sill<0.){col=trim*1.02;fBump.y=.5;}
      if(kind>3.5&&glass<.5){ // shutters + flower boxes
        float sw2=b.x*.62;
        vec2 sl=vec2(abs(l.x-c.x)-(b.x+.14+sw2*.5),l.y-c.y);
        if(arch<.5&&sl.x<sw2*.5&&sl.x>-sw2*.5&&abs(sl.y)<b.y){col=pastel(bh*5.+.3)*.92*(.9+.1*step(.5,fract(l.y*6.)));fRough=.6;}
        vec2 fb=l-vec2(c.x,c.y-b.y-.32);
        if(hash11(h*5.+fract(seed*.37))>.45&&abs(fb.x)<b.x+.05&&abs(fb.y)<.22){
          vec2 fl=floor(vec2(fb.x*6.,fb.y*6.));float fh2=hash21(fl+seed);
          col=fb.y<-.05?vec3(.75,.48,.35):(fh2>.55?pastel(fh2*7.)*1.15:vec3(.35,.68,.32));fBump.y=.3;}
      }
    }else if(kind<1.5){ // curtain wall
      float mul=min(l.x,cw-l.x);float span=l.y;
      if(span<.7){col=wall*.82;fRough=.35;fMetal=.3;}
      else if(mul<.06){col=trim*.95;fRough=.3;fMetal=.4;}
      else{glass=1.;gcol=room(l-vec2(.06,.7),vec2(cw-.12,fh-.7),5.,rd,fract(h*7.13+seed*.0137),lit,lc,0.);gVis=.55;}
      if(span>fh-.08)col=trim;
    }else if(kind<2.5){ // ribbon
      if(l.y>.95&&l.y<fh-.3&&min(l.x,cw-l.x)>.04){glass=1.;gcol=room(l-vec2(0.,.95),vec2(cw,fh-1.25),5.,rd,fract(h*7.13+seed*.0137),lit,lc,0.);gVis=.8;}
      else if(l.y<.95&&l.y>.8){col=trim;fBump.y=.5;}
    }else{ // chocolate panels
      float e=min(min(l.x,cw-l.x),min(l.y,fh-l.y));
      col=wall*(1.05-.25*smoothstep(.3,.0,e));
      if(e<.25){vec2 g=vec2(l.x<cw*.5?-1.:1.,l.y<fh*.5?-1.:1.);vec2 dd=vec2(min(l.x,cw-l.x),min(l.y,fh-l.y));fBump=dd.x<dd.y?vec2(g.x,0.)*.55:vec2(0.,g.y)*.55;}
      if(e<.05)col*=.55;
      vec2 c=vec2(cw*.5,fh*.52);vec2 b=vec2(cw*vWin.z*.5,fh*vWin.w*.5);
      float d=sdArch(l-c,b);
      if(d<0.){glass=1.;gcol=room(l-(c-b),b*2.,4.,rd,fract(h*7.13+seed*.0137),lit,lc,0.);}
      else if(d<.1){col=vec3(.96,.9,.8);fBump=-gBox(l-c,b)*.4;}
      fRough=.45;
    }
  }
  if(glass>.5){
    diffuseColor.rgb=kind>.5&&kind<1.5?wall*.45:vec3(.02,.025,.03);
    fRough=.06;fMetal=kind>.5&&kind<1.5?.3:0.;
    fEmis=gcol*(1.-Fr)*gVis;
  }else{
    diffuseColor.rgb=col;
    fEmis=col*uNight*.07*exp(-vFuv.y/7.)*vec3(1.,.82,.65);
  }
  // distance fade: when window cells approach pixel size, blend to their average
  float lodF=smoothstep(.25,.6,fwu);
  if(lodF>0.){
    float gf=kind>.5&&kind<1.5?.7:kind>1.5&&kind<2.5?.5:vWin.z*vWin.w*.85;
    vec3 avgE=gf*(uLit*(.42+.45*bh)*vec3(1.,.78,.58)*.5+vec3(uDayIn)*.4*mix(wall,vec3(1.),.5))*(1.-Fr);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(wall,vec3(.06),gf),lodF);fEmis=mix(fEmis,avgE,lodF);
    fRough=mix(fRough,.4,lodF);fMetal=mix(fMetal,0.,lodF);fBump*=1.-lodF;
  }
}`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=fRough;')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=fMetal;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
{vec3 Tv=normalize((viewMatrix*vec4(fT,0.)).xyz);vec3 Bv=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);normal=normalize(normal+Tv*fBump.x+Bv*fBump.y);}`)
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=fEmis;');
  });
}
