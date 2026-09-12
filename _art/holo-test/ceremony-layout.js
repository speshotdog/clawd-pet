/* Tabletop port: src/clicker-gacha.js layout and src/gacha.js ten-card rows.
 * Original 620ms deal and 95/50ms stagger from gacha-mode-hearthstone.js.
 * Flat rotations and measured clearance replace the overlapping round-29 fan.
 */
window.CeremonyTable = Object.freeze({
  dealDuration:620,
  stagger:count=>count===10?50:95,
  layout(n,{width=innerWidth,height=innerHeight,index=0}={}){
    const phone=width<=600;
    const smallDesktop=!phone&&width<=1024;
    const cw=phone?Math.min(n===1?304:288,width-64):n===1?Math.max(190,375*Math.min(width/1440,height/900)):smallDesktop?Math.max(n>5?140:170,Math.min(n>5?198:208,(width*.88-32)/5,(height-(n>5?210:148))/(n>5?2.9:1.4))):Math.max(n>5?150:190,Math.min(n>5?198:208,(width*.88-32)/5,(height-(n>5?210:140))/(n>5?3.0:1.7)));
    // 2026-09-13：十連的下限從 190 放到 150、扣掉的邊界從 140 加到 210——960×640（縮 0.75 後 741 高）的殼裡兩排卡會壓到「收下」與提示字
    return Array.from({length:n},(_,i)=>({cw,
      x:phone?(i-index)*(cw+64):n===1?0:((i%5)-(Math.min(n,5)-1)/2)*(cw+Math.max(8,Math.min(cw*.14,(width*.88-5*cw)/4))),
      y:phone?-24:n>5?(Math.floor(i/5)-.5)*(cw*1.4+Math.max(8,Math.min(cw*.18,height-140-cw*2.8))):-24,rz:0,page:0}));
  }
});
