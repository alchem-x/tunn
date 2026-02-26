import { Low } from 'lowdb'
import { DataFile } from 'lowdb/node'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import type { TunnelConfig } from '@/shared/types.ts'

export interface Database {
  tunnels: TunnelConfig[]
}

const defaultData: Database = {
  tunnels: [],
}

let db: Low<Database> | null = null

export async function initDB(dataDir?: string): Promise<Low<Database>> {
  if (db) return db

  const resolvedDataDir = (() => {
    if (dataDir && dataDir.trim() !== '') {
      return dataDir
    }

    const defaultDataDir = process.env.HOME ? `${process.env.HOME}/.config/tunn/data` : './data'
    return process.env.DATA_DIR || defaultDataDir
  })()

  if (!existsSync(resolvedDataDir)) {
    await mkdir(resolvedDataDir, { recursive: true })
  }

  const dbPath = join(resolvedDataDir, 'db.yaml')
  const adapter = new DataFile<Database>(dbPath, {
    parse: (data: string): Database => Bun.YAML.parse(data) as Database,
    stringify: (data: Database) => Bun.YAML.stringify(data, null, 2),
  })
  db = new Low(adapter, defaultData)

  await db.read()
  db.data ||= defaultData

  await db.write()

  return db
}

export function getDB(): Low<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.')
  }
  return db
}

export async function getTunnelById(id: string): Promise<TunnelConfig | undefined> {
  const database = getDB()
  await database.read()
  return database.data.tunnels.find((t) => t.id === id)
}

export async function getAllTunnels(): Promise<TunnelConfig[]> {
  const database = getDB()
  await database.read()
  return database.data.tunnels
}

export async function createTunnel(
  config: Omit<TunnelConfig, 'createdAt' | 'updatedAt'>,
): Promise<TunnelConfig> {
  const database = getDB()
  await database.read()

  const existing = database.data.tunnels.find((t) => t.id === config.id)
  if (existing) {
    throw new Error(`Tunnel with id ${config.id} already exists`)
  }

  const portExists = database.data.tunnels.find((t) => t.serverPort === config.serverPort)
  if (portExists) {
    throw new Error(`Server port ${config.serverPort} is already in use`)
  }

  const now = Date.now()
  const tunnel: TunnelConfig = {
    ...config,
    createdAt: now,
    updatedAt: now,
  }

  database.data.tunnels.push(tunnel)
  await database.write()

  return tunnel
}

export async function updateTunnel(
  id: string,
  updates: Partial<Omit<TunnelConfig, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<TunnelConfig | undefined> {
  const database = getDB()
  await database.read()

  const tunnel = database.data.tunnels.find((t) => t.id === id)
  if (!tunnel) {
    return undefined
  }

  if (updates.serverPort && updates.serverPort !== tunnel.serverPort) {
    const portExists = database.data.tunnels.find(
      (t) => t.id !== id && t.serverPort === updates.serverPort,
    )
    if (portExists) {
      throw new Error(`Server port ${updates.serverPort} is already in use`)
    }
  }

  Object.assign(tunnel, updates, { updatedAt: Date.now() })
  await database.write()

  return tunnel
}

export async function deleteTunnel(id: string): Promise<boolean> {
  const database = getDB()
  await database.read()

  const index = database.data.tunnels.findIndex((t) => t.id === id)
  if (index === -1) {
    return false
  }

  database.data.tunnels.splice(index, 1)
  await database.write()

  return true
}
