import type { ServerWebSocket } from 'bun'
import { Logger } from '@/shared/logger.ts'
import type { ServerConfig } from '@/shared/config.ts'
import {
  isTunnelResponse,
  isTunnelError,
  isTunnelStreamStart,
  isTunnelStreamChunk,
  isTunnelStreamEnd,
  isWebSocketData,
  isWebSocketClose,
  isWebSocketError,
  isWebSocketPong,
} from '@/shared/types.ts'
import { ClientManager, type ClientData } from '@/server/managers/client-manager.ts'
import { PendingRequestManager } from '@/server/managers/pending-request-manager.ts'
import { HttpRequestHandler } from '@/server/handlers/http-request-handler.ts'
import { WebSocketConnectionManager } from '@/server/managers/websocket-connection-manager.ts'
import { WebSocketHandler } from '@/server/handlers/websocket-handler.ts'
import { ExternalWebSocketManager } from '@/server/managers/external-websocket-manager.ts'
import { createWebSocketUpgradeHandler, type WebSocketData_Internal } from '@/server/handlers/websocket-upgrade-handler.ts'
import { initDB, getTunnelById } from '@/server/db/database.ts'
import { createAPI } from '@/server/api/routes.ts'

export class TunnelServer {
  private config: ServerConfig
  private logger: Logger
  private clientManager: ClientManager
  private pendingManager: PendingRequestManager
  private httpRequestHandler: HttpRequestHandler
  private wsConnectionManager: WebSocketConnectionManager
  private externalWsManager: ExternalWebSocketManager
  private wsHandler: WebSocketHandler
  private httpServers = new Map<number, ReturnType<typeof Bun.serve>>()
  private server?: ReturnType<typeof Bun.serve>

  constructor(config: ServerConfig) {
    this.config = config
    this.logger = new Logger('Server', config.logLevel)
    this.clientManager = new ClientManager(this.logger)
    this.pendingManager = new PendingRequestManager(
      this.logger,
      config.requestTimeout,
      config.maxPendingRequests,
    )
    this.httpRequestHandler = new HttpRequestHandler(
      this.logger,
      this.clientManager,
      this.pendingManager,
      config.requestTimeout,
      config.maxBodySize,
    )
    this.wsConnectionManager = new WebSocketConnectionManager(this.logger)
    this.externalWsManager = new ExternalWebSocketManager(this.logger)
    this.wsHandler = new WebSocketHandler(
      this.logger,
      this.clientManager,
      this.wsConnectionManager,
      this.externalWsManager,
    )

    this.wsConnectionManager.setPingCallback(
      (connectionId: string, serverPort: number) => this.wsHandler.sendPing(connectionId, serverPort),
    )
  }

  async start(): Promise<void> {
    await initDB(this.config.dataDir)
    this.logger.info('Database initialized', { dataDir: this.config.dataDir })

    const api = createAPI()

    this.server = Bun.serve<ClientData>({
      hostname: this.config.bindHost,
      port: this.config.bindPort,
      fetch: (req, server) => {
        const url = new URL(req.url || '/', `http://localhost`)
        
        if (url.pathname === '/tunn') {
          return this.handleWebSocketUpgrade(req, server)
        }
        
        if (url.pathname.startsWith('/api/')) {
          return api.fetch(req)
        }
        
        return new Response('Not Found', { status: 404 })
      },
      websocket: {
        open: (ws) => this.handleClientConnect(ws),
        close: (ws) => this.handleClientDisconnect(ws),
        message: (ws, message) => this.handleClientMessage(ws, message),
      },
    })

    this.logger.info('Server running', {
      port: this.server.port,
      bindHost: this.config.bindHost,
      endpoints: {
        websocket: `ws://${this.config.bindHost}:${this.server.port}/tunn?id=<tunnel-id>`,
        api: `http://${this.config.bindHost}:${this.server.port}/api/tunnels`,
      },
    })
  }

