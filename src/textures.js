import * as THREE from 'three';
import {mulberry32,canvas,tex} from './util.js';

const FONT_EN='"Segoe UI","Trebuchet MS",Arial,sans-serif';
const FONT_ZH='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';

export function makeAsphalt(aniso){
  const rng=mulberry32(7);const c=canvas(512,512),x=c.getContext('2d');
  x.fillStyle='#5d5157';x.fillRect(0,0,512,512);
  for(let i=0;i<30000;i++){const v=(rng()*60+50)|0;x.fillStyle=`rgba(${v+8},${v},${v+4},${.12+rng()*.3})`;x.fillRect(rng()*512,rng()*512,1+rng()*2,1+rng()*2);}
  for(let i=0;i<14;i++){x.fillStyle=`rgba(40,30,34,${.05+rng()*.06})`;x.beginPath();x.ellipse(rng()*512,rng()*512,20+rng()*60,10+rng()*40,rng()*3,0,7);x.fill();}
  for(let i=0;i<30;i++){x.strokeStyle=`rgba(35,26,30,${.12+rng()*.15})`;x.lineWidth=1+rng()*1.5;x.beginPath();let px=rng()*512,py=rng()*512;x.moveTo(px,py);for(let k=0;k<6;k++){px+=(rng()-.5)*60;py+=(rng()-.5)*60;x.lineTo(px,py);}x.stroke();}
  return tex(c,{aniso});
}
// sidewalk: pastel tiles, 1 texture = 4 m
export function makePaving(aniso){
  const rng=mulberry32(11);const c=canvas(512,512),x=c.getContext('2d');
  x.fillStyle='#d9c9c4';x.fillRect(0,0,512,512);
  const n=8,s=512/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const v=(rng()*14-7)|0,pink=(i+j)%2===0;
    x.fillStyle=pink?`rgb(${246+v},${222+v},${222+v})`:`rgb(${244+v},${238+v},${226+v})`;
    x.fillRect(i*s+2,j*s+2,s-4,s-4);
  }
  for(let i=0;i<7000;i++){const v=rng()<.5?120:255;x.fillStyle=`rgba(${v},${v-10},${v-10},${.04+rng()*.08})`;x.fillRect(rng()*512,rng()*512,1.5,1.5);}
  return tex(c,{aniso});
}
export function makeGrass(aniso){
  const rng=mulberry32(5);const c=canvas(512,512),x=c.getContext('2d');
  x.fillStyle='#7fc86a';x.fillRect(0,0,512,512);
  for(let i=0;i<34000;i++){const g=(rng()*60)|0;x.fillStyle=`rgba(${90+g*.6},${160+g},${80+g*.4},${.25+rng()*.4})`;x.fillRect(rng()*512,rng()*512,1+rng()*2,2+rng()*4);}
  const fl=['#ffe27a','#ffffff','#ffb3d1','#d9b8ff'];
  for(let i=0;i<1400;i++){x.fillStyle=fl[(rng()*4)|0];x.globalAlpha=.75;x.fillRect(rng()*512,rng()*512,2.5,2.5);}
  x.globalAlpha=1;
  return tex(c,{aniso});
}
// white icing with sprinkles (alpha = sprinkle mask), tinted per roof in the shader
export function makeSprinkles(aniso){
  const rng=mulberry32(19);const c=canvas(512,512),x=c.getContext('2d');
  x.clearRect(0,0,512,512);
  const cols=['#ff5d8f','#ffd23f','#3fc1ff','#7bdc5a','#b57bff','#ff9a3d','#ffffff'];
  for(let i=0;i<900;i++){
    x.save();x.translate(rng()*512,rng()*512);x.rotate(rng()*Math.PI);
    x.fillStyle=cols[(rng()*cols.length)|0];
    const L=9+rng()*6;x.beginPath();x.roundRect(-L/2,-2.2,L,4.4,2.2);x.fill();x.restore();
  }
  return tex(c,{aniso});
}
// scalloped roof tiles (greyscale, tinted by vertex colour)
export function makeShingles(aniso){
  const c=canvas(256,256),x=c.getContext('2d');
  x.fillStyle='#d8d8d8';x.fillRect(0,0,256,256);
  const r=16;
  for(let row=-1;row<10;row++){
    const y=row*28,off=row%2?r:0;
    for(let k=-1;k<10;k++){
      const cx=k*r*2+off;
      const g=x.createLinearGradient(0,y,0,y+30);g.addColorStop(0,'#c9c9c9');g.addColorStop(1,'#ffffff');
      x.fillStyle=g;x.beginPath();x.moveTo(cx-r,y);x.lineTo(cx-r,y+14);x.arc(cx,y+14,r,Math.PI,0,true);x.lineTo(cx+r,y);x.closePath();x.fill();
      x.strokeStyle='rgba(90,70,70,.45)';x.lineWidth=2;x.beginPath();x.arc(cx,y+14,r,Math.PI,0,true);x.stroke();
    }
  }
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
  g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.3,'rgba(255,255,255,.42)');g.addColorStop(.65,'rgba(255,255,255,.1)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  return tex(c,{repeat:false,aniso:1});
}
export function makeBeam(){
  const c=canvas(256,128),x=c.getContext('2d');
  const img=x.createImageData(256,128);
  for(let j=0;j<128;j++)for(let i=0;i<256;i++){
    const u=i/255,v=(j/127-.5)*2,wid=.25+.75*u,across=Math.max(0,1-Math.abs(v)/wid);
    const a=Math.pow(1-u,1.6)*Math.pow(across,1.4),o=(j*256+i)*4;
    img.data[o]=img.data[o+1]=img.data[o+2]=255;img.data[o+3]=a*255;
  }
  x.putImageData(img,0,0);
  return tex(c,{repeat:false,aniso:1});
}
export const SIGN_TEXT=[['CANDY','糖果','#ff4d8d'],['CUPCAKES','纸杯蛋糕','#ff9ad5'],['GELATO','冰淇淋','#5fe3ff'],['MOCHI','麻薯','#9dff8a'],['BOBA TEA','奶茶','#ffb347'],['DONUTS','甜甜圈','#ff7bf0'],['MACARONS','马卡龙','#c8a2ff'],['CHOCOLATE','巧克力','#ffcf8a'],['BAKERY','面包房','#ffd34d'],['CAFÉ','咖啡','#ff8f6b'],['BONBONS','夹心糖','#ff5a7a'],['TOFFEE','太妃糖','#ffc14d'],['CRÊPES','可丽饼','#7af0e0'],['WAFFLES','华夫饼','#ffe066'],['PIES','甜派','#a6ff5a'],['TEA HOUSE','茶馆','#6dffb0']];
export const BLADE_TEXT=[['甜品','#ff6fa8'],['糖果铺','#ffd34d'],['蛋糕','#7ee0ff'],['奶茶','#9dff8a'],['点心','#ff9a5c'],['冰室','#8fd3ff'],['果铺','#ff7b7b'],['茶','#c8a2ff']];
// atlas 1024x1024: top half 4x4 horizontal signs (256x128), bottom half 8 vertical blade signs (128x512)
export function makeSigns(aniso){
  const c=canvas(1024,1024),x=c.getContext('2d');
  x.fillStyle='#1a1220';x.fillRect(0,0,1024,1024);
  SIGN_TEXT.forEach(([en,zh,col],i)=>{
    const cx=(i%4)*256,cy=((i/4)|0)*128;
    const bg=x.createLinearGradient(0,cy,0,cy+128);bg.addColorStop(0,'#2a1a30');bg.addColorStop(1,'#180f1d');
    x.fillStyle=bg;x.beginPath();x.roundRect(cx+4,cy+4,248,120,18);x.fill();
    x.save();x.shadowColor=col;x.shadowBlur=14;x.strokeStyle=col;x.lineWidth=4;x.beginPath();x.roundRect(cx+11,cy+11,234,106,14);x.stroke();x.restore();
    x.fillStyle=col;x.textAlign='center';x.textBaseline='middle';
    x.save();x.shadowColor=col;x.shadowBlur=12;
    let fs=44;x.font=`900 ${fs}px ${FONT_EN}`;while(x.measureText(en).width>212&&fs>16){fs-=2;x.font=`900 ${fs}px ${FONT_EN}`;}
    x.fillText(en,cx+128,cy+48);
    x.font=`700 30px ${FONT_ZH}`;x.fillText(zh,cx+128,cy+90);
    x.restore();
  });
  BLADE_TEXT.forEach(([zh,col],i)=>{
    const cx=i*128,cy=512;
    x.fillStyle='#22142a';x.beginPath();x.roundRect(cx+6,cy+6,116,500,16);x.fill();
    x.save();x.shadowColor=col;x.shadowBlur=12;x.strokeStyle=col;x.lineWidth=4;x.beginPath();x.roundRect(cx+14,cy+14,100,484,12);x.stroke();
    x.fillStyle=col;x.textAlign='center';x.textBaseline='middle';x.font=`800 72px ${FONT_ZH}`;
    const ch=[...zh],step=Math.min(110,440/ch.length);
    ch.forEach((k,j)=>x.fillText(k,cx+64,cy+256+(j-(ch.length-1)/2)*step));
    x.restore();
  });
  return tex(c,{aniso,repeat:false});
}
// rooftop billboards 1024x512: two designs stacked
export function makeBillboards(aniso){
  const c=canvas(1024,512),x=c.getContext('2d');
  const d=(y,bg1,bg2,big,small,col)=>{
    const g=x.createLinearGradient(0,y,1024,y+256);g.addColorStop(0,bg1);g.addColorStop(1,bg2);
    x.fillStyle=g;x.fillRect(0,y,1024,256);
    x.fillStyle='rgba(255,255,255,.18)';for(let i=0;i<14;i++){x.beginPath();x.arc(60+i*72,y+(i%2?40:216),18,0,7);x.fill();}
    x.save();x.textAlign='center';x.textBaseline='middle';x.shadowColor=col;x.shadowBlur=18;x.fillStyle='#fff';
    x.font=`900 104px ${FONT_EN}`;x.fillText(big,512,y+104);
    x.font=`800 62px ${FONT_ZH}`;x.fillStyle=col;x.fillText(small,512,y+196);x.restore();
    x.strokeStyle='#fff';x.lineWidth=10;x.strokeRect(5,y+5,1014,246);
  };
  d(0,'#ff6fa8','#ffb36b','SWEET CITY','甜蜜之城 · 欢迎光临','#fff3a8');
  d(256,'#6fd3ff','#b78bff','GELATO 24/7','冰淇淋 · 全天营业','#ffe4f2');
  return tex(c,{aniso,repeat:false});
}
