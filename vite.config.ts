import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'

function ogDevPlugin(): Plugin {
  return {
    name: 'og-dev',
    configureServer(server) {
      server.middlewares.use('/api/og', async (req, res) => {
        // Patch fetch to handle file:// URLs (fonts loaded via import.meta.url in SSR)
        const origFetch = globalThis.fetch
        globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
          const href = input instanceof URL ? input.href
            : typeof input === 'string' ? input
            : input.url
          if (href.startsWith('file://')) {
            const buffer = readFileSync(new URL(href))
            return new Response(buffer)
          }
          return origFetch(input, init)
        }) as typeof fetch
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const mod = await server.ssrLoadModule('./api/og.tsx')
          const handler = mod.default
          const response: Response = await handler(new Request(url))
          const buffer = Buffer.from(await response.arrayBuffer())
          res.setHeader('Content-Type', response.headers.get('Content-Type') ?? 'image/png')
          res.setHeader('Cache-Control', response.headers.get('Cache-Control') ?? 'no-cache')
          res.end(buffer)
        } catch (e) {
          console.error('[og-dev]', e)
          res.statusCode = 500
          res.end('OG image generation failed')
        } finally {
          globalThis.fetch = origFetch
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ogDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