  private async handleWebSocketUpgrade(req: Request, server: any): Promise<Response | undefined> {
    const url = new URL(req.url || '/', `http://localhost`)
    
    if (url.pathname === '/tunn') {
      const tunnelId = url.searchParams.get('id')

      if (!tunnelId) {
        return new Response('Missing tunnel ID parameter', { status: 400 })
      }

      const config = await getTunnelById(tunnelId)
      if (!config) {
        return new Response('Tunnel not found', { status: 404 })
      }

      if (!config.enabled) {
        return new Response('Tunnel is disabled', { status: 403 })
      }

      if (this.clientManager.hasClient(config.serverPort)) {
        return new Response('Tunnel already connected', { status: 409 })
      }

      const success = server.upgrade(req, {
        data: { tunnelId, serverPort: config.serverPort },
      })

      if (success) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    return new Response('Not Found', { status: 404 })
  }

  private async handleClientConnect(ws: ServerWebSocket<ClientData>): Promise<void> {
    const { tunnelId, serverPort } = ws.data
    
    const config = await getTunnelById(tunnelId)
    if (!config) {
      this.logger.error('Tunnel config not found during connect', { tunnelId })
      ws.close(1011, 'Tunnel config not found')
      return
    }

    this.logger.info('Client connected', { tunnelId, serverPort, name: config.name })

    try {
      const wsUpgradeHandler = createWebSocketUpgradeHandler(
        this.logger,
        this.clientManager,
        this.externalWsManager,
        this.wsConnectionManager,
        serverPort,
      )

      const httpServer = Bun.serve<WebSocketData_Internal>({
        port: serverPort,
        hostname: this.config.bindHost,
        fetch: (req, server) => {
          const wsResponse = wsUpgradeHandler.fetch(req, server)
          if (wsResponse !== undefined) {
            return wsResponse
          }
          return this.httpRequestHandler.handleRequest(req, serverPort)
        },
        websocket: wsUpgradeHandler.websocket,
      })

      this.httpServers.set(serverPort, httpServer)
      this.clientManager.addClient(tunnelId, serverPort, ws, config)
      this.logger.info('HTTP server started', { 
        tunnelId, 
        serverPort, 
        name: config.name,
        localTarget: `${config.localHost}:${config.localPort}`,
      })
    } catch (error) {
      this.logger.error('Failed to start HTTP server', { tunnelId, serverPort, error })
      ws.close(1011, 'Failed to start HTTP server')
    }
  }

  private handleClientDisconnect(ws: ServerWebSocket<ClientData>): void {
    const { serverPort } = ws.data
    this.logger.info('Client disconnected', { serverPort })

    try {
      this.httpServers.get(serverPort)?.stop()
      this.httpServers.delete(serverPort)
      this.httpRequestHandler.clearRequestsForPort(serverPort)
      this.wsHandler.clearConnectionsForPort(serverPort)
      this.clientManager.removeClient(serverPort)
    } catch (error) {
      this.logger.error('Error during cleanup', { serverPort, error })
    }
  }

  private handleClientMessage(ws: ServerWebSocket<ClientData>, message: string | Buffer): void {
    try {
      const messageStr = message.toString()
      const data = JSON.parse(messageStr)

      if (isTunnelError(data)) {
        this.httpRequestHandler.handleError(data)
        return
      }

      if (isTunnelResponse(data)) {
        this.httpRequestHandler.handleResponse(data)
        return
      }

      if (isTunnelStreamStart(data)) {
        this.httpRequestHandler.handleStreamStart(data)
        return
      }

      if (isTunnelStreamChunk(data)) {
        this.httpRequestHandler.handleStreamChunk(data)
        return
      }

      if (isTunnelStreamEnd(data)) {
        this.httpRequestHandler.handleStreamEnd(data)
        return
      }

      if (isWebSocketData(data)) {
        this.wsHandler.handleData(data)
        return
      }

      if (isWebSocketClose(data)) {
        this.wsHandler.handleClose(data)
        return
      }

      if (isWebSocketError(data)) {
        this.wsHandler.handleError(data)
        return
      }

      if (isWebSocketPong(data)) {
        this.wsHandler.handlePong(data)
        return
      }

      this.logger.warn('Received unknown message type', { data })
    } catch (error) {
      this.logger.error('Failed to parse message', { error })
    }
  }
}
