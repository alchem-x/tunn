import { spawn, sleep } from 'bun'
import { fetch } from 'bun'
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

function startServer(scriptPath: string, env: Record<string, string> = {}) {
  return spawn({
    cmd: ['bun', scriptPath],
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  })
}

async function killServer(proc: ReturnType<typeof spawn>) {
  try {
    proc.kill()
  } catch {}
}

describe('Tunnel', () => {
  let localServer: ReturnType<typeof spawn>
  let tunnelServer: ReturnType<typeof spawn>
  let tunnelClient: ReturnType<typeof spawn>

  beforeAll(async () => {
    localServer = startServer('./tests/local-server.ts')
    tunnelServer = startServer('./src/server.ts')
    await sleep(500)
    tunnelClient = startServer('./src/client.ts', {
      SERVER_HOST: 'localhost',
      SERVER_BIND_PORT: '7777',
      SERVER_PORT: '3721',
      LOCAL_HOST: 'localhost',
      LOCAL_PORT: '3000',
    })
    await sleep(3000)
  })

  afterAll(async () => {
    await killServer(tunnelClient)
    await killServer(tunnelServer)
    await killServer(localServer)
  })

  test('basic request forwarding', async () => {
    const response = await fetch('http://127.0.0.1:3721/')
    expect(response.status).toBe(200)
  })
})
