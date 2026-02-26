export interface TunnelConfig {
  id: string
  name: string
  localHost: string
  localPort: number
  serverPort: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface TunnelRequest {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export interface TunnelResponse {
  id: string
  status: number
  headers: Record<string, string>
  body?: string
}

export interface TunnelChunk {
  id: string
  chunk: string
  isLast: boolean
}

export interface TunnelStreamStart {
  type: 'stream-start'
  id: string
  status: number
  headers: Record<string, string>
}

export interface TunnelStreamChunk {
  type: 'stream-chunk'
  id: string
  chunk: string
}

export interface TunnelStreamEnd {
  type: 'stream-end'
  id: string
}

export interface TunnelError {
  id: string
  error: string
  status: number
}

export interface WebSocketConnect {
  type: 'ws-connect'
  connectionId: string
  url: string
  headers: Record<string, string>
  protocols?: string[]
}

export interface WebSocketData {
  type: 'ws-data'
  connectionId: string
  data: string
  isBinary: boolean
}

export interface WebSocketClose {
  type: 'ws-close'
  connectionId: string
  code?: number
  reason?: string
}

export interface WebSocketError {
  type: 'ws-error'
  connectionId: string
  error: string
}

export interface WebSocketPing {
  type: 'ws-ping'
  connectionId: string
}

export interface WebSocketPong {
  type: 'ws-pong'
  connectionId: string
}

export type TunnelMessage =
  | TunnelRequest
  | TunnelResponse
  | TunnelChunk
  | TunnelError
  | TunnelStreamStart
  | TunnelStreamChunk
  | TunnelStreamEnd
  | WebSocketConnect
  | WebSocketData
  | WebSocketClose
  | WebSocketError
  | WebSocketPing
  | WebSocketPong

export function isTunnelResponse(msg: unknown): msg is TunnelResponse {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    !('type' in msg) &&
    'id' in msg &&
    'status' in msg &&
    'headers' in msg
  )
}

export function isTunnelError(msg: unknown): msg is TunnelError {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    !('type' in msg) &&
    'id' in msg &&
    'error' in msg &&
    'status' in msg
  )
}

export function isTunnelChunk(msg: unknown): msg is TunnelChunk {
  return msg !== null && typeof msg === 'object' && 'chunk' in msg && 'isLast' in msg
}

export function isWebSocketConnect(msg: unknown): msg is WebSocketConnect {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'ws-connect'
}

export function isWebSocketData(msg: unknown): msg is WebSocketData {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'ws-data'
}

export function isWebSocketClose(msg: unknown): msg is WebSocketClose {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'ws-close'
}

export function isWebSocketError(msg: unknown): msg is WebSocketError {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'ws-error'
}

export function isWebSocketPing(msg: unknown): msg is WebSocketPing {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'ws-ping'
}

export function isWebSocketPong(msg: unknown): msg is WebSocketPong {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'ws-pong'
}

export function isTunnelStreamStart(msg: unknown): msg is TunnelStreamStart {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'stream-start'
}

export function isTunnelStreamChunk(msg: unknown): msg is TunnelStreamChunk {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'stream-chunk'
}

export function isTunnelStreamEnd(msg: unknown): msg is TunnelStreamEnd {
  return msg !== null && typeof msg === 'object' && 'type' in msg && msg.type === 'stream-end'
}
