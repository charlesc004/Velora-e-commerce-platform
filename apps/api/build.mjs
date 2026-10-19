import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: Object.keys(manifest.dependencies).filter((name) => name !== '@velora/contracts'),
});
