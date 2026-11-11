// Прогон кривых экономики RR: node docs/research/econ-sim.mjs
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
let xpTot=0,lvl=1,xpNeed=L=>Math.round(8*Math.pow(L,1.3)),cur=0,scrapBank=0;
console.log('w  T  rate  N   inc  avgPr  buys  reroll0 lvl  HPx   DMGx  reqDPSx');
for(let w=1;w<=20;w++){
 const T=w===10?45:w===20?60:Math.round(20+40*(w-1)/19);
 const rate=1.0+0.22*(w-1); const N=Math.round(rate*T);
 const inc=Math.round(N*1.25*0.85);
 const pr=cl(0.06*(w-2),0,0.45),pe=cl(0.03*(w-5),0,0.25),pl=cl(0.012*(w-8),0,0.08),pc=1-pr-pe-pl;
 const m=1+0.1*(w-1); const avg=(pc*18+pr*36+pe*65+pl*110)*m;
 const rr=Math.ceil(1+0.5*w);
 xpTot+=inc; cur+=inc; while(cur>=xpNeed(lvl)){cur-=xpNeed(lvl);lvl++}
 const hp=(1+0.30*(w-1))*Math.pow(1.04,Math.max(0,w-10));
 const dm=1+0.12*(w-1);
 console.log([w,T,rate.toFixed(2),N,inc,avg.toFixed(0),(inc/avg).toFixed(2),rr,lvl,hp.toFixed(2),dm.toFixed(2),(hp*N/T/1.0).toFixed(1)].join('\t'));
}
console.log('total xp',xpTot);
