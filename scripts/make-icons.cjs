// Генерирует иконки приложения (PWA, favicon, apple-touch) в public/icons/.
// Запуск: node scripts/make-icons.cjs (нужен Playwright с Chromium).
const { chromium } = require('playwright');
const fs = require('node:fs');
const html = (size, maskable) => `<!doctype html><html><body style="margin:0;background:transparent"><canvas id="c" width="${size}" height="${size}"></canvas><script>(()=>{
const c=document.getElementById('c'),g=c.getContext('2d'),S=${size},M=${maskable};
g.fillStyle='#0a0e12';g.fillRect(0,0,S,S);
// сетка арены
g.strokeStyle='#14222a';g.lineWidth=Math.max(1,S/256);g.beginPath();for(let i=S/8;i<S;i+=S/8){g.moveTo(i,0);g.lineTo(i,S);g.moveTo(0,i);g.lineTo(S,i)}g.stroke();
const pad=M?S*0.2:S*0.1,len=S*0.16,w=S*0.035;
g.strokeStyle='#ff7547';g.lineWidth=w;g.lineCap='square';
for(const [x,y,sx,sy] of [[pad,pad,1,1],[S-pad,pad,-1,1],[pad,S-pad,1,-1],[S-pad,S-pad,-1,-1]]){g.beginPath();g.moveTo(x+sx*len,y);g.lineTo(x,y);g.lineTo(x,y+sy*len);g.stroke()}
const fs=M?S*0.3:S*0.4;g.font='900 '+fs+'px "DejaVu Sans", Arial, sans-serif';g.textBaseline='middle';
const w1=g.measureText('R').width;const x0=S/2-w1+S*0.01;
g.shadowColor='#62ecd2';g.shadowBlur=S*0.04;g.fillStyle='#eef3ed';g.fillText('R',x0,S*0.53);
g.shadowColor='#ff7547';g.fillStyle='#ff7547';g.fillText('R',x0+w1*0.92,S*0.53);
g.shadowBlur=0;g.fillStyle='#62ecd2';g.fillRect(S/2-S*0.12,S*0.74,S*0.24,Math.max(2,S*0.02));
})();</script></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  const out = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false], ['favicon-32.png', 32, false]];
  for (const [name, size, mask] of out) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(html(size, mask));
    await p.locator('#c').screenshot({ path: `public/icons/${name}`, omitBackground: true });
  }
  await b.close();
  console.log('icons:', fs.readdirSync('public/icons').join(', '));
})();
