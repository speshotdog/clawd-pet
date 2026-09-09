/* Tabletop port: src/clicker-gacha.js layout and src/gacha.js ten-card rows.
 * Original 620ms deal and 95/50ms stagger from gacha-mode-hearthstone.js.
 * Flat rotations and measured clearance replace the overlapping round-29 fan.
 */
window.CeremonyTable = Object.freeze({
  dealDuration:620,
  stagger:count=>count===10?50:95,
  layout(n,{width=innerWidth,height=innerHeight,index=0}={}){
    const phone=width<=600;
    const cw=phone?Math.min(n===1?304:288,width-64):n===1?420*Math.min(width/1440,height/900):Math.min((width-80)/5.55,(height-200)/(n>5?3.15:1.7));
    return Array.from({length:n},(_,i)=>({cw,
      x:phone?(i-index)*(cw+64):n===1?0:((i%5)-(Math.min(n,5)-1)/2)*cw*1.14,
      y:phone?-24:n>5?(Math.floor(i/5)-.5)*cw*1.58-30:-24,rz:0,page:0}));
  }
});
