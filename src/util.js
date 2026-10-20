import * as THREE from 'three';
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// Simple indexed geometry accumulator
export class Buf{
  constructor(){this.pos=[];this.nor=[];this.uv=[];this.col=[];this.idx=[];}
  quad(a,b,c,d,n,uvs,color){
    const i=this.pos.length/3;
    const ps=[a,b,c,d];
    for(let k=0;k<4;k++){
      this.pos.push(ps[k][0],ps[k][1],ps[k][2]);
      this.nor.push(n[0],n[1],n[2]);
      this.uv.push(uvs[k][0],uvs[k][1]);
      this.col.push(color[0],color[1],color[2]);
    }
    this.idx.push(i,i+1,i+2,i,i+2,i+3);
  }
  // 4 side faces (+z,-z,+x,-x) with window-tile UVs. tw/th: world size of one texture tile. uo: u offset
  sides(x0,y0,z0,x1,y1,z1,color,uo,tw,th){
    const v0=y0/th, v1=y1/th;
    // +z
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],[[x0/tw+uo,v0],[x1/tw+uo,v0],[x1/tw+uo,v1],[x0/tw+uo,v1]],color);
    // -z
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],[[x1/tw+uo,v0],[x0/tw+uo,v0],[x0/tw+uo,v1],[x1/tw+uo,v1]],color);
    // +x
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],[[z1/tw+uo,v0],[z0/tw+uo,v0],[z0/tw+uo,v1],[z1/tw+uo,v1]],color);
    // -x
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],[[z0/tw+uo,v0],[z1/tw+uo,v0],[z1/tw+uo,v1],[z0/tw+uo,v1]],color);
  }
  top(x0,y,z0,x1,z1,color){
    this.quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0],[0,1,0],[[0,0],[1,0],[1,1],[0,1]],color);
  }
  fullBox(x0,y0,z0,x1,y1,z1,color){
    const z=[[0,0],[1,0],[1,1],[0,1]];
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],z,color);
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],z,color);
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],z,color);
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],z,color);
    this.top(x0,y1,z0,x1,z1,color);
  }
  geometry(){
    if(!this.idx.length)return null;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(this.nor,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.col,3));
    g.setIndex(this.pos.length/3>65535?new THREE.Uint32BufferAttribute(this.idx,1):new THREE.Uint16BufferAttribute(this.idx,1));
    g.computeBoundingSphere();g.computeBoundingBox();
    return g;
  }
}
export function hexToLinear(hex){const c=new THREE.Color(hex);return [c.r,c.g,c.b];}
export function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function tex(c,{repeat=true,srgb=true,aniso=8}={}){
  const t=new THREE.CanvasTexture(c);
  if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;
  return t;
}
