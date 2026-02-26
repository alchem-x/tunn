import type { Server } from 'bun'
import { Logger } from '@/shared/logger.ts'
import type { ClientManager } from '@/server/managers/client-manager.ts'
import type { ExternalWebSocketManager } from '@/server/managers/external-websocket-manager.ts'
import type { WebSocketConnectionManager } from '@/server/managers/websocket-connection-manager.ts'
import type { WebSocketConnect, WebSocketData, WebSocketClose } from '@/shared/types.ts'

export interface WebSocketData_Internal {
  connectionId: string
  serverPort: number
  path: string
  protocols?: string[]
}

export function createWebSocketUpgradeHandler(
  logger: Logger,
  clientManager: ClientManager,
  externalWsManager: ExternalWebSocketManager,
  wsConnectionManager: WebSocketConnectionManager,
  serverPort: number,
) {
  return {
    fetch(req: Request, server: Server<WebSocketData_Internal>): Response | undefined {
      const upgradeHeader = req.headers.get('upgrade')
      if (upgradeHeader?.toLowerCase() === 'websocket') {
        const connectionId = crypto.randomUUID()
        const url = new URL(req.url)
        const path = url.pathname + url.search
        const protocolHeader = req.headers.get('sec-websocket-protocol')
        const protocols = protocolHeader ? protocolHeader.split(',').map(p => p.trim()) : undefined
        
        logger.info('WebSocket upgrade request received', { 
          connectionId, 
          serverPort, 
          path,
          protocols,
          url: req.url,
        })

        const success = server.upgrade(req, {
          data: { 
            connectionId, 
            serverPort, 
            path,
            protocols 
          },
        })

        if (success) {
          logger.info('WebSocket upgrade successful', { connectionId })
          return undefined
        }

        logger.error('WebSocket upgrade failed', { connectionId })
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      return undefined
    },
    websocket: {
      open(ws: any) {
        const data = ws.data as WebSocketData_Internal
        const { connectionId, serverPort: port } = data
        
        logger.info('External WebSocket opened', { connectionId, serverPort: port })
        
        externalWsManager.add(connectionId, ws, port)
        wsConnectionManager.add(connectionId, port)

        const client = clientManager.getClient(port)
        if (!client) {
          logger.error('No tunnel client found for WebSocket', { connectionId, serverPort: port })
          ws.close(1011, 'No tunnel client available')
          externalWsManager.remove(connectionId)
          return
        }

        const connectMsg: WebSocketConnect = {
          type: 'ws-connect',
          connectionId,
          url: `ws://${port}${data.path || '/'}`,
          headers: {},
          protocols: data.protocols,
        }

        try {
          client.ws.send(JSON.stringify(connectMsg))
          logger.debug('Sent ws-connect to client', { connectionId, protocols: data.protocols })
        } catch (error) {
          logger.error('Failed to send WebSocket connect message', {
            connectionId,
            error,
          })
          ws.close(1011, 'Failed to establish tunnel connection')
          externalWsManager.remove(connectionId)
        }
      },
      message(ws: any, message: string | Buffer) {
        const data = ws.data as WebSocketData_Internal
        const { connectionId, serverPort: port } = data

        const client = clientManager.getClient(port)
        if (!client) {
          logger.error('No client for WebSocket message', { connectionId, serverPort: port })
          ws.close(1011, 'Tunnel client disconnected')
          externalWsManager.remove(connectionId)
          return
        }

        const isBinary = message instanceof Buffer
        const messageData = isBinary
          ? message.toString('base64')
          : Buffer.from(message).toString('base64')

        const wsData: WebSocketData = {
          type: 'ws-data',
          connectionId,
          data: messageData,
          isBinary,
        }

        try {
          client.ws.send(JSON.stringify(wsData))
          logger.debug('Forwarded WebSocket message to client', { connectionId, isBinary })
        } catch (error) {
          logger.error('Failed to forward WebSocket message', { connectionId, error })
          ws.close(1011, 'Failed to forward message')
          externalWsManager.remove(connectionId)
        }
      },
      close(ws: any, code: number, reason: string) {
        const data = ws.data as WebSocketData_Internal
        const { connectionId, serverPort: port } = data

        logger.info('External WebSocket closed', { connectionId, code, reason })

        externalWsManager.remove(connectionId)
        wsConnectionManager.remove(connectionId)

        const client = clientManager.getClient(port)
        if (client) {
          const closeMsg: WebSocketClose = {
            type: 'ws-close',
            connectionId,
            code,
            reason,
          }

          try {
            client.ws.send(JSON.stringify(closeMsg))
          } catch (error) {
            logger.error('Failed to send WebSocket close message', { connectionId, error })
          }
        }
      },
    },
  }
}
