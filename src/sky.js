import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {GB,lin,mulberry32} from './util.js';

const vert=`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=p.xyww;}`;
const frag=`
varying vec3 vDir;
uniform vec3 zen,mid,hor,sunDir,moonDir,discCol,cloudLit,cloudDark;
uniform float discAmt,glowAmt,horGlow,stars,cloudAmt,time,discSize,moon;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec3 d=normalize(vDir);float h=d.y;
  vec3 col=mix(hor,mid,smoothstep(0.0,0.25,h));
  col=mix(col,zen,smoothstep(0.15,0.9,h));
  col=mix(col,hor*0.7,smoothstep(0.0,-0.25,h));
  float s=max(dot(d,sunDir),0.);
  col+=discCol*exp(-abs(h)*5.0)*pow(s,3.0)*horGlow;
  col+=discCol*(pow(s,7.0)*0.3+pow(s,70.0)*0.8)*glowAmt;
  float disc=smoothstep(cos(discSize),cos(discSize*0.8),dot(d,sunDir));
  col+=discCol*disc*discAmt*step(-0.02,h);
  if(stars>0.001&&h>0.0){
    vec3 q=d*170.;vec3 id=floor(q);vec3 f=fract(q);
    vec3 sp=vec3(hash(id.xy+id.z),hash(id.yz+id.x+3.1),hash(id.zx+id.y+7.7));
    float dd=length(f-sp);float on=step(0.972,hash(id.xz*1.7+id.y));
    float tw=0.6+0.4*sin(time*2.+hash(id.xy)*40.);
    vec3 sc=mix(vec3(1.,.8,.9),vec3(.8,.9,1.),hash(id.yx));
    col+=sc*on*smoothstep(0.15,0.0,dd)*tw*stars*3.0*smoothstep(0.0,0.25,h);
  }
  if(moon>0.001){
    float m=dot(d,moonDir);float md=smoothstep(cos(.034),cos(.03),m);
    vec2 mp=vec2(dot(d,normalize(cross(moonDir,vec3(0,1,0)))),d.y-moonDir.y)*40.;
    float crater=.85+.15*noise(mp*3.);
    col+=vec3(1.,.96,.92)*md*crater*2.2*moon+vec3(.6,.6,.9)*pow(max(m,0.),300.)*.5*moon+vec3(.5,.45,.8)*pow(max(m,0.),12.)*.06*moon;
  }
  if(h>0.005){
    vec2 uv=d.xz/(h+0.16)*1.1+vec2(time*0.004,time*0.0015);
    float c=fbm(uv*vec2(1.,2.2));float m=smoothstep(0.52,0.85,c)*cloudAmt*smoothstep(0.005,0.2,h)*.7;
    float lit=clamp(pow(s,1.4)*1.3+0.25,0.,1.);
    col=mix(col,mix(cloudDark,cloudLit,lit),m);
  }
  gl_FragColor=vec4(col,1.);
}`;
export function makeSky(){
  const U=()=>({value:new THREE.Color()});
  const mat=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
    uniforms:{zen:U(),mid:U(),hor:U(),sunDir:{value:new THREE.Vector3(0,1,0)},moonDir:{value:new THREE.Vector3(0,1,0)},discCol:U(),cloudLit:U(),cloudDark:U(),
      discAmt:{value:1},glowAmt:{value:1},horGlow:{value:1},stars:{value:0},cloudAmt:{value:.5},time:{value:0},discSize:{value:.04},moon:{value:0}}});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(10,32,16),mat);
  mesh.frustumCulled=false;mesh.renderOrder=-10;mesh.userData.noAO=true;
  return mesh;
}
export function applySky(u,s,sunDir,moonDir,time){
  for(const k of ['zen','mid','hor','discCol','cloudLit','cloudDark'])u[k].value.copy(s[k]);
  for(const k of ['discAmt','glowAmt','horGlow','stars','cloudAmt','moon'])u[k].value=s[k];
  u.sunDir.value.copy(sunDir);u.moonDir.value.copy(moonDir);if(time!==undefined)u.time.value=time;
}

