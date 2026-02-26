import { Logger } from '@/shared/logger.ts'
import type {
  WebSocketConnect,
  WebSocketData,
  WebSocketClose,
  WebSocketError,
  WebSocketPing,
  WebSocketPong,
} from '@/shared/types.ts'
import type { ClientManager } from '@/server/managers/client-manager.ts'
import { WebSocketConnectionManager } from '@/server/managers/websocket-connection-manager.ts'
import type { ExternalWebSocketManager } from '@/server/managers/external-websocket-manager.ts'

export class WebSocketHandler {
  private logger: Logger
  private clientManager: ClientManager
  private wsConnectionManager: WebSocketConnectionManager
  private externalWsManager: ExternalWebSocketManager

  constructor(
    logger: Logger,
    clientManager: ClientManager,
    wsConnectionManager: WebSocketConnectionManager,
    externalWsManager: ExternalWebSocketManager,
  ) {
    this.logger = logger
    this.clientManager = clientManager
    this.wsConnectionManager = wsConnectionManager
    this.externalWsManager = externalWsManager
  }

  handleConnect(data: WebSocketConnect, serverPort: number): void {
    this.logger.debug('WebSocket connect message forwarded to client', {
      connectionId: data.connectionId,
      url: data.url,
      serverPort,
    })
  }

  handleData(data: WebSocketData): void {
    const conn = this.wsConnectionManager.get(data.connectionId)
    if (!conn) {
      this.logger.warn('WebSocket data for unknown connection', {
        connectionId: data.connectionId,
      })
      return
    }

    this.wsConnectionManager.updateActivity(data.connectionId)

    try {
      const buffer = Buffer.from(data.data, 'base64')
      const success = data.isBinary
        ? this.externalWsManager.sendData(data.connectionId, buffer)
        : this.externalWsManager.sendData(data.connectionId, buffer.toString())

      if (!success) {
        this.logger.warn('Failed to send WebSocket data to external client', {
          connectionId: data.connectionId,
        })
      } else {
        this.logger.debug('Forwarded WebSocket data to external client', {
          connectionId: data.connectionId,
          isBinary: data.isBinary,
        })
      }
    } catch (error) {
      this.logger.error('Failed to process WebSocket data', {
        connectionId: data.connectionId,
        error,
      })
    }
  }

  handleClose(data: WebSocketClose): void {
    this.logger.info('WebSocket close from client', {
      connectionId: data.connectionId,
      code: data.code,
      reason: data.reason,
    })

    this.externalWsManager.close(data.connectionId, data.code, data.reason)
    this.wsConnectionManager.remove(data.connectionId)
  }

  handleError(data: WebSocketError): void {
    this.logger.error('WebSocket error from client', {
      connectionId: data.connectionId,
      error: data.error,
    })

    this.externalWsManager.close(data.connectionId, 1011, data.error)
    this.wsConnectionManager.remove(data.connectionId)
  }

  handlePong(data: WebSocketPong): void {
    this.logger.debug('WebSocket pong received', {
      connectionId: data.connectionId,
    })
    this.wsConnectionManager.updateActivity(data.connectionId)
  }

  sendPing(connectionId: string, serverPort: number): boolean {
    const client = this.clientManager.getClient(serverPort)
    if (!client) {
      return false
    }

    const ping: WebSocketPing = {
      type: 'ws-ping',
      connectionId,
    }

    try {
      client.ws.send(JSON.stringify(ping))
      return true
    } catch (error) {
      this.logger.error('Failed to send ping', { connectionId, error })
      return false
    }
  }

  clearConnectionsForPort(serverPort: number): void {
    const removedInternal = this.wsConnectionManager.removeByPort(serverPort)
    const removedExternal = this.externalWsManager.removeByPort(serverPort)
    
    this.logger.info('Cleared WebSocket connections for port', {
      serverPort,
      internal: removedInternal.length,
      external: removedExternal.length,
    })
  }
}
