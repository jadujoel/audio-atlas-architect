import { type BuildOptions, build } from 'esbuild'

const options = {
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'esm' as const,
  sourcemap: true,
} as const satisfies BuildOptions

await build({
  ...options,
  entryPoints: ['src/index.ts'],
  external: [
    "ffmpeg-helper",
    "fsevents",
    "source-map-support"
  ]
})

await build({
  ...options,
  entryPoints: ['src/client.ts'],
})

