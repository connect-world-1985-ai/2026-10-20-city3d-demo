import * as THREE from 'three';

/* Continuous time of day. Keyframes (hour -> look) are interpolated with a
   smoothstep; the sun follows an arc from sunrise (~6:05) to sunset (~18:40). */
const K=(h,o)=>({h,...o});
const NIGHT={sunInt:.5,sunCol:'#8fa4ff',hemiSky:'#3a4590',hemiGround:'#221c36',hemiInt:.55,envInt:.42,fogCol:'#1c1c44',fogDen:0.00084,
  zen:'#050818',mid:'#101440',hor:'#38285e',discCol:'#e8eeff',discAmt:0,glowAmt:.08,horGlow:.1,stars:1,cloudAmt:.3,cloudLit:'#4a4680',cloudDark:'#11122c',
  expo:1.12,bloomS:.32,bloomR:.42,bloomT:1.05,lit:.9,lamp:1.1,head:1,dayIn:.02,night:1,moon:1,sat:1.12,vign:.32,tint:'#eae6ff',shaft:0};
const KEYS=[
  K(0,{...NIGHT,lit:.75}),
  K(4.6,{...NIGHT,lit:.35}),
  K(5.5,{sunInt:0,sunCol:'#c9a0e0',hemiSky:'#55559e',hemiGround:'#3a3050',hemiInt:.55,envInt:.45,fogCol:'#6e5c94',fogDen:0.00078,zen:'#141c4c',mid:'#403c84',hor:'#c48aac',discCol:'#ff9aa8',discAmt:0,glowAmt:.4,horGlow:.6,stars:.4,cloudAmt:.5,cloudLit:'#c08ab0',cloudDark:'#2c2852',expo:1.05,bloomS:.32,bloomR:.48,bloomT:1,lit:.45,lamp:.9,head:.8,dayIn:.05,night:.75,moon:.5,sat:1.1,vign:.28,tint:'#f4eaff',shaft:0}),
  K(6.4,{sunInt:1.7,sunCol:'#ffb08a',hemiSky:'#aaaae8',hemiGround:'#a07a88',hemiInt:.62,envInt:.6,fogCol:'#f6c4c8',fogDen:0.00065,zen:'#4e5eac',mid:'#cc9ccc',hor:'#ffcdb4',discCol:'#ffc49a',discAmt:8,glowAmt:1,horGlow:1.2,stars:0,cloudAmt:.6,cloudLit:'#ffd6c8',cloudDark:'#9282b0',expo:.95,bloomS:.26,bloomR:.5,bloomT:1,lit:.28,lamp:.3,head:.3,dayIn:.2,night:.25,moon:0,sat:1.1,vign:.22,tint:'#fff0ec',shaft:.8}),
  K(8,{sunInt:3,sunCol:'#ffe6cc',hemiSky:'#c6deff',hemiGround:'#c9b2a8',hemiInt:.74,envInt:.75,fogCol:'#e9eef8',fogDen:0.00059,zen:'#4a8ee0',mid:'#9cc8f0',hor:'#f6eff2',discCol:'#fff1dc',discAmt:6,glowAmt:.6,horGlow:.35,stars:0,cloudAmt:.55,cloudLit:'#ffffff',cloudDark:'#c8d0e8',expo:.86,bloomS:.14,bloomR:.4,bloomT:1.2,lit:.04,lamp:0,head:0,dayIn:.42,night:0,moon:0,sat:1.15,vign:.16,tint:'#ffffff',shaft:.3}),
  K(12.5,{sunInt:3.4,sunCol:'#fff3e2',hemiSky:'#cfe6ff',hemiGround:'#cdbcae',hemiInt:.78,envInt:.8,fogCol:'#d9ebf8',fogDen:0.00053,zen:'#4c96ea',mid:'#8cc6f4',hor:'#e9f3fb',discCol:'#fff7e6',discAmt:6,glowAmt:.5,horGlow:.2,stars:0,cloudAmt:.5,cloudLit:'#ffffff',cloudDark:'#cad8ec',expo:.84,bloomS:.12,bloomR:.4,bloomT:1.25,lit:.03,lamp:0,head:0,dayIn:.48,night:0,moon:0,sat:1.17,vign:.15,tint:'#ffffff',shaft:0}),
  K(16,{sunInt:3.3,sunCol:'#ffeacc',hemiSky:'#c6dcff',hemiGround:'#cfb6a6',hemiInt:.76,envInt:.78,fogCol:'#e6e8f4',fogDen:0.00055,zen:'#4f8ee0',mid:'#9cc0ee',hor:'#f8ecea',discCol:'#fff0d8',discAmt:6,glowAmt:.55,horGlow:.35,stars:0,cloudAmt:.55,cloudLit:'#fffaf2',cloudDark:'#c8cce4',expo:.86,bloomS:.14,bloomR:.42,bloomT:1.2,lit:.05,lamp:0,head:0,dayIn:.44,night:0,moon:0,sat:1.17,vign:.16,tint:'#fffaf6',shaft:.2}),
  K(17.4,{sunInt:2.9,sunCol:'#ffcf9c',hemiSky:'#b9c6ff',hemiGround:'#c89e96',hemiInt:.78,envInt:.72,fogCol:'#f5d4c6',fogDen:0.00059,zen:'#5e86d6',mid:'#b9a6e0',hor:'#ffd6b8',discCol:'#ffd9a8',discAmt:7,glowAmt:.8,horGlow:.8,stars:0,cloudAmt:.6,cloudLit:'#fff0de',cloudDark:'#b8a2c8',expo:.9,bloomS:.2,bloomR:.45,bloomT:1.1,lit:.18,lamp:0,head:.1,dayIn:.34,night:.05,moon:0,sat:1.12,vign:.2,tint:'#fff4ea',shaft:.7}),
  K(18.3,{sunInt:2.6,sunCol:'#ff9a62',hemiSky:'#8c8fd8',hemiGround:'#8a6070',hemiInt:.58,envInt:.6,fogCol:'#f0a7a6',fogDen:0.00062,zen:'#2e3a7a',mid:'#a06aa6',hor:'#ffb08a',discCol:'#ffad70',discAmt:9,glowAmt:1.1,horGlow:1.4,stars:.05,cloudAmt:.7,cloudLit:'#ffc09a',cloudDark:'#6c5a92',expo:.96,bloomS:.26,bloomR:.48,bloomT:1,lit:.62,lamp:.55,head:.5,dayIn:.17,night:.35,moon:0,sat:1.15,vign:.26,tint:'#fff0f2',shaft:1}),
  K(18.85,{sunInt:0,sunCol:'#b07ad0',hemiSky:'#5c60b2',hemiGround:'#4a3a5a',hemiInt:.52,envInt:.5,fogCol:'#8e70aa',fogDen:0.00072,zen:'#141e4c',mid:'#4c3c84',hor:'#d4789c',discCol:'#ff8a7a',discAmt:0,glowAmt:.6,horGlow:.9,stars:.35,cloudAmt:.5,cloudLit:'#c4809c',cloudDark:'#2e2850',expo:1.05,bloomS:.32,bloomR:.48,bloomT:1,lit:.88,lamp:.92,head:.85,dayIn:.06,night:.7,moon:.4,sat:1.14,vign:.28,tint:'#f6eaff',shaft:0}),
  K(19.6,{sunInt:.4,sunCol:'#9fb0ff',hemiSky:'#40489c',hemiGround:'#2a2440',hemiInt:.52,envInt:.45,fogCol:'#3e3a72',fogDen:0.00084,zen:'#0b1236',mid:'#262a68',hor:'#6c4c8e',discCol:'#e8eeff',discAmt:0,glowAmt:.2,horGlow:.3,stars:.7,cloudAmt:.4,cloudLit:'#6a5a96',cloudDark:'#161a3a',expo:1.12,bloomS:.32,bloomR:.44,bloomT:1.02,lit:1,lamp:1.05,head:1,dayIn:.03,night:.9,moon:.8,sat:1.12,vign:.3,tint:'#eee8ff',shaft:0}),
  K(21,{...NIGHT,lit:1}),
  K(24,{...NIGHT,lit:.75}),
];
for(const k of KEYS)for(const n in k)if(typeof k[n]==='string')k[n]=new THREE.Color(k[n]);
export const TOD_PRESETS={day:12.5,dusk:18.3,night:22,dawn:6.4,golden:17.4};

