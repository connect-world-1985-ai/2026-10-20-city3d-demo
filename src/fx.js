import * as THREE from 'three';
import {GB,lin,hook} from './util.js';
import {RIVER_Z0,RIVER_Z1} from './layout.js';
import * as T from './textures.js';

export function buildFx(W){
  const {root,U}=W;
  /* rooftop billboards */
  if(W.billboards.length){
    const g=new GB(),fr=new GB(),bill=T.makeBillboards(W.aniso);
    for(const b of W.billboards){
      const w=b.w,h=w/4,y0=b.y+2.4,ax=b.axis;
      const v0=b.k?0:.5,v1=v0+.5;
      const P=(u,y,s)=>ax===0?[b.x+u,y,b.z+s]:[b.x+s,y,b.z+u];
      for(const s of [-1,1]){
        const o=s*.12,a=P(-w/2*s,y0,o),bb=P(w/2*s,y0,o),c=P(w/2*s,y0+h,o),d=P(-w/2*s,y0+h,o),nn=ax===0?[0,0,s]:[s,0,0];
        g.quad(a,bb,c,d,nn,[[0,v0],[1,v0],[1,v1],[0,v1]],[1,1,1]);
      }
      const x0=ax===0?b.x-w/2:b.x-.1,x1=ax===0?b.x+w/2:b.x+.1,z0=ax===0?b.z-.1:b.z-w/2,z1=ax===0?b.z+.1:b.z+w/2;
      fr.box(x0-.15,y0-.2,z0,x1+.15,y0,z1,lin('#fffaf4'));fr.box(x0-.15,y0+h,z0,x1+.15,y0+h+.2,z1,lin('#fffaf4'));
      for(const t of [-.35,.35]){const px=ax===0?b.x+w*t:b.x,pz=ax===0?b.z:b.z+w*t;fr.box(px-.12,b.y,pz-.12,px+.12,y0,pz+.12,lin('#d8d0d8'));}
      for(let k=0;k<5;k++){const t=(k/4-.5)*w*.9;const [px,,pz]=P(t,0,.9);W.glow.push([px,y0-.1,pz,1,.92,.75,3,2]);}
    }
    const bmat=new THREE.MeshStandardMaterial({map:bill,emissiveMap:bill,emissive:0xffffff,emissiveIntensity:.3,roughness:.5});W.mats.billboard=bmat;
    const m=new THREE.Mesh(g.geometry(),bmat);root.add(m);
    const fm=new THREE.Mesh(fr.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5}));fm.castShadow=true;root.add(fm);
  }

  /* glow sprites. kind 0 street lamps, 1 beacons (blink), 2 night decor */
  for(const b of W.beacons)W.glow.push([b[0],b[1],b[2],1,.12,.16,10,1]);
  const G=W.glow,n=G.length,pos=new Float32Array(n*3),col=new Float32Array(n*3),sz=new Float32Array(n*2);
  G.forEach((g,i)=>{pos.set([g[0],g[1],g[2]],i*3);col.set([g[3],g[4],g[5]],i*3);sz[i*2]=g[6];sz[i*2+1]=g[7];});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setAttribute('sk',new THREE.BufferAttribute(sz,2));
  geo.computeBoundingSphere();
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
    uniforms:{map:{value:T.makeGlow()},uLamp:U.uLamp,uNight:U.uNight,uTime:U.uTime,uScale:U.uPointScale},
    vertexShader:`attribute vec2 sk;attribute vec3 color;varying vec3 vC;varying float vA;uniform float uScale,uLamp,uNight,uTime;
      void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);float d=-mv.z;
        float k=sk.y,I=k<.5?uLamp:k<1.5?(.25+uNight*.9)*(sin(uTime*3.2+position.x*.01)>.25?1.:.06):uNight;
        gl_PointSize=clamp(sk.x*uScale/max(d,.1),1.,72.);vA=I*smoothstep(4.,30.,d)*(1.2-.6*smoothstep(80.,600.,d));
        gl_Position=projectionMatrix*mv;if(I<.005)gl_Position.w=-1.;}`,
    fragmentShader:`uniform sampler2D map;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC*t.rgb*t.a*vA,1.);}`});
  const pts=new THREE.Points(geo,mat);pts.renderOrder=3;pts.userData.noAO=true;root.add(pts);
  // beacon bulbs
  const bm=new THREE.MeshBasicMaterial({color:0xff2a3a});W.mats.beacon=bm;
  const beacons=new THREE.InstancedMesh(new THREE.SphereGeometry(.55,8,6),bm,W.beacons.length);
  W.beacons.forEach((b,i)=>beacons.setMatrixAt(i,new THREE.Matrix4().makeTranslation(b[0],b[1],b[2])));beacons.frustumCulled=false;root.add(beacons);
  // emissive crown details of the landmark
  const crown=new THREE.Mesh(W.crownGlow.geometry(),new THREE.MeshBasicMaterial({vertexColors:true}));W.mats.crown=crown.material;root.add(crown);

  /* fireworks over the river */
  {
    const NB=9,PB=320,N2=NB*PB,p=new Float32Array(N2*3),a=new Float32Array(N2*4),b=new Float32Array(N2*4);
    let r=1;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647;};
    for(let k=0;k<NB;k++)for(let i=0;i<PB;i++){
      const j=k*PB+i;const u=rnd()*2-1,th=rnd()*Math.PI*2,s=Math.sqrt(1-u*u);
      p[j*3]=s*Math.cos(th);p[j*3+1]=u;p[j*3+2]=s*Math.sin(th);
      a[j*4]=k;a[j*4+1]=.75+rnd()*.35;a[j*4+2]=rnd();a[j*4+3]=i<PB*.15?1:0;
      b[j*4]=5.2+k*.37;b[j*4+1]=k*1.37;b[j*4+2]=rnd();b[j*4+3]=0;
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('fa',new THREE.BufferAttribute(a,4));g.setAttribute('fb',new THREE.BufferAttribute(b,4));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
      uniforms:{uTime:U.uTime,uNight:U.uNight,uScale:U.uPointScale,uZ:{value:new THREE.Vector2(RIVER_Z0,RIVER_Z1)}},
      vertexShader:`attribute vec4 fa,fb;uniform float uTime,uNight,uScale;uniform vec2 uZ;varying vec3 vC;varying float vA;
        float h(float n){return fract(sin(n)*43758.5453);}
        vec3 hue(float x){return clamp(abs(mod(x*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
        void main(){
          float T=fb.x,t=mod(uTime+fb.y,T),cyc=floor((uTime+fb.y)/T)+fa.x*17.;
          vec3 c=vec3((h(cyc*1.3)-.5)*700.,140.+h(cyc*2.1)*110.,mix(uZ.x+40.,uZ.y-30.,h(cyc*3.7)));
          float R=(34.+h(cyc*5.1)*26.)*fa.y;
          vec3 pos;float alpha;
          if(t<1.4){ // rocket rising
            float k=t/1.4;pos=vec3(c.x,mix(-2.,c.y,1.-pow(1.-k,2.)),c.z)+position*.4;alpha=fa.w*(1.-k*.3);vC=vec3(1.,.85,.6);
          }else{
            float e=t-1.4;pos=c+position*R*(1.-exp(-e*2.4))-vec3(0.,4.*e*e,0.);
            alpha=pow(max(0.,1.-e/2.8),1.5)*(.6+.4*sin(e*30.+fa.z*40.));
            vec3 hc=hue(h(cyc*7.9));vC=mix(vec3(1.),mix(hc,vec3(1.,.6,.85),step(.6,fa.z)),smoothstep(0.,.5,e));
          }
          vA=alpha*smoothstep(.55,.85,uNight);
          vec4 mv=modelViewMatrix*vec4(pos,1.);gl_PointSize=clamp(4.2*uScale/-mv.z,1.5,36.);gl_Position=projectionMatrix*mv;if(vA<.003)gl_Position.w=-1.;}`,
      fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float d=max(0.,1.-length(q)*2.);gl_FragColor=vec4(vC*d*d*vA*4.,1.);}`});
    const fw=new THREE.Points(g,m);fw.frustumCulled=false;fw.userData.noAO=true;fw.renderOrder=4;root.add(fw);
    W.fireworks=fw;
  }
  /* birds: small flocks circling during the day (wings flap in the vertex shader) */
  {
    const g=new THREE.BufferGeometry();
    const P=[0,0,.35, -.9,.05,-.1, 0,0,-.25,  0,0,.35, 0,0,-.25, .9,.05,-.1];
    g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();
    const flocks=[[60,95,470,70],[-150,60,-150,45],[210,80,-120,55],[-260,110,420,90]];
    const birds=[];let r=7;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647;};
    flocks.forEach(([x,y,z,R],f)=>{for(let k=0;k<14;k++)birds.push({x,y:y+rnd()*14,z,R:R*(.75+rnd()*.5),a:rnd()*6.28,sp:(.13+rnd()*.05)*(f%2?1:-1),ph:rnd()*6});});
    const mat=new THREE.MeshBasicMaterial({color:0x5a4a5e,side:THREE.DoubleSide});
    hook(mat,'birds',sh=>{sh.uniforms.uTime=U.uTime;
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\n{float ph=instanceMatrix[3].x*.37+instanceMatrix[3].z*.21;transformed.y+=abs(transformed.x)*sin(uTime*11.+ph)*.9;}');});
    const im=new THREE.InstancedMesh(g,mat,birds.length);im.frustumCulled=false;im.userData.noAO=true;root.add(im);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3(1.4,1.4,1.4),Y=new THREE.Vector3(0,1,0);
    W.updaters.push((dt,t)=>{
      im.visible=U.uNight.value<.6;if(!im.visible)return;
      birds.forEach((b,i)=>{b.a+=b.sp*dt;const x=b.x+Math.cos(b.a)*b.R,z=b.z+Math.sin(b.a)*b.R*.8;
        q.setFromAxisAngle(Y,-b.a-(b.sp>0?0:Math.PI));m.compose(p.set(x,b.y+Math.sin(t*.7+b.ph)*3,z),q,sc);im.setMatrixAt(i,m);});
      im.instanceMatrix.needsUpdate=true;});
  }
  return {beacons};
}
