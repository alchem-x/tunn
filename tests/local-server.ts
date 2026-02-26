const PORT = parseInt(process.env.PORT || '3456')

Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const upgradeHeader = req.headers.get('upgrade')
    if (upgradeHeader?.toLowerCase() === 'websocket') {
      const success = server.upgrade(req)
      if (success) {
        return undefined
      }
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    const url = new URL(req.url)

    if (url.pathname === '/') {
      return new Response('Hello from tunnel!', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    if (url.pathname === '/echo' && req.method === 'POST') {
      const contentType = req.headers.get('Content-Type')
      if (contentType?.includes('application/json')) {
        const body = await req.json()
        return Response.json(body)
      } else {
        const body = await req.text()
        return new Response(body, {
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    }

    if (url.pathname === '/update' && req.method === 'PUT') {
      const body = await req.json()
      return Response.json({ success: true, updated: body })
    }

    if (url.pathname.startsWith('/delete/') && req.method === 'DELETE') {
      const id = url.pathname.split('/')[2]
      return Response.json({ success: true, deletedId: id })
    }

    if (url.pathname === '/headers') {
      const headers: Record<string, string> = {}
      req.headers.forEach((value, key) => {
        headers[key] = value
      })
      return Response.json(headers)
    }

    if (url.pathname === '/large') {
      const largeContent = 'A'.repeat(50000)
      return new Response(largeContent, {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    if (url.pathname === '/long-poll') {
      const delay = parseInt(url.searchParams.get('delay') || '2000')
      await new Promise((resolve) => setTimeout(resolve, delay))
      return Response.json({ message: 'Long polling response', timestamp: Date.now() })
    }

    if (url.pathname === '/sse') {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          
          for (let i = 0; i < 3; i++) {
            const data = `data: Message ${i + 1}\n\n`
            controller.enqueue(encoder.encode(data))
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    if (url.pathname === '/stream') {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          
          for (let i = 0; i < 5; i++) {
            controller.enqueue(encoder.encode(`Chunk ${i + 1}\n`))
            await new Promise((resolve) => setTimeout(resolve, 50))
          }
          
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked',
        },
      })
    }

    return new Response('Not Found', { status: 404 })
  },
  websocket: {
    message(ws, message) {
      ws.send(message)
    },
  },
})

console.log(`Test server running on port ${PORT}`)
