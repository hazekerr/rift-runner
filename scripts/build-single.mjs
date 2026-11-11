// Собирает dist/ в один самодостаточный HTML: dist-single/rift-runner.html
// Запуск: npm run build:single (после vite build)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_, href) => `<style>${readFileSync(join(dist, href), 'utf8')}</style>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('Остались внешние ассеты');
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/rift-runner.html', html);
console.log('dist-single/rift-runner.html', (html.length / 1024).toFixed(1), 'KB');
