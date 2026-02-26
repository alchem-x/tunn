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

const TUNNEL_ID = 'test-tunnel'
const TUNNEL_CONFIG = {
  id: TUNNEL_ID,
  name: 'Test Tunnel (E2E)',
  host: 'localhost',
  port: 3456,
  serverPort: 7321,
}
const SERVER_PORT = 7777

describe('E2E Test', () => {
  let localServer: Subprocess
  let tunnelServer: Subprocess
  let tunnelClient: Subprocess

  beforeAll(async () => {
    await createTestTunnel(TUNNEL_CONFIG)
  })

  afterAll(async () => {
    await killProcess(tunnelClient)
    await killProcess(tunnelServer)
    await killProcess(localServer)
    await deleteTestTunnel(TUNNEL_ID)
  })

  test('should start local test server', async () => {
    localServer = startLocalServer(TUNNEL_CONFIG.port)
    await sleep(1000)
    
    const response = await fetch(`http://localhost:${TUNNEL_CONFIG.port}/`)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('Hello from tunnel!')
  })

  test('should list tunnels via CLI', async () => {
    const { spawn } = await import('bun')
    const proc = spawn({
      cmd: ['bun', 'run', 'src/tunn.ts', 'ls'],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    
    await proc.exited
    expect(proc.exitCode).toBe(0)
  })

  test('should show tunnel details via CLI', async () => {
    const { spawn } = await import('bun')
    const proc = spawn({
      cmd: ['bun', 'run', 'src/tunn.ts', 'show', TUNNEL_ID],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    
    await proc.exited
    expect(proc.exitCode).toBe(0)
  })

  test('should start tunnel server via CLI', async () => {
    tunnelServer = startTunnelServer(SERVER_PORT)
    await sleep(4000)
    
    const response = await fetch(`http://localhost:${SERVER_PORT}/api/tunnels`)
    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean }
    expect(data.success).toBe(true)
  })

  test('should connect tunnel client via CLI', async () => {
    tunnelClient = startTunnelClient(`ws://localhost:${SERVER_PORT}`, TUNNEL_ID)
    await sleep(4000)
  })

  test('should proxy HTTP request through tunnel', async () => {
    await sleep(1000)
    const response = await fetch(`http://localhost:${TUNNEL_CONFIG.serverPort}/`)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('Hello from tunnel!')
  })
})
