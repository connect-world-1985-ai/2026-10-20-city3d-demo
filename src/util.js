import * as THREE from 'three';

// toNonIndexed() on an already non-indexed geometry just returns it (no console warning)
{const f=THREE.BufferGeometry.prototype.toNonIndexed;THREE.BufferGeometry.prototype.toNonIndexed=function(){return this.index?f.call(this):this;};}
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function hexToLinear(hex){const c=new THREE.Color(hex);return [c.r,c.g,c.b];}
export const lin=hexToLinear;
export function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function tex(c,{repeat=true,srgb=true,aniso=8}={}){
  const t=new THREE.CanvasTexture(c);
  if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;
  return t;
}
export const clamp=(x,a,b)=>x<a?a:x>b?b:x;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const mixc=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
export const mulc=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];

/* Geometry builder: indexed triangles with position/normal/uv/color plus any
   number of extra float attributes. `set(name,value)` fixes the extra value used
   by every vertex written afterwards. */
export class GB{
  constructor(extras={}){
    this.pos=[];this.nor=[];this.uv=[];this.col=[];this.idx=[];
    this.ex={};this.cur={};
    for(const k in extras){this.ex[k]={size:extras[k].length,data:[]};this.cur[k]=extras[k].slice();}
  }
  get count(){return this.pos.length/3;}
  set(k,v){this.cur[k]=v;return this;}
  v(p,n,uv,c){
    this.pos.push(p[0],p[1],p[2]);this.nor.push(n[0],n[1],n[2]);this.uv.push(uv[0],uv[1]);this.col.push(c[0],c[1],c[2]);
    for(const k in this.ex){const e=this.ex[k],v=this.cur[k];for(let i=0;i<e.size;i++)e.data.push(v[i]);}
    return this.count-1;
  }
  quad(a,b,c,d,n,uvs,col){
    const i=this.v(a,n,uvs[0],col);this.v(b,n,uvs[1],col);this.v(c,n,uvs[2],col);this.v(d,n,uvs[3],col);
    this.idx.push(i,i+1,i+2,i,i+2,i+3);
  }
  tri(a,b,c,n,col,uvs=[[0,0],[1,0],[0,1]]){const i=this.v(a,n,uvs[0],col);this.v(b,n,uvs[1],col);this.v(c,n,uvs[2],col);this.idx.push(i,i+1,i+2);}
  // axis aligned box; bottom face optional
  box(x0,y0,z0,x1,y1,z1,col,bottom=false,uvScale=0){
    const s=uvScale,U=(a,b,c,d)=>s?[[a*s,c*s],[b*s,c*s],[b*s,d*s],[a*s,d*s]]:[[0,0],[1,0],[1,1],[0,1]];
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],U(x0,x1,y0,y1),col);
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],U(x0,x1,y0,y1),col);
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],U(z0,z1,y0,y1),col);
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],U(z0,z1,y0,y1),col);
    this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],U(x0,x1,z0,z1),col);
    if(bottom)this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],U(x0,x1,z0,z1),col);
  }
  // oriented box: centre c, half sizes h, rotation about y
  obox(cx,cy,cz,hx,hy,hz,ry,col){
    const m=new THREE.Matrix4().makeRotationY(ry).setPosition(cx,cy,cz);
    const g=new THREE.BoxGeometry(hx*2,hy*2,hz*2);this.add(g,m,col);g.dispose();
  }
  // append a three.js BufferGeometry (transformed by matrix) with a flat colour or its own colour attribute
  add(g,m,col){
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,c=g.attributes.color;
    const base=this.count,v=new THREE.Vector3(),nn=new THREE.Vector3(),nm=m?new THREE.Matrix3().getNormalMatrix(m):null;
    if(typeof col==='function'&&!c){ // colour whole triangles by their centroid: crisp stripes
      const ix=g.index?g.index.array:null,cnt=ix?ix.length:p.count,P=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],Nn=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],ce=new THREE.Vector3();
      for(let t=0;t<cnt;t+=3){
        ce.set(0,0,0);
        for(let k=0;k<3;k++){const i=ix?ix[t+k]:t+k;P[k].fromBufferAttribute(p,i);if(m)P[k].applyMatrix4(m);if(n){Nn[k].fromBufferAttribute(n,i);if(nm)Nn[k].applyMatrix3(nm).normalize();}else Nn[k].set(0,1,0);ce.add(P[k]);}
        ce.multiplyScalar(1/3);const cc=col(ce,t/3);
        for(let k=0;k<3;k++){const i=ix?ix[t+k]:t+k;this.v([P[k].x,P[k].y,P[k].z],[Nn[k].x,Nn[k].y,Nn[k].z],uv?[uv.getX(i),uv.getY(i)]:[0,0],cc);this.idx.push(this.count-1);}
      }
      return;
    }
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);if(m)v.applyMatrix4(m);
      if(n){nn.fromBufferAttribute(n,i);if(nm)nn.applyMatrix3(nm).normalize();}else nn.set(0,1,0);
      const cc=c?[c.getX(i),c.getY(i),c.getZ(i)]:(typeof col==='function'?col(v,i):col);
      this.v([v.x,v.y,v.z],[nn.x,nn.y,nn.z],uv?[uv.getX(i),uv.getY(i)]:[0,0],cc);
    }
    if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++)this.idx.push(base+a[i]);}
    else for(let i=0;i<p.count;i++)this.idx.push(base+i);
  }
  geometry(){
    if(!this.idx.length)return null;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(this.nor,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.col,3));
    for(const k in this.ex)g.setAttribute(k,new THREE.Float32BufferAttribute(this.ex[k].data,this.ex[k].size));
    g.setIndex(this.count>65535?new THREE.Uint32BufferAttribute(this.idx,1):new THREE.Uint16BufferAttribute(this.idx,1));
    g.computeBoundingSphere();g.computeBoundingBox();
    return g;
  }
}

