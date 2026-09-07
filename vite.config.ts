import { defineConfig, loadEnv } from 'vite'
import dotenv from 'dotenv'

// Load .env into process.env so API handlers (emails.js, zoho-auth.js)
// can access ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, etc. during local dev
dotenv.config()

export default defineConfig(({ mode }) => {
  console.log(">>>> VITE CONFIG LOADED <<<<", mode);
  const env = loadEnv(mode, process.cwd(), '')

  // Helper: build a Vercel-like req/res shim for dev-server middleware
  function makeVercelShim(req: any, body: any, res: any) {
    const vercelReq = {
      method: req.method,
      headers: req.headers,
      body,
      query: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
    }
    const vercelRes = {
      status(code: number) { res.statusCode = code; return this },
      json(data: any) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
        return this
      },
      setHeader(name: string, value: any) { res.setHeader(name, value); return this },
      end(data: any) { res.end(data); return this }
    }
    return { vercelReq, vercelRes }
  }

  // Helper: parse POST/DELETE/PATCH body from raw request
  async function parseBody(req: any): Promise<any> {
    if (req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH') return {}
    return new Promise((resolve) => {
      let data = ''
      req.on('data', (chunk: any) => data += chunk)
      req.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({}) }
      })
    })
  }

  return {
    plugins: [
      {
        name: 'api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {

            // ── /api/emails ───────────────────────────────────────────────
            if (req.url && req.url.startsWith('/api/emails')) {
              const body = await parseBody(req)
              const { vercelReq, vercelRes } = makeVercelShim(req, body, res)
              try {
                const { default: handler } = await import('./api/emails.js')
                await handler(vercelReq, vercelRes)
              } catch (err: any) {
                console.error('Error in /api/emails middleware:', err)
                res.statusCode = 500
                res.end(JSON.stringify({ error: err?.message || String(err) }))
              }
              return
            }

            // ── /api/zoho-auth ────────────────────────────────────────────
            if (req.url && req.url.startsWith('/api/zoho-auth')) {
              const body = await parseBody(req)
              const { vercelReq, vercelRes } = makeVercelShim(req, body, res)
              try {
                const { default: handler } = await import('./api/zoho-auth.js')
                await handler(vercelReq, vercelRes)
              } catch (err: any) {
                console.error('Error in /api/zoho-auth middleware:', err)
                res.statusCode = 500
                res.end(JSON.stringify({ error: err?.message || String(err) }))
              }
              return
            }

            // ── /api/run ──────────────────────────────────────────────────
            if (req.url && req.url.startsWith('/api/run')) {
              const body = await parseBody(req)
              const { vercelReq, vercelRes } = makeVercelShim(req, body, res)
              try {
                const { default: handler } = await import('./api/run.js')
                await handler(vercelReq, vercelRes)
              } catch (err: any) {
                console.error('Error in /api/run middleware:', err)
                res.statusCode = 500
                res.end(JSON.stringify({ error: err?.message || String(err) }))
              }
              return
            }

            // ── /api/questions ────────────────────────────────────────────
            if (req.url && req.url.startsWith('/api/questions')) {
              const body = await parseBody(req)
              const { vercelReq, vercelRes } = makeVercelShim(req, body, res)
              try {
                const { default: handler } = await import('./api/questions.js')
                await handler(vercelReq, vercelRes)
              } catch (err: any) {
                console.error('Error in /api/questions middleware:', err)
                res.statusCode = 500
                res.end(JSON.stringify({ error: err?.message || String(err) }))
              }
              return
            }

            // ── /api/submissions ──────────────────────────────────────────
            if (req.url && req.url.startsWith('/api/submissions')) {
              const body = await parseBody(req)
              const { vercelReq, vercelRes } = makeVercelShim(req, body, res)
              try {
                const { default: handler } = await import('./api/submissions.js')
                await handler(vercelReq, vercelRes)
              } catch (err: any) {
                console.error('Error in /api/submissions middleware:', err)
                res.statusCode = 500
                res.end(JSON.stringify({ error: err?.message || String(err) }))
              }
              return
            }

            next()
          })
        }
      }
    ],
    ssr: {
      noExternal: [
        'monaco-editor',
        'popmotion',
        'style-value-types',
        'unhead',
        '@unhead/vue',
        '@floating-ui/core',
        '@vueuse/core',
        '@slidev/parser',
        '@slidev/client'
      ]
    }
  }
})
