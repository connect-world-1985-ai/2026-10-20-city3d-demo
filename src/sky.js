import * as THREE from 'three';
const vert=`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const frag=`
varying vec3 vDir;
uniform vec3 zen,mid,hor,sunDir,discCol,cloudLit,cloudDark;
uniform float discAmt,glowAmt,horGlow,stars,cloudAmt,time,discSize;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec3 d=normalize(vDir);float h=d.y;
  vec3 col=mix(hor,mid,smoothstep(0.0,0.22,h));
  col=mix(col,zen,smoothstep(0.12,0.85,h));
  col=mix(col,hor*0.6,smoothstep(0.0,-0.3,h));
  float s=max(dot(d,sunDir),0.);
  col+=discCol*exp(-abs(h)*6.0)*pow(s,3.0)*horGlow;
  col+=discCol*(pow(s,6.0)*0.3+pow(s,60.0)*0.8)*glowAmt;
  float disc=smoothstep(cos(discSize),cos(discSize*0.8),dot(d,sunDir));
  col+=discCol*disc*discAmt*step(-0.02,h);
  if(stars>0.001&&h>0.0){
    vec3 q=d*170.;vec3 id=floor(q);vec3 f=fract(q);
    vec3 sp=vec3(hash(id.xy+id.z),hash(id.yz+id.x+3.1),hash(id.zx+id.y+7.7));
    float dd=length(f-sp);float on=step(0.975,hash(id.xz*1.7+id.y));
    float tw=0.7+0.3*sin(time*2.+hash(id.xy)*40.);
    col+=vec3(.85,.92,1.)*on*smoothstep(0.14,0.0,dd)*tw*stars*3.0*smoothstep(0.0,0.2,h);
  }
  if(h>0.005){
    vec2 uv=d.xz/(h+0.14)*1.1+vec2(time*0.006,time*0.002);
    float c=fbm(uv);float m=smoothstep(0.5,0.82,c)*cloudAmt*smoothstep(0.005,0.16,h);
    float lit=clamp(pow(s,1.4)*1.3+0.2,0.,1.);
    vec3 cc=mix(cloudDark,cloudLit,lit);
    col=mix(col,cc,m*0.9);
  }
  gl_FragColor=vec4(col,1.);
}`;
export function makeSky(){
  const mat=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
    uniforms:{zen:{value:new THREE.Color()},mid:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3(0,1,0)},discCol:{value:new THREE.Color()},cloudLit:{value:new THREE.Color()},cloudDark:{value:new THREE.Color()},
      discAmt:{value:1},glowAmt:{value:1},horGlow:{value:1},stars:{value:0},cloudAmt:{value:.5},time:{value:0},discSize:{value:.04}}});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),mat);
  mesh.frustumCulled=false;mesh.renderOrder=-10;
  return mesh;
}
