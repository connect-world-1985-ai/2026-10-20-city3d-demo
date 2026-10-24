import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';

/* Height fog with sun in-scattering, patched into every built-in material. */
export function patchFog(){
  const C=THREE.ShaderChunk;
  // world position is interpolated exactly; distance is taken per fragment (huge planes would otherwise over-fog)
  C.fog_pars_vertex='#ifdef USE_FOG\nvarying vec3 vFogW;\n#endif';
  C.fog_vertex='#ifdef USE_FOG\nvFogW=transpose(mat3(viewMatrix))*mvPosition.xyz+cameraPosition;\n#endif';
  C.fog_pars_fragment=`#ifdef USE_FOG
uniform vec3 fogColor;varying vec3 vFogW;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;uniform float fogFar;
#endif
#endif`;
  C.fog_fragment=`#ifdef USE_FOG
  float vFogDepth=length(vFogW-cameraPosition);
#ifdef FOG_EXP2
  float fK=.0045,fy0=max(cameraPosition.y,0.),fy1=max(vFogW.y,0.),fdy=fy1-fy0;
  float fh=abs(fdy)>.05?(exp(-fK*fy0)-exp(-fK*fy1))/(fK*fdy):exp(-fK*fy0);
  float fd=fogDensity*vFogDepth;
  float fogFactor=1.-exp(-fd*fd*(.18+.8*fh));
#else
  float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
#endif
  vec3 fogC=fogColor;
#if (defined(STANDARD)||defined(LAMBERT)||defined(PHONG))&&NUM_DIR_LIGHTS>0
  {float sa=max(dot(normalize(-vViewPosition),directionalLights[0].direction),0.);fogC+=directionalLights[0].color*(pow(sa,6.)*.05+pow(sa,40.)*.08);}
#endif
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogC,fogFactor);
#endif`;
}

class AOPass extends GTAOPass{
  overrideVisibility(){
    const cache=this._visibilityCache;
    this.scene.traverse(o=>{cache.set(o,o.visible);if(o.isPoints||o.isLine||o.userData.noAO||(o.material&&o.material.transparent))o.visible=false;});
  }
}

const GradeShader={
  uniforms:{tDiffuse:{value:null},uSat:{value:1},uVign:{value:.2},uTint:{value:new THREE.Color(1,1,1)},uTime:{value:0},uGrain:{value:.018},uTilt:{value:0},uFocus:{value:.5},
    uRes:{value:new THREE.Vector2(1,1)},uSun:{value:new THREE.Vector2(.5,.5)},uShaft:{value:0},uShaftCol:{value:new THREE.Color(1,.8,.6)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uSat,uVign,uTime,uGrain,uTilt,uFocus,uShaft;uniform vec3 uTint,uShaftCol;uniform vec2 uRes,uSun;varying vec2 vUv;
  float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
  void main(){
    vec2 uv=vUv;float asp=uRes.x/uRes.y;
    vec3 c=texture2D(tDiffuse,uv).rgb;
    if(uTilt>0.){float b=smoothstep(.06,.42,abs(uv.y-uFocus))*uTilt;
      if(b>.01){vec3 acc=c;for(int i=1;i<16;i++){float a=float(i)*2.39996,r=sqrt(float(i))/4.;acc+=texture2D(tDiffuse,uv+vec2(cos(a)/asp,sin(a))*r*b*.011).rgb;}c=acc/16.;}
      float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.+.18*uTilt);}
    if(uShaft>.001){
      vec2 d=(uSun-uv);vec3 s=vec3(0.);vec2 p=uv;float dec=1.;
      float jit=hash(uv*uRes)*.5;
      for(int i=0;i<28;i++){p+=d*(1./30.)*(1.+jit*.03);vec3 t=texture2D(tDiffuse,clamp(p,0.,1.)).rgb;float l=max(dot(t,vec3(.3,.59,.11))-.78,0.);s+=l*dec;dec*=.955;}
      c+=uShaftCol*s*uShaft*.09;
    }
    float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,uSat);
    c*=uTint;
    vec2 q=uv-.5;q.x*=asp*.75;c*=1.-uVign*smoothstep(.28,.95,length(q));
    c+=(hash(uv*uRes+fract(uTime)*91.)-.5)*uGrain;
    gl_FragColor=vec4(c,1.);
  }`};

export function makeComposer(renderer,scene,camera,pixelRatio){
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,rt);
  composer.setPixelRatio(pixelRatio);composer.setSize(innerWidth,innerHeight);
  const render=new RenderPass(scene,camera);composer.addPass(render);
  const ao=new AOPass(scene,camera,size.x,size.y);
  ao.updateGtaoMaterial({radius:2.2,distanceExponent:1.4,thickness:1.6,scale:1.15,samples:12,distanceFallOff:1,screenSpaceRadius:false});
  ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:12});
  ao.blendIntensity=.9;
  ao.halfRes=true;
  const aoSetSize=ao.setSize.bind(ao);ao.setSize=(w,h)=>aoSetSize(ao.halfRes?Math.ceil(w/2):w,ao.halfRes?Math.ceil(h/2):h);
  composer.addPass(ao);
  // drop NaN/Inf before the bloom blur can smear them across the frame
  const clean=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);bvec3 n=isnan(c.rgb);c.rgb=any(n)||any(isinf(c.rgb))?vec3(0.):min(c.rgb,vec3(64.));gl_FragColor=vec4(c.rgb,1.);}'});
  composer.addPass(clean);
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.6,.8);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade=new ShaderPass(GradeShader);composer.addPass(grade);
  composer.setSize(innerWidth,innerHeight);
  return {composer,ao,bloom,grade,render};
}
