import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'esm',
  sourcemap: true,
  external: [
    "ffmpeg-helper",
    "fsevents"
  ]
})
