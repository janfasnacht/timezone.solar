import { build } from 'esbuild'

await build({
  entryPoints: ['api/_og.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'api/og.js',
  external: ['@vercel/og', 'node:fs', 'node:path'],
  jsx: 'automatic',
  jsxImportSource: 'react',
  banner: { js: '/** Bundled from api/_og.tsx — do not edit directly */' },
})

console.log('✓ api/og.js bundled')

await build({
  entryPoints: ['api/_telemetry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'api/telemetry.js',
  external: ['@vercel/postgres'],
  banner: { js: '/** Bundled from api/_telemetry.ts — do not edit directly */' },
})

console.log('✓ api/telemetry.js bundled')
