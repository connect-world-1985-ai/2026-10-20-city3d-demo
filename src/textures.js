import * as THREE from 'three';
import {mulberry32,canvas,tex} from './util.js';

const CELLS=8, S=1024, C=S/CELLS;

function speckle(ctx,rng,w,h,n,alpha){
  for(let i=0;i<n;i++){const v=rng()<.5?0:255;ctx.fillStyle=`rgba(${v},${v},${v},${alpha*rng()})`;ctx.fillRect(rng()*w,rng()*h,1+rng()*2,1+rng()*2);}
}
// variant: 0 punched windows, 1 ribbon, 2 glass curtain wall
export function makeFacade(variant,litFrac,seed,aniso){
  const rng=mulberry32(seed);
  const cm=canvas(S,S), ce=canvas(S,S);
  const m=cm.getContext('2d'), e=ce.getContext('2d');
  m.fillStyle=variant===2?'#e9edf2':'#f1ece4';m.fillRect(0,0,S,S);
  e.fillStyle='#000';e.fillRect(0,0,S,S);
  if(variant!==2)speckle(m,rng,S,S,5000,.07);
  const warm=['#ffd9a3','#ffcf8a','#ffe2b8','#ffc77a','#fff0d6','#ffbf6b'];
  const cool=['#cfe6ff','#bcd9ff','#dff0ff'];
  const tv=['#7fb2ff','#9ad0ff','#b5a4ff'];
  for(let r=0;r<CELLS;r++)for(let c=0;c<CELLS;c++){
    const x=c*C,y=(CELLS-1-r)*C; // r=0 -> bottom row
    const lit=rng()<litFrac;
    let wx,wy,ww,wh;
    if(variant===0){wx=x+26;wy=y+22;ww=C-52;wh=C-44;}
    else if(variant===1){wx=x+(c===0?0:0);wy=y+30;ww=C;wh=C-62;}
    else {wx=x+3;wy=y+14;ww=C-6;wh=C-16;}
    // glass
    const g=m.createLinearGradient(0,wy,0,wy+wh);
    if(variant===2){const t=rng();g.addColorStop(0,`hsl(${198+t*18},${35+t*20}%,${28+t*10}%)`);g.addColorStop(1,`hsl(${205+t*18},${40+t*20}%,${14+t*8}%)`);}
    else{g.addColorStop(0,'#3a5169');g.addColorStop(1,'#1d2a3a');}
    m.fillStyle=g;m.fillRect(wx,wy,ww,wh);
    // sky reflection streak
    m.fillStyle='rgba(255,255,255,.07)';m.beginPath();m.moveTo(wx,wy+wh);m.lineTo(wx+ww*.55,wy);m.lineTo(wx+ww*.8,wy);m.lineTo(wx+ww*.25,wy+wh);m.fill();
    if(variant===0){
      m.strokeStyle='#bdb5a8';m.lineWidth=4;m.strokeRect(wx,wy,ww,wh);
      m.fillStyle='#cfc7ba';m.fillRect(wx-5,wy+wh,ww+10,6); // sill
      m.fillStyle='rgba(0,0,0,.18)';m.fillRect(wx-5,wy+wh+6,ww+10,3);
      m.fillStyle='#bdb5a8';m.fillRect(wx+ww/2-1.5,wy,3,wh);
    }else if(variant===1){
      m.fillStyle='#8f98a3';m.fillRect(x,wy,3,wh);m.fillRect(x+C/2-1.5,wy,3,wh);
      m.fillStyle='#c8c3ba';m.fillRect(x,wy+wh,C,5);
    }else{
      m.fillStyle='#aab3bd';m.fillRect(x,y,C,4);m.fillRect(x,y,3,C);
      m.fillStyle='#2f3944';m.fillRect(x,y+C-3,C,3);
    }
    if(lit){
      const k=rng();const col=k<.68?warm[(rng()*warm.length)|0]:k<.9?cool[(rng()*cool.length)|0]:tv[(rng()*tv.length)|0];
      const eg=e.createLinearGradient(0,wy,0,wy+wh);eg.addColorStop(0,col);eg.addColorStop(1,'rgba(255,170,90,.8)');
      e.fillStyle=eg;
      const inset=variant===2?3:variant===1?6:4;
      e.fillRect(wx+inset,wy+inset,ww-inset*2-(variant===1?3:0),wh-inset*2);
      if(rng()<.35){e.fillStyle='rgba(0,0,0,.45)';e.fillRect(wx+inset,wy+inset,ww-inset*2,(wh-inset*2)*(.15+rng()*.35));} // blinds
      if(rng()<.3){e.fillStyle='rgba(0,0,0,.35)';const px=wx+inset+rng()*(ww-inset*2-14);e.fillRect(px,wy+wh*.55,10,wh*.35);} // silhouette
      // lit glass in base map brighter
      m.fillStyle='rgba(255,220,160,.20)';m.fillRect(wx,wy,ww,wh);
    }
  }
  const map=tex(cm,{aniso}), em=tex(ce,{aniso});
  return {map,emissive:em};
}

