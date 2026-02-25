const SERVER_HOST = process.env.SERVER_HOST!
const SERVER_BIND_PORT = parseInt(process.env.SERVER_BIND_PORT!)
const LOCAL_HOST = process.env.LOCAL_HOST!
const LOCAL_PORT = parseInt(process.env.LOCAL_PORT!)
const SERVER_PORT = parseInt(process.env.SERVER_PORT!)

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
  'x-tunnel-response': boolean
}

const ws = new WebSocket(`ws://${SERVER_HOST}:${SERVER_BIND_PORT}?serverPort=${SERVER_PORT}`)

let connected = false

ws.onopen = () => {
  connected = true
  console.log(`Connected to server ${SERVER_HOST}:${SERVER_BIND_PORT}`)
  console.log(`Tunneling: server:${SERVER_PORT} -> local:${LOCAL_PORT}`)
}

ws.onmessage = async (event) => {
  try {
    const reqData = JSON.parse(event.data.toString()) as TunnelRequest
    console.log(`Received request: ${reqData.method} ${reqData.url}`)

    const targetUrl = new URL(reqData.url)
    targetUrl.hostname = LOCAL_HOST
    targetUrl.port = String(LOCAL_PORT)
    console.log(`Proxying to: ${targetUrl.href}`)

    const response = await fetch(targetUrl.href, {
      method: reqData.method,
      headers: reqData.headers,
      body: reqData.body,
    })

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    headers['x-tunnel-response'] = 'true'

    const body = await response.arrayBuffer()
    const bodyBase64 = Buffer.from(body).toString('base64')

    const resData: TunnelResponse = {
      id: reqData.id,
      status: response.status,
      headers,
      body: bodyBase64,
      'x-tunnel-response': true,
    }

    ws.send(JSON.stringify(resData))
  } catch (e) {
    console.error('Proxy error:', e)
  }
}

ws.onclose = () => {
  console.log('Disconnected, exiting...')
  process.exit(0)
}

ws.onerror = (err) => {
  console.error('WebSocket error:', err)
  console.error('Failed to connect to server, exiting...')
  process.exit(1)
}

setTimeout(() => {
  if (!connected) {
    console.error('Connection timeout, exiting...')
    process.exit(1)
  }
}, 5000)
