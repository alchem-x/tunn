import { Logger } from '@/shared/logger.ts'

export class ConnectionManager {
  private ws?: WebSocket
  private connected = false
  private reconnectAttempts = 0
  private logger: Logger
  private serverUrl: string
  private maxReconnectAttempts: number
  private reconnectDelay: number
  private onMessage: (data: string) => void

  constructor(
    logger: Logger,
    serverUrl: string,
    maxReconnectAttempts: number = 5,
    reconnectDelay: number = 5000,
    onMessage: (data: string) => void,
  ) {
    this.logger = logger
    this.serverUrl = serverUrl
    this.maxReconnectAttempts = maxReconnectAttempts
    this.reconnectDelay = reconnectDelay
    this.onMessage = onMessage
  }

  connect(): void {
    this.logger.info('Connecting to server', { url: this.serverUrl })

    this.ws = new WebSocket(this.serverUrl)

    this.ws.onopen = () => {
      this.connected = true
      this.reconnectAttempts = 0
      this.logger.info('Connected to server')
    }

    this.ws.onmessage = (event) => {
      try {
        this.onMessage(event.data.toString())
      } catch (error) {
        this.logger.error('Error handling message', { error })
      }
    }

    this.ws.onclose = (event) => {
      this.connected = false
      this.logger.warn('Disconnected from server', {
        code: event.code,
        reason: event.reason,
      })

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        this.logger.info('Attempting to reconnect', {
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
        })
        setTimeout(() => this.connect(), this.reconnectDelay)
      } else {
        this.logger.error('Max reconnection attempts reached, exiting')
        process.exit(1)
      }
    }

    this.ws.onerror = (error) => {
      this.logger.error('WebSocket error', { error })
    }
  }

  send(data: string): void {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket is not connected')
    }
    this.ws.send(data)
  }

  isConnected(): boolean {
    return this.connected
  }

  close(code: number = 1000, reason: string = 'Normal closure'): void {
    if (this.ws) {
      this.ws.close(code, reason)
    }
  }
}
