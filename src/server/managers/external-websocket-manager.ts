import { Logger } from '@/shared/logger.ts'

interface ExternalWebSocket {
  ws: any
  connectionId: string
  serverPort: number
}

export class ExternalWebSocketManager {
  private connections = new Map<string, ExternalWebSocket>()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  add(connectionId: string, ws: any, serverPort: number): void {
    this.connections.set(connectionId, { ws, connectionId, serverPort })
    this.logger.debug('External WebSocket registered', { connectionId, serverPort })
  }

  get(connectionId: string): ExternalWebSocket | undefined {
    return this.connections.get(connectionId)
  }

  remove(connectionId: string): void {
    const conn = this.connections.get(connectionId)
    if (conn) {
      this.connections.delete(connectionId)
      this.logger.debug('External WebSocket removed', { connectionId })
    }
  }

  removeByPort(serverPort: number): string[] {
    const removed: string[] = []
    for (const [id, conn] of this.connections.entries()) {
      if (conn.serverPort === serverPort) {
        try {
          const readyState = conn.ws.readyState
          if (readyState === 0 || readyState === 1) {
            conn.ws.close(1001, 'Tunnel disconnected')
          }
        } catch (error) {
          this.logger.error('Failed to close WebSocket', { connectionId: id, error })
        }
        this.connections.delete(id)
        removed.push(id)
      }
    }
    if (removed.length > 0) {
      this.logger.info('Removed external WebSocket connections for port', {
        serverPort,
        count: removed.length,
      })
    }
    return removed
  }

  sendData(connectionId: string, data: string | Buffer): boolean {
    const conn = this.connections.get(connectionId)
    if (!conn) {
      this.logger.warn('Cannot send data, connection not found', { connectionId })
      return false
    }

    try {
      if (conn.ws.readyState !== 1) {
        this.logger.warn('Cannot send data, WebSocket not open', {
          connectionId,
          readyState: conn.ws.readyState,
        })
        return false
      }

      conn.ws.send(data)
      return true
    } catch (error) {
      this.logger.error('Failed to send to external WebSocket', { connectionId, error })
      this.connections.delete(connectionId)
      return false
    }
  }

  close(connectionId: string, code?: number, reason?: string): void {
    const conn = this.connections.get(connectionId)
    if (conn) {
      try {
        const readyState = conn.ws.readyState
        if (readyState === 0 || readyState === 1) {
          conn.ws.close(code || 1000, reason || 'Normal closure')
        }
      } catch (error) {
        this.logger.error('Failed to close external WebSocket', { connectionId, error })
      }
      this.connections.delete(connectionId)
    }
  }

  closeAll(serverPort?: number): number {
    let count = 0
    for (const [id, conn] of this.connections.entries()) {
      if (serverPort === undefined || conn.serverPort === serverPort) {
        try {
          conn.ws.close(1001, 'Server shutting down')
        } catch (error) {
          this.logger.error('Failed to close WebSocket during cleanup', { connectionId: id, error })
        }
        this.connections.delete(id)
        count++
      }
    }
    return count
  }

  getSize(): number {
    return this.connections.size
  }
}
