// Yönetim panelini panel/dist içine derler. Çalıştırma: npm run panel:build
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// Uygulamanın ortak kodu (src/lib) kendi Firebase kurulumunu (React Native) içe alır; panelde tarayıcı kurulumu kullanılır.
const firebaseForWeb = {
  name: 'firebase-for-web',
  setup(b) {
    b.onResolve({ filter: /^\.\/firebase$/ }, (args) =>
      args.importer.includes(`${path.sep}src${path.sep}lib${path.sep}`) && !args.importer.includes(`${path.sep}panel${path.sep}`)
        ? { path: path.join(here, 'src', 'firebase.ts') }
        : undefined,
    );
  },
};

await build({
  entryPoints: [path.join(here, 'src', 'boot.ts')],
  outdir: dist,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [firebaseForWeb],
  logLevel: 'info',
});

fs.copyFileSync(path.join(here, 'index.html'), path.join(dist, 'index.html'));
fs.copyFileSync(path.join(here, 'style.css'), path.join(dist, 'style.css'));
// Çizgi avatar katmanları: baskı önizlemesinde kapakta kullanılır.
fs.cpSync(path.join(here, '..', 'assets', 'avatar'), path.join(dist, 'avatar'), { recursive: true });
console.log('Panel hazır:', dist);
