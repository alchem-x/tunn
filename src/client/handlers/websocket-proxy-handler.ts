import { Logger } from '@/shared/logger.ts'
import type {
  WebSocketConnect,
  WebSocketData,
  WebSocketClose,
  WebSocketError,
  WebSocketPing,
  WebSocketPong,
} from '@/shared/types.ts'

interface LocalWebSocketConnection {
  ws: WebSocket
  connectionId: string
  pendingMessages: Array<{ data: string; isBinary: boolean }>
}

export class WebSocketProxyHandler {
  private logger: Logger
  private localHost: string
  private localPort: number
  private connections = new Map<string, LocalWebSocketConnection>()
  private sendMessage: (message: string) => void

  constructor(
    logger: Logger,
    localHost: string,
    localPort: number,
    sendMessage: (message: string) => void,
  ) {
    this.logger = logger
    this.localHost = localHost
    this.localPort = localPort
    this.sendMessage = sendMessage
  }

  handleConnect(data: WebSocketConnect): void {
    const { connectionId, url, headers, protocols } = data

    this.logger.info('Creating WebSocket connection to local service', {
      connectionId,
      url,
      protocols,
    })

    if (this.connections.has(connectionId)) {
      this.logger.warn('Connection already exists', { connectionId })
      return
    }

    try {
      const targetUrl = new URL(url)
      targetUrl.protocol = targetUrl.protocol === 'wss:' ? 'wss:' : 'ws:'
      targetUrl.hostname = this.localHost
      targetUrl.port = String(this.localPort)

      const wsOptions: any = { headers }
      if (protocols && protocols.length > 0) {
        wsOptions.protocols = protocols
      }

      const ws = new WebSocket(targetUrl.href, wsOptions)

      const conn: LocalWebSocketConnection = { 
        ws, 
        connectionId, 
        pendingMessages: [] 
      }
      this.connections.set(connectionId, conn)

      ws.onopen = () => {
        this.logger.info('WebSocket connected to local service', { 
          connectionId,
          url: targetUrl.href,
          pendingCount: conn.pendingMessages.length,
        })
        
        while (conn.pendingMessages.length > 0) {
          const msg = conn.pendingMessages.shift()
          if (msg) {
            try {
              const buffer = Buffer.from(msg.data, 'base64')
              if (msg.isBinary) {
                ws.send(buffer)
              } else {
                ws.send(buffer.toString())
              }
            } catch (error: any) {
              this.logger.error('Failed to send pending message', { connectionId, error })
            }
          }
        }
      }

      ws.onmessage = (event) => {
        const isBinary = event.data instanceof ArrayBuffer || event.data instanceof Blob

        let data: string
        if (isBinary) {
          if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buffer) => {
              data = Buffer.from(buffer).toString('base64')
              this.sendData(connectionId, data, true)
            }).catch((error) => {
              this.logger.error('Failed to process Blob data', { connectionId, error })
              this.sendError(connectionId, 'Failed to process binary data')
            })
            return
          } else {
            data = Buffer.from(event.data).toString('base64')
          }
        } else {
          data = Buffer.from(event.data).toString('base64')
        }

        this.sendData(connectionId, data, isBinary)
      }

      ws.onerror = (error) => {
        this.logger.error('WebSocket error', { connectionId, error })
        this.sendError(connectionId, 'WebSocket error')
        this.connections.delete(connectionId)
      }

      ws.onclose = (event) => {
        this.logger.info('WebSocket closed', {
          connectionId,
          code: event.code,
          reason: event.reason,
        })
        this.connections.delete(connectionId)
        this.sendClose(connectionId, event.code, event.reason)
      }
    } catch (error: any) {
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Failed to create WebSocket'

      this.logger.error('Failed to create WebSocket', { connectionId, error: errorMessage })
      this.sendError(connectionId, errorMessage)
    }
  }

  handleData(data: WebSocketData): void {
    const { connectionId, data: message, isBinary } = data

    const conn = this.connections.get(connectionId)
    if (!conn) {
      this.logger.warn('WebSocket data for unknown connection', { connectionId })
      return
    }

    if (conn.ws.readyState === WebSocket.CONNECTING) {
      this.logger.debug('WebSocket connecting, buffering message', {
        connectionId,
        readyState: conn.ws.readyState,
      })
      conn.pendingMessages.push({ data: message, isBinary })
      return
    }

    if (conn.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket not open, cannot send data', {
        connectionId,
        readyState: conn.ws.readyState,
      })
      return
    }

    try {
      const buffer = Buffer.from(message, 'base64')
      if (isBinary) {
        conn.ws.send(buffer)
      } else {
        conn.ws.send(buffer.toString())
      }
    } catch (error: any) {
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Failed to send WebSocket data'

      this.logger.error('Failed to send WebSocket data', { connectionId, error: errorMessage })
      this.sendError(connectionId, errorMessage)
      this.connections.delete(connectionId)
    }
  }

  handleClose(data: WebSocketClose): void {
    const { connectionId, code, reason } = data

    this.logger.info('Closing WebSocket connection', { connectionId, code, reason })

    const conn = this.connections.get(connectionId)
    if (conn) {
      try {
        if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
          conn.ws.close(code || 1000, reason || 'Normal closure')
        }
      } catch (error: any) {
        this.logger.error('Failed to close WebSocket', { connectionId, error })
      }
      this.connections.delete(connectionId)
    }
  }

  cleanup(): void {
    for (const [connectionId, conn] of this.connections.entries()) {
      try {
        conn.ws.close(1001, 'Client shutting down')
      } catch (error: any) {
        this.logger.error('Failed to close WebSocket during cleanup', { connectionId, error })
      }
    }
    this.connections.clear()
  }

  private sendData(connectionId: string, data: string, isBinary: boolean): void {
    const message: WebSocketData = {
      type: 'ws-data',
      connectionId,
      data,
      isBinary,
    }
    this.sendMessage(JSON.stringify(message))
  }

  private sendClose(connectionId: string, code?: number, reason?: string): void {
    const message: WebSocketClose = {
      type: 'ws-close',
      connectionId,
      code,
      reason,
    }
    this.sendMessage(JSON.stringify(message))
  }

  private sendError(connectionId: string, error: string): void {
    const message: WebSocketError = {
      type: 'ws-error',
      connectionId,
      error,
    }
    this.sendMessage(JSON.stringify(message))
  }

  handlePing(data: WebSocketPing): void {
    const { connectionId } = data

    const conn = this.connections.get(connectionId)
    if (!conn) {
      this.logger.debug('Ping for unknown connection', { connectionId })
      return
    }

    const pong: WebSocketPong = {
      type: 'ws-pong',
      connectionId,
    }
    this.sendMessage(JSON.stringify(pong))
  }
}
