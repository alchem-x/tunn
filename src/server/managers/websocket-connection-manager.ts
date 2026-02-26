import { Logger } from '@/shared/logger.ts'

export interface WebSocketConnection {
  connectionId: string
  serverPort: number
  lastActivity: number
  lastPing?: number
  missedPongs: number
}

export class WebSocketConnectionManager {
  private connections = new Map<string, WebSocketConnection>()
  private logger: Logger
  private pingCallback?: (connectionId: string, serverPort: number) => boolean
  private cleanupInterval?: Timer
  private pingInterval?: Timer

  constructor(logger: Logger) {
    this.logger = logger
    this.cleanupInterval = setInterval(() => this.cleanupInactive(), 60000)
  }

  setPingCallback(callback: (connectionId: string, serverPort: number) => boolean): void {
    this.pingCallback = callback
    if (!this.pingInterval) {
      this.pingInterval = setInterval(() => this.sendPings(), 30000)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }
  }

  add(connectionId: string, serverPort: number): void {
    this.connections.set(connectionId, {
      connectionId,
      serverPort,
      lastActivity: Date.now(),
      missedPongs: 0,
    })
    this.logger.debug('WebSocket connection registered', { connectionId, serverPort })
  }

  get(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId)
  }

  updateActivity(connectionId: string): void {
    const conn = this.connections.get(connectionId)
    if (conn) {
      conn.lastActivity = Date.now()
      conn.missedPongs = 0
    }
  }

  remove(connectionId: string): void {
    const conn = this.connections.get(connectionId)
    if (conn) {
      this.connections.delete(connectionId)
      this.logger.debug('WebSocket connection removed', { connectionId })
    }
  }

  removeByPort(serverPort: number): string[] {
    const removed: string[] = []
    for (const [id, conn] of this.connections.entries()) {
      if (conn.serverPort === serverPort) {
        this.connections.delete(id)
        removed.push(id)
      }
    }
    if (removed.length > 0) {
      this.logger.info('Removed WebSocket connections for port', {
        serverPort,
        count: removed.length,
      })
    }
    return removed
  }

  getSize(): number {
    return this.connections.size
  }

  private sendPings(): void {
    if (!this.pingCallback) return

    const now = Date.now()
    const pingInterval = 30000

    for (const [id, conn] of this.connections.entries()) {
      if (!conn.lastPing || now - conn.lastPing > pingInterval) {
        const success = this.pingCallback(id, conn.serverPort)
        if (success) {
          conn.lastPing = now
          conn.missedPongs++
          
          if (conn.missedPongs > 3) {
            this.logger.warn('WebSocket connection not responding to pings', {
              connectionId: id,
              missedPongs: conn.missedPongs,
            })
            this.connections.delete(id)
          }
        }
      }
    }
  }

  private cleanupInactive(): void {
    const now = Date.now()
    const timeout = 5 * 60 * 1000

    for (const [id, conn] of this.connections.entries()) {
      if (now - conn.lastActivity > timeout) {
        this.logger.warn('Cleaning up inactive WebSocket connection', {
          connectionId: id,
          inactiveFor: now - conn.lastActivity,
        })
        this.connections.delete(id)
      }
    }
  }
}
