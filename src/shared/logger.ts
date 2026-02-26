type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export class Logger {
  private level: LogLevel
  private context: string

  constructor(context: string, level: LogLevel = 'info') {
    this.context = context
    this.level = level
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, any>): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${metaStr}`
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta))
    }
  }

  info(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta))
    }
  }

  warn(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta))
    }
  }

  error(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta))
    }
  }

  time(label: string): void {
    console.time(`[${this.context}] ${label}`)
  }

  timeEnd(label: string): void {
    console.timeEnd(`[${this.context}] ${label}`)
  }
}