export function makeAsphalt(aniso){
  const rng=mulberry32(7);const c=canvas(512,512),x=c.getContext('2d');
  x.fillStyle='#4a4d54';x.fillRect(0,0,512,512);
  for(let i=0;i<26000;i++){const v=(rng()*70+30)|0;x.fillStyle=`rgba(${v},${v},${v+4},${.15+rng()*.35})`;x.fillRect(rng()*512,rng()*512,1+rng()*2.2,1+rng()*2.2);}
  for(let i=0;i<40;i++){x.strokeStyle=`rgba(20,20,24,${.1+rng()*.15})`;x.lineWidth=1+rng()*2;x.beginPath();let px=rng()*512,py=rng()*512;x.moveTo(px,py);for(let k=0;k<6;k++){px+=(rng()-.5)*70;py+=(rng()-.5)*70;x.lineTo(px,py);}x.stroke();}
  return tex(c,{aniso});
}
export function makePaving(aniso){
  const rng=mulberry32(11);const c=canvas(512,512),x=c.getContext('2d');
  x.fillStyle='#b9b4aa';x.fillRect(0,0,512,512);
  const n=4,s=512/n; // 4 tiles per texture -> 1m tiles when repeat = size/4
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const v=(rng()*26-13)|0;x.fillStyle=`rgb(${185+v},${180+v},${170+v})`;x.fillRect(i*s+2,j*s+2,s-4,s-4);}
  for(let i=0;i<9000;i++){const v=rng()<.5?60:230;x.fillStyle=`rgba(${v},${v},${v},${.05+rng()*.1})`;x.fillRect(rng()*512,rng()*512,1.5,1.5);}
  x.strokeStyle='rgba(70,66,60,.55)';x.lineWidth=3;
  for(let i=0;i<=n;i++){x.beginPath();x.moveTo(i*s,0);x.lineTo(i*s,512);x.stroke();x.beginPath();x.moveTo(0,i*s);x.lineTo(512,i*s);x.stroke();}
  return tex(c,{aniso});
}
export function makeGrass(aniso){
  const rng=mulberry32(5);const c=canvas(512,512),x=c.getContext('2d');
  x.fillStyle='#4f7a3a';x.fillRect(0,0,512,512);
  for(let i=0;i<30000;i++){const g=(rng()*60)|0;x.fillStyle=`rgba(${50+g*.5},${100+g},${40+g*.3},${.25+rng()*.4})`;x.fillRect(rng()*512,rng()*512,1+rng()*2,2+rng()*4);}
  for(let i=0;i<1200;i++){x.fillStyle=rng()<.5?'rgba(255,240,150,.7)':'rgba(255,255,255,.65)';x.fillRect(rng()*512,rng()*512,2,2);}
  return tex(c,{aniso});
}
export function makeGlow(){
  const c=canvas(128,128),x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.12,'rgba(255,255,255,.75)');g.addColorStop(.35,'rgba(255,255,255,.22)');g.addColorStop(.7,'rgba(255,255,255,.05)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  return tex(c,{repeat:false,aniso:1});
}
export function makePool(){
  const c=canvas(128,128),x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.3,'rgba(255,255,255,.4)');g.addColorStop(.65,'rgba(255,255,255,.1)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  return tex(c,{repeat:false,aniso:1});
}
export function makeBeam(){
  const c=canvas(256,128),x=c.getContext('2d');
  // u along length (0 = at the car), v across
  const img=x.createImageData(256,128);
  for(let j=0;j<128;j++)for(let i=0;i<256;i++){
    const u=i/255,v=(j/127-.5)*2;
    const wid=.25+.75*u; const across=Math.max(0,1-Math.abs(v)/wid);
    const a=Math.pow(1-u,1.6)*Math.pow(across,1.4);
    const o=(j*256+i)*4;img.data[o]=255;img.data[o+1]=255;img.data[o+2]=255;img.data[o+3]=a*255;
  }
  x.putImageData(img,0,0);
  return tex(c,{repeat:false,aniso:1});
}
export const SIGN_TEXT=[['RAMEN','拉面','#ff4d6d'],['COFFEE','咖啡','#ffb347'],['HOTEL','酒店','#7ee0ff'],['BOOKS','书店','#9dff8a'],['CINEMA','影院','#ff7bf0'],['TEA','茶','#6dffb0'],['PHARMACY','药房','#6fa8ff'],['DIM SUM','点心','#ffd34d'],['ARCADE','游戏厅','#c08bff'],['BAKERY','面包','#ffa07a'],['NOODLES','面馆','#ff6a3d'],['BAR','酒吧','#40e0ff'],['SUSHI','寿司','#ff5a7a'],['MARKET','超市','#a6ff5a'],['PIZZA','披萨','#ffcf40'],['SPA','水疗','#7af0e0']];
export function makeSigns(aniso){
  const c=canvas(1024,512),x=c.getContext('2d');
  x.fillStyle='#111';x.fillRect(0,0,1024,512);
  SIGN_TEXT.forEach(([en,zh,col],i)=>{
    const cx=(i%4)*256,cy=((i/4)|0)*128;
    x.fillStyle='#14161d';x.fillRect(cx+4,cy+4,248,120);
    x.save();x.shadowColor=col;x.shadowBlur=14;x.strokeStyle=col;x.lineWidth=4;x.strokeRect(cx+10,cy+10,236,108);x.restore();
    x.fillStyle=col;x.textAlign='center';x.textBaseline='middle';
    x.save();x.shadowColor=col;x.shadowBlur=12;
    let fs=46;x.font=`800 ${fs}px "Segoe UI",Arial,sans-serif`;while(x.measureText(en).width>210&&fs>16){fs-=2;x.font=`800 ${fs}px "Segoe UI",Arial,sans-serif`;}
    x.fillText(en,cx+128,cy+46);
    x.font='700 32px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';x.fillText(zh,cx+128,cy+88);
    x.restore();
  });
  return tex(c,{aniso});
}
