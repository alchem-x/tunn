import { spawn, sleep } from 'bun'
import type { Subprocess } from 'bun'
import { PROJECT_ROOT, TEST_DATA_DIR } from './constants.ts'

export async function killProcess(proc: Subprocess) {
  if (proc?.pid) {
    try {
      await spawn({
        cmd: ['kill', '-9', String(proc.pid)],
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited
    } catch {}
  }
  try {
    proc.kill(9)
    await proc.exited
  } catch {}
}

export interface TunnelConfig {
  id: string
  name: string
  host?: string
  port: number
  serverPort: number
}

export async function createTestTunnel(config: TunnelConfig) {
  const proc = spawn({
    cmd: [
      'bun',
      'run',
      'src/tunn.ts',
      'new',
      config.id,
      config.name,
      '--host',
      config.host || 'localhost',
      '--port',
      String(config.port),
      '--server-port',
      String(config.serverPort),
    ],
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, DATA_DIR: TEST_DATA_DIR },
    cwd: PROJECT_ROOT,
  })
  await proc.exited
  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Failed to create tunnel: ${stderr}`)
  }
}

export async function deleteTestTunnel(tunnelId: string) {
  const proc = spawn({
    cmd: ['bun', 'run', 'src/tunn.ts', 'delete', tunnelId, '--force'],
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, DATA_DIR: TEST_DATA_DIR },
  })
  await proc.exited
}

export function startLocalServer(port: number = 3456) {
  return spawn({
    cmd: ['bun', './tests/local-server.ts'],
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, PORT: String(port) },
  })
}

export function startTunnelServer(port: number = 7777, logLevel: string = 'error') {
  return spawn({
    cmd: ['bun', 'run', 'src/tunn.ts', 'server', '--port', String(port)],
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LOG_LEVEL: logLevel, DATA_DIR: TEST_DATA_DIR },
  })
}

export function startTunnelClient(serverUrl: string, tunnelId: string, logLevel: string = 'error') {
  return spawn({
    cmd: ['bun', 'run', 'src/tunn.ts', 'client', `${serverUrl}/tunn?id=${tunnelId}`],
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LOG_LEVEL: logLevel, DATA_DIR: TEST_DATA_DIR },
  })
}

export { sleep }
