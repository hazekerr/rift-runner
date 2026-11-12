import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * PWA: после сборки пишет sw.js с уникальной версией и полным списком файлов (офлайн с первого запуска).
 * Новая сборка → новая версия кеша → старый кеш удаляется при активации.
 */
function pwa(): Plugin {
  return {
    name: 'rr-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', './index.html', ...Object.keys(bundle).map((f) => `./${f}`)];
      for (const f of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png']) files.push(`./${f}`);
      const version = `${process.env.npm_package_version ?? '0'}-${Date.now().toString(36)}`;
      const sw = readFileSync('src/sw-template.js', 'utf8').replace("const VERSION = '__VERSION__';", `const VERSION = '${version}';`).replace('const FILES = __FILES__;', `const FILES = ${JSON.stringify([...new Set(files)])};`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [pwa()],
  build: { target: 'es2022', outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
});
