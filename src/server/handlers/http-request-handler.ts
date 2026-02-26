import { Logger } from '@/shared/logger.ts'
import type { 
  TunnelRequest, 
  TunnelResponse, 
  TunnelError,
  TunnelStreamStart,
  TunnelStreamChunk,
  TunnelStreamEnd,
} from '@/shared/types.ts'
import type { ClientManager } from '@/server/managers/client-manager.ts'
import { readFullBody } from '@/shared/utils.ts'
import { PendingRequestManager } from '@/server/managers/pending-request-manager.ts'
import { StreamManager } from '@/server/managers/stream-manager.ts'

export class HttpRequestHandler {
  private logger: Logger
  private clientManager: ClientManager
  private pendingManager: PendingRequestManager
  private streamManager: StreamManager
  private requestTimeout: number
  private maxBodySize: number

  constructor(
    logger: Logger,
    clientManager: ClientManager,
    pendingManager: PendingRequestManager,
    requestTimeout: number,
    maxBodySize: number,
  ) {
    this.logger = logger
    this.clientManager = clientManager
    this.pendingManager = pendingManager
    this.streamManager = new StreamManager(logger)
    this.requestTimeout = requestTimeout
    this.maxBodySize = maxBodySize
  }

  async handleRequest(req: Request, serverPort: number): Promise<Response> {
    const startTime = Date.now()
    const targetClient = this.clientManager.getClient(serverPort)

    if (!targetClient) {
      this.logger.error('No client connected for port', { serverPort })
      return new Response('No client connected', { status: 502 })
    }

    if (this.pendingManager.getSize() >= this.pendingManager['maxPendingRequests']) {
      this.logger.warn('Too many pending requests', { count: this.pendingManager.getSize() })
      return new Response('Too many requests', { status: 429 })
    }

    const requestId = crypto.randomUUID()
    this.logger.debug('Received request', {
      requestId,
      method: req.method,
      url: req.url,
    })

    try {
      const body = await readFullBody(req.body, this.maxBodySize)
      const targetUrl = new URL(req.url || '/', `http://${req.headers.get('host') || 'localhost'}`)

      const tunnelRequest: TunnelRequest = {
        id: requestId,
        method: req.method,
        url: targetUrl.href,
        headers: {},
        body: body ? Buffer.from(body).toString('base64') : undefined,
      }

      req.headers.forEach((value, key) => {
        tunnelRequest.headers[key] = value
      })

      return new Promise<Response>((resolve) => {
        const timer = setTimeout(() => {
          if (this.pendingManager.has(requestId)) {
            this.logger.warn('Request timeout', { requestId })
            this.pendingManager.clear(requestId)
            resolve(new Response('Gateway Timeout', { status: 504 }))
          }
        }, this.requestTimeout)

        const added = this.pendingManager.add(requestId, {
          resolve: (response: Response) => {
            const duration = Date.now() - startTime
            this.logger.info('Request completed', {
              requestId,
              status: response.status,
              duration,
            })
            resolve(response)
          },
          timer,
          startTime,
        })

        if (!added) {
          clearTimeout(timer)
          this.logger.warn('Failed to add request to queue', { requestId })
          resolve(new Response('Too many requests', { status: 429 }))
          return
        }

        try {
          targetClient.ws.send(JSON.stringify(tunnelRequest))
        } catch (error) {
          this.logger.error('Failed to send request to client', { requestId, error })
          this.pendingManager.clear(requestId)
          resolve(new Response('Internal Server Error', { status: 500 }))
        }
      })
    } catch (error) {
      this.logger.error('Failed to process request', { requestId, error })
      return new Response('Bad Request', { status: 400 })
    }
  }

  handleResponse(data: TunnelResponse): void {
    const pending = this.pendingManager.get(data.id)
    if (pending) {
      this.pendingManager.clear(data.id)

      try {
        const body = data.body ? Buffer.from(data.body, 'base64') : null
        const responseHeaders = new Headers(data.headers)

        responseHeaders.delete('content-encoding')
        responseHeaders.delete('transfer-encoding')

        pending.resolve(
          new Response(body, {
            status: data.status,
            headers: responseHeaders,
          }),
        )
      } catch (error) {
        this.logger.error('Failed to create response', { requestId: data.id, error })
        pending.resolve(new Response('Internal Server Error', { status: 500 }))
      }
    } else {
      this.logger.warn('Received response for unknown request', { requestId: data.id })
    }
  }

  handleError(data: TunnelError): void {
    this.logger.error('Received error from client', {
      requestId: data.id,
      error: data.error,
    })
    const pending = this.pendingManager.get(data.id)
    if (pending) {
      this.pendingManager.clear(data.id)
      pending.resolve(
        new Response(data.error || 'Internal Server Error', {
          status: data.status || 500,
        }),
      )
    }
  }

  handleStreamStart(data: TunnelStreamStart): void {
    const pending = this.pendingManager.get(data.id)
    if (!pending) {
      this.logger.warn('Received stream start for unknown request', { requestId: data.id })
      return
    }

    this.logger.debug('Stream started', { requestId: data.id, status: data.status })

    this.streamManager.createStream(
      data.id,
      data.status,
      data.headers,
      pending.resolve,
      pending.startTime,
    )
    
    this.pendingManager.clear(data.id)
  }

  handleStreamChunk(data: TunnelStreamChunk): void {
    if (!this.streamManager.has(data.id)) {
      this.logger.warn('Received stream chunk for unknown stream', { requestId: data.id })
      return
    }

    try {
      const chunk = Buffer.from(data.chunk, 'base64')
      const success = this.streamManager.writeChunk(data.id, chunk)
      if (!success) {
        this.logger.error('Failed to write stream chunk', { requestId: data.id })
      }
    } catch (error) {
      this.logger.error('Failed to decode stream chunk', { requestId: data.id, error })
      this.streamManager.errorStream(data.id, 'Failed to decode chunk')
    }
  }

  handleStreamEnd(data: TunnelStreamEnd): void {
    if (!this.streamManager.has(data.id)) {
      this.logger.warn('Received stream end for unknown stream', { requestId: data.id })
      return
    }

    this.streamManager.endStream(data.id)
  }

  clearRequestsForPort(serverPort: number): void {
    this.pendingManager.clearAll((_, pending) => {
      const client = this.clientManager.getClient(serverPort)
      if (!client) {
        pending.resolve(new Response('Service Unavailable', { status: 503 }))
        return true
      }
      return false
    })
    this.streamManager.clearAll()
  }
}
