import { type ServerWebSocket } from 'bun'

const SERVER_BIND_PORT = parseInt(process.env.SERVER_BIND_PORT || '7777')
const SERVER_HOST = process.env.SERVER_HOST || 'localhost'

interface TunnelRequest {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  body?: ArrayBuffer
}

interface TunnelResponse {
  id: string
  status: number
  headers: Record<string, string>
  body?: string
}

interface ClientData {
  serverPort: number
}

interface ClientInfo {
  ws: ServerWebSocket<ClientData>
  serverPort: number
}

const clients = new Map<number, ClientInfo>()
const pendingRequests = new Map<
  string,
  {
    resolve: (response: Response) => void
  }
>()

const httpServers = new Map<number, ReturnType<typeof Bun.serve>>()

const wss = Bun.serve<ClientData>({
  port: SERVER_BIND_PORT,
  fetch(req, server) {
    const url = new URL(req.url || '', `ws://localhost:${SERVER_BIND_PORT}`)
    const serverPort = parseInt(url.searchParams.get('serverPort') || '3721')

    if (clients.has(serverPort)) {
      return new Response('Port already in use', { status: 409 })
    }

    const success = server.upgrade(req, {
      data: { serverPort },
    })

    if (success) return undefined
    return new Response('WebSocket upgrade failed', { status: 400 })
  },
  websocket: {
    open(ws) {
      const { serverPort } = ws.data
      console.log(`Client connected: serverPort=${serverPort}`)

      const httpServer = Bun.serve({
        port: serverPort,
        hostname: SERVER_HOST,
        fetch(req) {
          console.log(`Received request: ${req.method} ${req.url}`)
          const targetClient = clients.get(serverPort)

          if (!targetClient) {
            return new Response('No client connected', { status: 502 })
          }

          const requestId = crypto.randomUUID()
          const targetUrl = new URL(req.url || '/', `http://${req.headers.get('host') || 'localhost'}`)

          const tunnelRequest: TunnelRequest = {
            id: requestId,
            method: req.method,
            url: targetUrl.href,
            headers: {},
          }

          req.headers.forEach((value, key) => {
            tunnelRequest.headers[key] = value
          })

          return new Promise((resolve) => {
            pendingRequests.set(requestId, { resolve })

            const reader = req.body?.getReader()
            if (reader) {
              reader.read().then(({ done, value }) => {
                if (!done && value) {
                  tunnelRequest.body = value.buffer
                }
                targetClient.ws.send(JSON.stringify(tunnelRequest))

                setTimeout(() => {
                  if (pendingRequests.has(requestId)) {
                    pendingRequests.delete(requestId)
                    resolve(new Response('Gateway Timeout', { status: 504 }))
                  }
                }, 30000)
              })
            } else {
              targetClient.ws.send(JSON.stringify(tunnelRequest))

              setTimeout(() => {
                if (pendingRequests.has(requestId)) {
                  pendingRequests.delete(requestId)
                  resolve(new Response('Gateway Timeout', { status: 504 }))
                }
              }, 30000)
            }
          })
        },
      })

      httpServers.set(serverPort, httpServer)
      clients.set(serverPort, { ws, serverPort })
      console.log(`HTTP server started on port ${serverPort}`)
    },
    close(ws) {
      const { serverPort } = ws.data
      console.log(`Client disconnected: serverPort=${serverPort}`)

      httpServers.get(serverPort)?.stop()
      httpServers.delete(serverPort)
      clients.delete(serverPort)
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message.toString()) as TunnelResponse

        if (data.headers['x-tunnel-response']) {
          const pending = pendingRequests.get(data.id)
          if (pending) {
            pendingRequests.delete(data.id)
            const body = data.body ? new Blob([Buffer.from(data.body, 'base64')]).stream() : null
            const responseHeaders = { ...data.headers }
            delete responseHeaders['content-encoding']
            delete responseHeaders['x-tunnel-response']
            pending.resolve(
              new Response(body, {
                status: data.status,
                headers: responseHeaders,
              }),
            )
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    },
  },
})

console.log(`Server running:`)
console.log(`- WebSocket on ${wss.port}`)
console.log(`- HTTP servers will start when clients connect`)
