// City grid, districts and shared layout helpers.
export const BLOCK=62, ROAD=14, P=76, N=9, HALF=342, SLAB=0.18;
export const EDGE=HALF+ROAD/2;          // outer edge of the ring road (349)
export const WALK_OUT=EDGE+7;           // outer sidewalk ring (356)
export const RIVER_Z0=376, RIVER_Z1=566, WATER_Y=-2.2, BANK_Y=0;
export const BRIDGE_X=38;               // the bridge continues the road at x=38
export const bc=i=>(i-4)*P;             // block centre
export const rc=k=>(k-4)*P+P/2;         // road centre line between block k and k+1 (k=-1..8)
export const PARKS=[[6,2],[2,6],[2,2],[6,6],[4,7],[7,4],[1,4],[4,1]];
export const isPark=(i,j)=>PARKS.some(p=>p[0]===i&&p[1]===j);
export const PARK_THEME={'6,2':'fair','2,2':'pond','6,6':'fountain','2,6':'lollipop','4,7':'garden','7,4':'garden','1,4':'bandstand','4,1':'garden'};

export function district(i,j){
  if(i===4&&j===4)return 'center';
  if(isPark(i,j))return 'park';
  const ch=Math.max(Math.abs(i-4),Math.abs(j-4));
  if(ch<=1)return 'core';
  if(i<=2&&j<=3)return 'old';
  if(Math.hypot(i-4,j-4)<=2.9)return 'mid';
  return 'res';
}

/* Traffic signal cycle shared by the GPU (light heads) and the CPU (cars).
   axis 0 = traffic moving along x, 1 = along z. returns 0 green, 1 amber, 2 red */
export const SIG_T=26;
export function signal(t,phase,axis){
  const l=((t+phase)%SIG_T+SIG_T)%SIG_T;
  if(axis===0)return l<10?0:l<12.5?1:2;
  return l>=13&&l<23?0:l>=23&&l<25.5?1:2;
}
export const SIGNAL_GLSL=`
float sigState(float t,float phase,float axis){
  float l=mod(t+phase,${SIG_T}.);
  if(axis<.5)return l<10.?0.:l<12.5?1.:2.;
  return (l>=13.&&l<23.)?0.:(l>=23.&&l<25.5)?1.:2.;
}`;
// signals only at interior crossings (k=0..7 on both axes)
export const sigPhase=(kx,kz)=>((kx*7+kz*13)%5)*1.7+((kx+kz)%2)*SIG_T*.5;