// colour whole triangles (by centroid, in local space); returns a non-indexed geometry
export function paintF(g,fn){
  if(g.index)g=g.toNonIndexed();
  const p=g.attributes.position,a=new Float32Array(p.count*3);
  for(let t=0;t<p.count;t+=3){
    const x=(p.getX(t)+p.getX(t+1)+p.getX(t+2))/3,y=(p.getY(t)+p.getY(t+1)+p.getY(t+2))/3,z=(p.getZ(t)+p.getZ(t+1)+p.getZ(t+2))/3,c=fn(x,y,z,t/3);
    for(let k=0;k<3;k++){a[(t+k)*3]=c[0];a[(t+k)*3+1]=c[1];a[(t+k)*3+2]=c[2];}
  }
  g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;
}
// colour every vertex of a geometry; fn(x,y,z)->[r,g,b] or a constant
export function paint(g,c){
  const p=g.attributes.position,a=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const v=typeof c==='function'?c(p.getX(i),p.getY(i),p.getZ(i),i):c;a[i*3]=v[0];a[i*3+1]=v[1];a[i*3+2]=v[2];}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;
}

/* Static instances split into distance levels. Each level is an InstancedMesh;
   update() redistributes instances by distance to the camera (cheap, done every
   few frames), so far-away props cost nothing and mid-distance ones use a
   lighter mesh. */
export class Instances{
  constructor(levels,{extras={}}={}){
    this.levels=levels; // [{geo,mat,max}] sorted near->far; max=distance limit
    this.items=[];this.extras=extras; // extras: name->itemSize
    this.meshes=[];this.dirty=true;
  }
  add(x,y,z,ry=0,s=1,color=null,ex=null,sy){this.items.push({x,y,z,ry,s,sy:sy??s,color,ex});}
  build(root,{shadow=true,receive=true,layer=0}={}){
    const n=this.items.length;if(!n)return this;
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3(),Y=new THREE.Vector3(0,1,0);
    this.mat16=new Float32Array(n*16);
    this.items.forEach((it,i)=>{q.setFromAxisAngle(Y,it.ry);m.compose(p.set(it.x,it.y,it.z),q,sc.set(it.s,it.sy,it.s));m.toArray(this.mat16,i*16);});
    for(const L of this.levels){
      const mesh=new THREE.InstancedMesh(L.geo,L.mat,n);
      mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=shadow&&L.shadow!==false;mesh.receiveShadow=receive;
      if(this.items[0].color){mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3),3);}
      for(const k in this.extras){L.geo.setAttribute(k,new THREE.InstancedBufferAttribute(new Float32Array(n*this.extras[k]),this.extras[k]));}
      if(layer)mesh.layers.set(layer);
      root.add(mesh);this.meshes.push(mesh);
    }
    return this;
  }
  update(cam,scale=1){
    if(!this.meshes.length)return;
    const cnt=this.meshes.map(()=>0),cx=cam.x,cz=cam.z,cy=cam.y;
    const lim=this.levels.map(l=>(l.max*scale)**2);
    for(let i=0;i<this.items.length;i++){
      const it=this.items[i],dx=it.x-cx,dz=it.z-cz,dy=(it.y-cy)*.5,d2=dx*dx+dz*dz+dy*dy;
      let L=-1;for(let k=0;k<lim.length;k++)if(d2<lim[k]){L=k;break;}
      if(L<0)continue;
      const mesh=this.meshes[L],j=cnt[L]++;
      mesh.instanceMatrix.array.set(this.mat16.subarray(i*16,i*16+16),j*16);
      if(mesh.instanceColor){const c=it.color;mesh.instanceColor.array[j*3]=c[0];mesh.instanceColor.array[j*3+1]=c[1];mesh.instanceColor.array[j*3+2]=c[2];}
      for(const k in this.extras){const a=mesh.geometry.attributes[k],sz=this.extras[k];for(let e=0;e<sz;e++)a.array[j*sz+e]=it.ex[k][e];}
    }
    this.meshes.forEach((m,k)=>{m.count=cnt[k];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;for(const e in this.extras)m.geometry.attributes[e].needsUpdate=true;});
  }
}

// chain an onBeforeCompile hook and keep program cache keys distinct
export function hook(mat,key,fn){
  const prev=mat.onBeforeCompile,prevKey=mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile=(s,r)=>{prev&&prev.call(mat,s,r);fn(s,r);};
  mat.customProgramCacheKey=()=>prevKey()+'|'+key;
  return mat;
}
export const GLSL_HASH=`
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 hash32(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yzz)*p3.zyx);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
`;
