import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  getAllTunnels,
  getTunnelById,
  createTunnel,
  updateTunnel,
  deleteTunnel,
} from '@/server/db/database.ts'

export function createAPI() {
  const app = new Hono()

  app.use('/*', cors())

  app.get('/api/tunnels', async (c) => {
    try {
      const tunnels = await getAllTunnels()
      return c.json({ success: true, data: tunnels })
    } catch (error: any) {
      return c.json({ success: false, error: error?.message || 'Unknown error' }, 500)
    }
  })

  app.get('/api/tunnels/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const tunnel = await getTunnelById(id)

      if (!tunnel) {
        return c.json({ success: false, error: 'Tunnel not found' }, 404)
      }

      return c.json({ success: true, data: tunnel })
    } catch (error: any) {
      return c.json({ success: false, error: error?.message || 'Unknown error' }, 500)
    }
  })

  app.post('/api/tunnels', async (c) => {
    try {
      const body = await c.req.json()

      if (!body.id || !body.name || !body.localHost || !body.localPort || !body.serverPort) {
        return c.json({ success: false, error: 'Missing required fields' }, 400)
      }

      const tunnel = await createTunnel({
        id: body.id,
        name: body.name,
        localHost: body.localHost,
        localPort: body.localPort,
        serverPort: body.serverPort,
        enabled: body.enabled ?? true,
      })

      return c.json({ success: true, data: tunnel }, 201)
    } catch (error: any) {
      return c.json({ success: false, error: error?.message || 'Unknown error' }, 400)
    }
  })

  app.put('/api/tunnels/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()

      const tunnel = await updateTunnel(id, body)

      if (!tunnel) {
        return c.json({ success: false, error: 'Tunnel not found' }, 404)
      }

      return c.json({ success: true, data: tunnel })
    } catch (error: any) {
      return c.json({ success: false, error: error?.message || 'Unknown error' }, 400)
    }
  })

  app.delete('/api/tunnels/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const success = await deleteTunnel(id)

      if (!success) {
        return c.json({ success: false, error: 'Tunnel not found' }, 404)
      }

      return c.json({ success: true })
    } catch (error: any) {
      return c.json({ success: false, error: error?.message || 'Unknown error' }, 500)
    }
  })

  return app
}
