import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function ogDevPlugin(): Plugin {
  return {
    name: 'og-dev',
    configureServer(server) {
      server.middlewares.use('/api/og', async (req, res) => {
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const mod = await server.ssrLoadModule('./api/_og.tsx')
          const handler = mod.default
          const response: Response = handler(new Request(url))
          const buffer = Buffer.from(await response.arrayBuffer())
          res.setHeader('Content-Type', response.headers.get('Content-Type') ?? 'image/png')
          res.setHeader('Cache-Control', response.headers.get('Cache-Control') ?? 'no-cache')
          res.end(buffer)
        } catch (e) {
          console.error('[og-dev]', e)
          res.statusCode = 500
          res.end('OG image generation failed')
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
