import { Logger } from '@/shared/logger.ts'
import type { 
  TunnelRequest, 
  TunnelResponse, 
  TunnelError,
  TunnelStreamStart,
  TunnelStreamChunk,
  TunnelStreamEnd,
} from '@/shared/types.ts'
import { formatBytes } from '@/shared/utils.ts'

export class HttpProxyHandler {
  private logger: Logger
  private localHost: string
  private localPort: number
  private requestTimeout: number
  private maxBodySize: number
  private sendMessage: (message: string) => void

  constructor(
    logger: Logger,
    localHost: string,
    localPort: number,
    requestTimeout: number,
    maxBodySize: number,
    sendMessage: (message: string) => void,
  ) {
    this.logger = logger
    this.localHost = localHost
    this.localPort = localPort
    this.requestTimeout = requestTimeout
    this.maxBodySize = maxBodySize
    this.sendMessage = sendMessage
  }

  async handleRequest(reqData: TunnelRequest): Promise<TunnelResponse | TunnelError | void> {
    const startTime = Date.now()

    this.logger.debug('Received HTTP request', {
      requestId: reqData.id,
      method: reqData.method,
      url: reqData.url,
    })

    try {
      const targetUrl = new URL(reqData.url)
      targetUrl.hostname = this.localHost
      targetUrl.port = String(this.localPort)

      this.logger.debug('Proxying to local service', {
        requestId: reqData.id,
        target: targetUrl.href,
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, this.requestTimeout)

      let response: Response
      try {
        const body = reqData.body ? Buffer.from(reqData.body, 'base64') : undefined
        response = await fetch(targetUrl.href, {
          method: reqData.method,
          headers: reqData.headers,
          body,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }

      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })

      const isStreaming = this.shouldUseStreaming(response)

      if (isStreaming) {
        this.logger.info('Starting streaming response', {
          requestId: reqData.id,
          status: response.status,
          contentType: headers['content-type'],
        })
        await this.handleStreamingResponse(reqData.id, response, headers, startTime)
        return
      }

      const body = await response.arrayBuffer()
      const bodySize = body.byteLength

      if (bodySize > this.maxBodySize) {
        throw new Error(
          `Response body exceeds maximum size: ${formatBytes(bodySize)} > ${formatBytes(this.maxBodySize)}`,
        )
      }

      const bodyBase64 = Buffer.from(body).toString('base64')
      const duration = Date.now() - startTime

      this.logger.info('HTTP request proxied successfully', {
        requestId: reqData.id,
        status: response.status,
        bodySize: formatBytes(bodySize),
        duration,
      })

      return {
        id: reqData.id,
        status: response.status,
        headers,
        body: bodyBase64,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Internal proxy error'

      this.logger.error('HTTP proxy error', {
        requestId: reqData.id,
        error: errorMessage,
        duration,
      })

      return {
        id: reqData.id,
        error: errorMessage,
        status: 502,
      }
    }
  }

  private shouldUseStreaming(response: Response): boolean {
    const contentType = response.headers.get('content-type') || ''
    const transferEncoding = response.headers.get('transfer-encoding') || ''
    
    return (
      contentType.includes('text/event-stream') ||
      contentType.includes('application/x-ndjson') ||
      contentType.includes('application/stream+json') ||
      transferEncoding.includes('chunked')
    )
  }

  private async handleStreamingResponse(
    requestId: string,
    response: Response,
    headers: Record<string, string>,
    startTime: number,
  ): Promise<void> {
    const streamStart: TunnelStreamStart = {
      type: 'stream-start',
      id: requestId,
      status: response.status,
      headers,
    }
    const streamStartJson = JSON.stringify(streamStart)
    this.logger.debug('Sending stream-start', { requestId, messageLength: streamStartJson.length })
    this.sendMessage(streamStartJson)

    try {
      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let totalBytes = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        if (value) {
          totalBytes += value.byteLength
          const chunkBase64 = Buffer.from(value).toString('base64')
          
          const streamChunk: TunnelStreamChunk = {
            type: 'stream-chunk',
            id: requestId,
            chunk: chunkBase64,
          }
          this.sendMessage(JSON.stringify(streamChunk))
        }
      }

      const duration = Date.now() - startTime
      this.logger.info('Streaming response completed', {
        requestId,
        totalBytes: formatBytes(totalBytes),
        duration,
      })

      const streamEnd: TunnelStreamEnd = {
        type: 'stream-end',
        id: requestId,
      }
      this.sendMessage(JSON.stringify(streamEnd))
    } catch (error: any) {
      this.logger.error('Streaming error', {
        requestId,
        error: error?.message || 'Unknown error',
      })

      const errorResponse: TunnelError = {
        id: requestId,
        error: error?.message || 'Streaming error',
        status: 502,
      }
      this.sendMessage(JSON.stringify(errorResponse))
    }
  }
}
