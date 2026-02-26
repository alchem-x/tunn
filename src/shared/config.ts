export interface ServerConfig {
  bindPort: number
  bindHost: string
  requestTimeout: number
  maxPendingRequests: number
  maxChunkSize: number
  maxBodySize: number
  dataDir: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export interface ClientConfig {
  serverUrl: string
  tunnelId: string
  requestTimeout: number
  maxBodySize: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

function validatePort(port: number, name: string): void {
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name}: ${port}. Must be between 1 and 65535.`)
  }
}

function validateHost(host: string, name: string): void {
  if (!host || host.trim() === '') {
    throw new Error(`Invalid ${name}: cannot be empty.`)
  }
}

export function loadServerConfig(): ServerConfig {
  const bindPort = parseInt(process.env.SERVER_BIND_PORT || '7777')
  const bindHost = process.env.SERVER_BIND_HOST || 'localhost'
  const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000')
  const maxPendingRequests = parseInt(process.env.MAX_PENDING_REQUESTS || '1000')
  const maxChunkSize = parseInt(process.env.MAX_CHUNK_SIZE || '1048576')
  const maxBodySize = parseInt(process.env.MAX_BODY_SIZE || '104857600')
  const defaultDataDir = process.env.HOME ? `${process.env.HOME}/.config/tunn/data` : './data'
  const dataDir = process.env.DATA_DIR || defaultDataDir
  const logLevel = (process.env.LOG_LEVEL || 'info') as ServerConfig['logLevel']

  validatePort(bindPort, 'SERVER_BIND_PORT')
  validateHost(bindHost, 'SERVER_BIND_HOST')

  if (requestTimeout < 1000) {
    throw new Error('REQUEST_TIMEOUT must be at least 1000ms')
  }

  if (maxPendingRequests < 1) {
    throw new Error('MAX_PENDING_REQUESTS must be at least 1')
  }

  return {
    bindPort,
    bindHost,
    requestTimeout,
    maxPendingRequests,
    maxChunkSize,
    maxBodySize,
    dataDir,
    logLevel,
  }
}

export function loadClientConfig(serverUrl?: string): ClientConfig {
  if (!serverUrl) {
    serverUrl = process.env.SERVER_URL
  }

  if (!serverUrl) {
    throw new Error('Server URL is required. Usage: bun run client <server-url>')
  }

  const url = new URL(serverUrl)
  const tunnelId = url.searchParams.get('id')

  if (!tunnelId) {
    throw new Error('Tunnel ID is required in URL query parameter: ?id=<tunnel-id>')
  }

  const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000')
  const maxBodySize = parseInt(process.env.MAX_BODY_SIZE || '104857600')
  const logLevel = (process.env.LOG_LEVEL || 'info') as ClientConfig['logLevel']

  if (requestTimeout < 1000) {
    throw new Error('REQUEST_TIMEOUT must be at least 1000ms')
  }

  return {
    serverUrl,
    tunnelId,
    requestTimeout,
    maxBodySize,
    logLevel,
  }
}