export function makeState(){const o={};const k=KEYS[0];for(const n in k){if(n==='h')continue;o[n]=k[n].isColor?k[n].clone():k[n];}
  o.sunDir=new THREE.Vector3();o.moonDir=new THREE.Vector3();o.lightDir=new THREE.Vector3();o.cloudLit3=new THREE.Color();o.cloudDark3=new THREE.Color();o.hour=0;o.sunEl=0;return o;}
const dir=(el,az,v)=>{const e=el*Math.PI/180,a=az*Math.PI/180;return v.set(Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a));};
export function evalTod(out,hour){
  hour=((hour%24)+24)%24;
  let i=0;while(i<KEYS.length-2&&KEYS[i+1].h<=hour)i++;
  const a=KEYS[i],b=KEYS[i+1],t0=(hour-a.h)/(b.h-a.h),t=t0*t0*(3-2*t0);
  for(const n in a){if(n==='h')continue;if(a[n].isColor)out[n].lerpColors(a[n],b[n],t);else out[n]=a[n]+(b[n]-a[n])*t;}
  const rise=6.1,set=18.7,u=(hour-rise)/(set-rise);
  const el=62*Math.sin(Math.PI*u),az=110+u*130;
  out.sunEl=el;dir(el,az,out.sunDir);dir(38,70,out.moonDir);
  const useSun=hour>5.5&&hour<18.85;
  out.lightDir.copy(useSun?(el<2?dir(2,az,new THREE.Vector3()):out.sunDir):out.moonDir);
  out.cloudLit3.copy(out.cloudLit);out.cloudDark3.copy(out.cloudDark);
  out.hour=hour;
  return out;
}
