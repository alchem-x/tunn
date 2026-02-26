import { Logger } from '@/shared/logger.ts'

interface StreamResponse {
  controller: ReadableStreamDefaultController
  resolve: (response: Response) => void
  startTime: number
  bytesReceived: number
}

export class StreamManager {
  private streams = new Map<string, StreamResponse>()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  createStream(
    requestId: string,
    status: number,
    headers: Record<string, string>,
    resolve: (response: Response) => void,
    startTime: number,
  ): void {
    let controller: ReadableStreamDefaultController
    
    const stream = new ReadableStream({
      start: (ctrl) => {
        controller = ctrl
      },
      cancel: () => {
        this.logger.debug('Stream cancelled by client', { requestId })
        this.streams.delete(requestId)
      },
    })

    this.streams.set(requestId, {
      controller: controller!,
      resolve,
      startTime,
      bytesReceived: 0,
    })

    this.logger.info('Stream created and registered', { 
      requestId, 
      status,
      totalStreams: this.streams.size 
    })

    const responseHeaders = new Headers(headers)
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')

    const response = new Response(stream, {
      status,
      headers: responseHeaders,
    })

    resolve(response)
  }

  writeChunk(requestId: string, chunk: Uint8Array): boolean {
    const stream = this.streams.get(requestId)
    if (!stream) {
      this.logger.warn('Stream not found for chunk', { 
        requestId,
        availableStreams: Array.from(this.streams.keys()),
        totalStreams: this.streams.size,
      })
      return false
    }

    try {
      stream.controller.enqueue(chunk)
      stream.bytesReceived += chunk.byteLength
      return true
    } catch (error) {
      this.logger.error('Failed to write chunk to stream', { requestId, error })
      return false
    }
  }

  endStream(requestId: string): boolean {
    const stream = this.streams.get(requestId)
    if (!stream) {
      this.logger.warn('Stream not found for end', { requestId })
      return false
    }

    try {
      stream.controller.close()
      const duration = Date.now() - stream.startTime
      this.logger.info('Stream completed', {
        requestId,
        bytesReceived: stream.bytesReceived,
        duration,
      })
      this.streams.delete(requestId)
      return true
    } catch (error) {
      this.logger.error('Failed to close stream', { requestId, error })
      this.streams.delete(requestId)
      return false
    }
  }

  errorStream(requestId: string, error: string): boolean {
    const stream = this.streams.get(requestId)
    if (!stream) {
      return false
    }

    try {
      stream.controller.error(new Error(error))
      this.streams.delete(requestId)
      return true
    } catch (err) {
      this.logger.error('Failed to error stream', { requestId, error: err })
      this.streams.delete(requestId)
      return false
    }
  }

  has(requestId: string): boolean {
    return this.streams.has(requestId)
  }

  getSize(): number {
    return this.streams.size
  }

  clearAll(): void {
    for (const [requestId, stream] of this.streams.entries()) {
      try {
        stream.controller.error(new Error('Server shutting down'))
      } catch {}
    }
    this.streams.clear()
    this.logger.info('All streams cleared')
  }
}
