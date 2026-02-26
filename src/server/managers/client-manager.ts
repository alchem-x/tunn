import type { ServerWebSocket } from 'bun'
import { Logger } from '@/shared/logger.ts'
import type { TunnelConfig } from '@/shared/types.ts'

export interface ClientData {
  tunnelId: string
  serverPort: number
}

export interface ClientInfo {
  ws: ServerWebSocket<ClientData>
  config: TunnelConfig
  serverPort: number
  connectedAt: number
}

export class ClientManager {
  private clientsByPort = new Map<number, ClientInfo>()
  private clientsById = new Map<string, ClientInfo>()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  addClient(
    tunnelId: string,
    serverPort: number,
    ws: ServerWebSocket<ClientData>,
    config: TunnelConfig,
  ): void {
    const client: ClientInfo = {
      ws,
      config,
      serverPort,
      connectedAt: Date.now(),
    }

    this.clientsByPort.set(serverPort, client)
    this.clientsById.set(tunnelId, client)

    this.logger.info('Client registered', { tunnelId, serverPort, name: config.name })
  }

  removeClient(serverPort: number): void {
    const client = this.clientsByPort.get(serverPort)
    if (client) {
      this.clientsById.delete(client.config.id)
      this.clientsByPort.delete(serverPort)
      this.logger.info('Client removed', {
        tunnelId: client.config.id,
        serverPort,
        name: client.config.name,
      })
    }
  }

  getClient(serverPort: number): ClientInfo | undefined {
    return this.clientsByPort.get(serverPort)
  }

  getClientById(tunnelId: string): ClientInfo | undefined {
    return this.clientsById.get(tunnelId)
  }

  hasClient(serverPort: number): boolean {
    return this.clientsByPort.has(serverPort)
  }

  hasClientById(tunnelId: string): boolean {
    return this.clientsById.has(tunnelId)
  }

  getAllClients(): ClientInfo[] {
    return Array.from(this.clientsByPort.values())
  }

  getClientCount(): number {
    return this.clientsByPort.size
  }
}
