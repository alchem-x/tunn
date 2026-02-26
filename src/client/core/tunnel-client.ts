import { Logger } from '@/shared/logger.ts'
import type { ClientConfig } from '@/shared/config.ts'
import type { TunnelRequest, TunnelConfig, ApiResponse } from '@/shared/types.ts'
import { isWebSocketConnect, isWebSocketData, isWebSocketClose, isWebSocketPing } from '@/shared/types.ts'
import { ConnectionManager } from '@/client/managers/connection-manager.ts'
import { HttpProxyHandler } from '@/client/handlers/http-proxy-handler.ts'
import { WebSocketProxyHandler } from '@/client/handlers/websocket-proxy-handler.ts'

interface TunnelInfo {
  id: string
  name: string
  localHost: string
  localPort: number
  serverPort: number
}

export class TunnelClient {
  private config: ClientConfig
  private logger: Logger
  private connectionManager: ConnectionManager
  private httpProxyHandler?: HttpProxyHandler
  private wsProxyHandler?: WebSocketProxyHandler
  private connectionTimeout?: Timer
  private tunnelInfo?: TunnelInfo

  constructor(config: ClientConfig) {
    this.config = config
    this.logger = new Logger('Client', config.logLevel)

    this.connectionManager = new ConnectionManager(
      this.logger,
      config.serverUrl,
      5,
      5000,
      (data: string) => this.handleMessage(data),
    )
  }

  async start(): Promise<void> {
    await this.fetchTunnelConfig()

    if (!this.tunnelInfo) {
      throw new Error('Failed to fetch tunnel configuration')
    }

    this.httpProxyHandler = new HttpProxyHandler(
      this.logger,
      this.tunnelInfo.localHost,
      this.tunnelInfo.localPort,
      this.config.requestTimeout,
      this.config.maxBodySize,
      (message: string) => this.connectionManager.send(message),
    )

    this.wsProxyHandler = new WebSocketProxyHandler(
      this.logger,
      this.tunnelInfo.localHost,
      this.tunnelInfo.localPort,
      (message: string) => this.connectionManager.send(message),
    )

    this.connectionManager.connect()

    this.connectionTimeout = setTimeout(() => {
      if (!this.connectionManager.isConnected()) {
        this.logger.error('Connection timeout, exiting')
        process.exit(1)
      }
    }, 10000)

    this.setupSignalHandlers()

    this.logger.info('Tunnel connected', {
      id: this.tunnelInfo.id,
      name: this.tunnelInfo.name,
      localTarget: `${this.tunnelInfo.localHost}:${this.tunnelInfo.localPort}`,
      serverPort: this.tunnelInfo.serverPort,
    })
  }

  private async fetchTunnelConfig(): Promise<void> {
    try {
      const url = new URL(this.config.serverUrl)
      const protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
      const apiUrl = `${protocol}//${url.hostname}:${url.port}/api/tunnels/${this.config.tunnelId}`

      this.logger.info('Fetching tunnel configuration', { apiUrl })

      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch tunnel config: ${response.statusText}`)
      }

      const result = await response.json() as ApiResponse<TunnelConfig>
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid tunnel configuration response')
      }

      const config = result.data
      this.tunnelInfo = {
        id: config.id,
        name: config.name,
        localHost: config.localHost,
        localPort: config.localPort,
        serverPort: config.serverPort,
      }

      this.logger.info('Tunnel configuration fetched', this.tunnelInfo)
    } catch (error: any) {
      this.logger.error('Failed to fetch tunnel configuration', {
        error: error?.message || 'Unknown error',
      })
      throw error
    }
  }

  private async handleMessage(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data)

      if (isWebSocketConnect(parsed)) {
        this.wsProxyHandler?.handleConnect(parsed)
        return
      }

      if (isWebSocketData(parsed)) {
        this.wsProxyHandler?.handleData(parsed)
        return
      }

      if (isWebSocketClose(parsed)) {
        this.wsProxyHandler?.handleClose(parsed)
        return
      }

      if (isWebSocketPing(parsed)) {
        this.wsProxyHandler?.handlePing(parsed)
        return
      }

      const reqData = parsed as TunnelRequest
      const result = await this.httpProxyHandler?.handleRequest(reqData)
      if (result) {
        this.connectionManager.send(JSON.stringify(result))
      }
    } catch (error) {
      this.logger.error('Failed to handle message', { error })
    }
  }

  private setupSignalHandlers(): void {
    const shutdown = (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully`)
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
      }
      this.wsProxyHandler?.cleanup()
      this.connectionManager.close(1000, 'Client shutdown')
      setTimeout(() => process.exit(0), 1000)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  }
}
