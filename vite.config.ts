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
          const query: Record<string, string> = {}
          url.searchParams.forEach((v, k) => { query[k] = v })
          const mod = await server.ssrLoadModule('./api/_og.tsx')
          const handler = mod.default
          await handler({ query, url: req.url }, res)
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
