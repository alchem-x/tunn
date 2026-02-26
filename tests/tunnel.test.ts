import type { Subprocess } from 'bun'
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import {
  killProcess,
  createTestTunnel,
  deleteTestTunnel,
  startLocalServer,
  startTunnelServer,
  startTunnelClient,
  sleep,
} from './test-utils.ts'

const TUNNEL_ID = 'test-tunnel-unit'
const TUNNEL_CONFIG = {
  id: TUNNEL_ID,
  name: 'Test Tunnel (Unit)',
  host: 'localhost',
  port: 3456,
  serverPort: 7322,
}
const SERVER_PORT = 7787

describe('Tunnel', () => {
  let localServer: Subprocess
  let tunnelServer: Subprocess
  let tunnelClient: Subprocess

  beforeAll(async () => {
    await createTestTunnel(TUNNEL_CONFIG)

    localServer = startLocalServer(TUNNEL_CONFIG.port)
    await sleep(1000)

    tunnelServer = startTunnelServer(SERVER_PORT)
    await sleep(4000)

    tunnelClient = startTunnelClient(`ws://localhost:${SERVER_PORT}`, TUNNEL_ID)
    await sleep(4000)
  }, 15000)

  afterAll(async () => {
    await killProcess(tunnelClient)
    await killProcess(tunnelServer)
    await killProcess(localServer)
    await deleteTestTunnel(TUNNEL_ID)
  })

  test('basic GET request forwarding', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/`)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('Hello from tunnel!')
  })

  test('GET request with query parameters', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/?test=value&foo=bar`)
    expect(response.status).toBe(200)
  })

  test('POST request with body', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test data' }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ message: 'test data' })
  })

  test('PUT request', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, value: 'updated' }),
    })
    expect(response.status).toBe(200)
  })

  test('DELETE request', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/delete/123`, {
      method: 'DELETE',
    })
    expect(response.status).toBe(200)
  })

  test('request with custom headers', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/headers`, {
      headers: {
        'X-Custom-Header': 'test-value',
        'User-Agent': 'TestClient/1.0',
      },
    })
    expect(response.status).toBe(200)
    const data = (await response.json()) as Record<string, string>
    expect(data['x-custom-header']).toBe('test-value')
  })

  test('concurrent requests', async () => {
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/?req=${i}`))
    }
    const responses = await Promise.all(promises)
    responses.forEach((response) => {
      expect(response.status).toBe(200)
    })
  })

  test('404 error forwarding', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/nonexistent`)
    expect(response.status).toBe(404)
  })

  test('large response body', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/large`)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text.length).toBeGreaterThan(1000)
  })

  test('POST with large body', async () => {
    const largeData = 'x'.repeat(10000)
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: largeData,
    })
    expect(response.status).toBe(200)
    const data = await response.text()
    expect(data).toBe(largeData)
  })

  test('long polling with 2s delay', async () => {
    const startTime = Date.now()
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/long-poll?delay=2000`)
    const duration = Date.now() - startTime

    expect(response.status).toBe(200)
    const data = (await response.json()) as { message: string }
    expect(data.message).toBe('Long polling response')
    expect(duration).toBeGreaterThanOrEqual(2000)
  })

  test('long polling with 5s delay', async () => {
    const startTime = Date.now()
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/long-poll?delay=5000`)
    const duration = Date.now() - startTime

    expect(response.status).toBe(200)
    const data = (await response.json()) as { message: string }
    expect(data.message).toBe('Long polling response')
    expect(duration).toBeGreaterThanOrEqual(5000)
  }, 10000)

  test('WebSocket connection and echo', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TUNNEL_CONFIG.serverPort}/`)
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket test timeout'))
      }, 5000)

      ws.onopen = () => {
        ws.send('Hello WebSocket')
      }

      ws.onmessage = (event) => {
        clearTimeout(timeout)
        expect(String(event.data)).toBe('Hello WebSocket')
        ws.close()
        resolve()
      }

      ws.onerror = (error) => {
        clearTimeout(timeout)
        ws.close()
        reject(error)
      }
    })
  })

  test('WebSocket multiple messages', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TUNNEL_CONFIG.serverPort}/`)
      const messages = ['msg1', 'msg2', 'msg3']
      const received: string[] = []
      let sendIndex = 0

      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket test timeout'))
      }, 5000)

      ws.onopen = () => {
        ws.send(messages[sendIndex++]!)
      }

      ws.onmessage = (event) => {
        received.push(String(event.data))

        if (sendIndex < messages.length) {
          ws.send(messages[sendIndex++]!)
        } else {
          clearTimeout(timeout)
          expect(received).toEqual(messages)
          ws.close()
          resolve()
        }
      }

      ws.onerror = (error) => {
        clearTimeout(timeout)
        ws.close()
        reject(error)
      }
    })
  })

  test('Server-Sent Events (SSE)', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/sse`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    if (!reader) return

    const decoder = new TextDecoder()
    let receivedData = ''
    let chunkCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (value) {
        receivedData += decoder.decode(value, { stream: true })
        chunkCount++
      }
    }

    expect(receivedData).toContain('data: Message 1')
    expect(receivedData).toContain('data: Message 2')
    expect(receivedData).toContain('data: Message 3')
    expect(chunkCount).toBeGreaterThan(0)
  })

  test('Streaming response', async () => {
    const response = await fetch(`http://127.0.0.1:${TUNNEL_CONFIG.serverPort}/stream`)
    expect(response.status).toBe(200)

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    if (!reader) return

    const decoder = new TextDecoder()
    let receivedData = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (value) {
        receivedData += decoder.decode(value, { stream: true })
      }
    }

    expect(receivedData).toContain('Chunk 1')
    expect(receivedData).toContain('Chunk 2')
    expect(receivedData).toContain('Chunk 3')
    expect(receivedData).toContain('Chunk 4')
    expect(receivedData).toContain('Chunk 5')
  })
})
