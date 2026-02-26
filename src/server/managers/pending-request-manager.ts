import { Logger } from '@/shared/logger.ts'

export interface PendingRequest {
  resolve: (response: Response) => void
  timer: Timer
  startTime: number
}

export class PendingRequestManager {
  private pendingRequests = new Map<string, PendingRequest>()
  private logger: Logger
  private requestTimeout: number
  private maxPendingRequests: number

  constructor(logger: Logger, requestTimeout: number, maxPendingRequests: number) {
    this.logger = logger
    this.requestTimeout = requestTimeout
    this.maxPendingRequests = maxPendingRequests

    setInterval(() => this.cleanupOldRequests(), 60000)
  }

  add(requestId: string, pending: PendingRequest): boolean {
    if (this.pendingRequests.size >= this.maxPendingRequests) {
      return false
    }
    this.pendingRequests.set(requestId, pending)
    return true
  }

  get(requestId: string): PendingRequest | undefined {
    return this.pendingRequests.get(requestId)
  }

  has(requestId: string): boolean {
    return this.pendingRequests.has(requestId)
  }

  clear(requestId: string): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timer)
      this.pendingRequests.delete(requestId)
    }
  }

  clearAll(filter?: (id: string, pending: PendingRequest) => boolean): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (!filter || filter(id, pending)) {
        this.clear(id)
      }
    }
  }

  getSize(): number {
    return this.pendingRequests.size
  }

  private cleanupOldRequests(): void {
    const now = Date.now()
    const timeout = this.requestTimeout + 5000

    for (const [id, pending] of this.pendingRequests.entries()) {
      if (now - pending.startTime > timeout) {
        this.logger.warn('Cleaning up stale request', { requestId: id })
        this.clear(id)
      }
    }
  }
}