/* 3D cotton-candy clouds + hot-air balloons */
export function makeClouds(U,fog){
  const rng=mulberry32(808),geos=[];
  for(let c=0;c<34;c++){
    const a=rng()*Math.PI*2,r=750+rng()*1100,cx=Math.cos(a)*r,cz=Math.sin(a)*r,cy=230+rng()*260,sc=30+rng()*45;
    const n=6+((rng()*8)|0);
    for(let k=0;k<n;k++){
      const g=new THREE.IcosahedronGeometry(sc*(.45+rng()*.55),2);
      const t=(k/(n-1)-.5)*2;g.scale(1,.72,1);
      g.translate(cx+t*sc*1.5+(rng()-.5)*sc*.4,cy+(1-t*t)*sc*.45+(rng()-.5)*sc*.2,cz+(rng()-.5)*sc*.9);
      geos.push(g);
    }
  }
  const geo=mergeGeometries(geos);
  const mat=new THREE.ShaderMaterial({uniforms:{uLit:{value:new THREE.Color()},uDark:{value:new THREE.Color()},uSun:{value:new THREE.Vector3()},uPink:{value:new THREE.Color('#ffd1e6')},fogColor:{value:fog.color},fogDensity:{value:fog.density}},
    vertexShader:`varying vec3 vN,vW;void main(){vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform vec3 uLit,uDark,uSun,uPink,fogColor;uniform float fogDensity;varying vec3 vN,vW;
      void main(){vec3 n=normalize(vN);vec3 V=normalize(cameraPosition-vW);
        float l=dot(n,uSun)*.5+.5;vec3 c=mix(uDark,uLit,smoothstep(.15,1.,l));
        c=mix(c,c*uPink*1.1,smoothstep(.2,-.6,n.y)*.5);
        c+=uLit*pow(1.-max(dot(n,V),0.),2.5)*.35*smoothstep(-.1,.3,uSun.y+.2);
        float d=length(vW-cameraPosition);float f=1.-exp(-pow(fogDensity*d*.42,2.));
        gl_FragColor=vec4(mix(c,fogColor,f),1.);}`});
  const clouds=new THREE.Mesh(geo,mat);clouds.userData.noAO=true;clouds.frustumCulled=false;
  // balloons
  const bal=new THREE.Group();
  const cols=[['#ff6f9c','#fffaf4'],['#7fd6ff','#fff3a8'],['#b78bff','#fffaf4'],['#ffb84d','#ff6f9c'],['#7bdc5a','#fffaf4'],['#ff7a5c','#ffe14d']];
  const list=[];
  cols.forEach((cc,k)=>{
    const pts=[];for(let i=0;i<=20;i++){const t=i/20,y=-1+t*2.3;const r=Math.sin(Math.min(1,t*1.15)*Math.PI*.92+.12)*(t<.2?.55+t*2:1);pts.push(new THREE.Vector2(Math.max(.05,r)*5,y*5));}
    const env=new THREE.LatheGeometry(pts,24);const g=new GB();
    const c1=lin(cc[0]),c2=lin(cc[1]);
    g.add(env,null,(v)=>Math.floor((Math.atan2(v.z,v.x)+Math.PI)/(Math.PI*2)*12)%2?c1:c2);
    g.box(-1,-9.2,-1,1,-7.8,1,lin('#b07a56'),true);
    for(const [x,z] of [[-.9,-.9],[.9,-.9],[.9,.9],[-.9,.9]])g.box(x-.04,-7.8,z-.04,x+.04,-4.6,z+.04,lin('#7a5a46'));
    const m=new THREE.Mesh(g.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.45,side:THREE.DoubleSide}));
    m.castShadow=true;bal.add(m);
    list.push({m,a:k/cols.length*Math.PI*2+rng(),r:220+rng()*260,y:110+rng()*120,sp:.006+rng()*.01,ph:rng()*6});
  });
  let t=0;
  const update=(dt,s)=>{
    t+=dt;clouds.rotation.y+=dt*.0012;
    mat.uniforms.uLit.value.copy(s.cloudLit3);mat.uniforms.uDark.value.copy(s.cloudDark3);mat.uniforms.uSun.value.copy(s.lightDir);mat.uniforms.fogDensity.value=fog.density;
    for(const b of list){b.a+=b.sp*dt;b.m.position.set(Math.cos(b.a)*b.r,b.y+Math.sin(t*.2+b.ph)*6,Math.sin(b.a)*b.r);b.m.rotation.y=t*.05+b.ph;}
  };
  return {clouds,balloons:bal,cloudMat:mat,update};
}
