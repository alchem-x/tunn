#!/usr/bin/env bun
import { Command } from 'commander'
import chalk from 'chalk'
import columnify from 'columnify'
import ora from 'ora'
import { format } from 'date-fns'
import {
  initDB,
  createTunnel,
  getAllTunnels,
  deleteTunnel,
  updateTunnel,
  getTunnelById,
} from '@/server/db/database.ts'
import { loadServerConfig, loadClientConfig } from '@/shared/config.ts'
import { TunnelServer } from '@/server/core/tunnel-server.ts'
import { TunnelClient } from '@/client/core/tunnel-client.ts'

const program = new Command()

program
  .name('tunn')
  .description(chalk.cyan('HTTP tunnel service with centralized configuration'))
  .version('2.0.0')

program
  .command('server')
  .description('Start the tunnel server')
  .option('-p, --port <port>', 'Server port', '7777')
  .option('-h, --host <host>', 'Bind host', '0.0.0.0')
  .action(async (options) => {
    process.env.SERVER_BIND_PORT = options.port
    process.env.SERVER_BIND_HOST = options.host

    const spinner = ora('Starting tunnel server...').start()

    try {
      const config = loadServerConfig()
      const server = new TunnelServer(config)
      await server.start()

      spinner.succeed('Tunnel server started successfully!')
      console.log()
      console.log(chalk.bold('  Server Information:'))
      console.log(`  ${chalk.gray('●')} WebSocket: ${chalk.green(`ws://${config.bindHost}:${config.bindPort}/tunn?id=<tunnel-id>`)}`)
      console.log(`  ${chalk.gray('●')} API:       ${chalk.green(`http://${config.bindHost}:${config.bindPort}/api/tunnels`)}`)
      console.log(`  ${chalk.gray('●')} Data:      ${chalk.green(config.dataDir)}`)
      console.log()
      console.log(chalk.gray('  Press Ctrl+C to stop'))
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to start server')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('client')
  .description('Connect a tunnel client to the server')
  .argument('<url>', 'Server URL (ws://host:port/tunn?id=<tunnel-id>)')
  .action(async (url) => {
    const spinner = ora('Connecting to tunnel server...').start()

    try {
      const config = loadClientConfig(url)
      spinner.text = `Fetching tunnel configuration for ${chalk.cyan(config.tunnelId)}...`

      const client = new TunnelClient(config)
      await client.start()

      spinner.succeed(`Tunnel client connected: ${chalk.cyan(config.tunnelId)}`)
      console.log()
      console.log(chalk.bold('  Tunnel Information:'))
      console.log(`  ${chalk.gray('●')} ID:     ${chalk.green(config.tunnelId)}`)
      console.log(`  ${chalk.gray('●')} Server: ${chalk.green(config.serverUrl)}`)
      console.log()
      console.log(chalk.gray('  Press Ctrl+C to disconnect'))
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to connect')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('new')
  .alias('create')
  .description('Create a new tunnel configuration')
  .argument('<id>', 'Tunnel ID (unique identifier)')
  .argument('<name>', 'Tunnel name (display name)')
  .option('-h, --host <host>', 'Local host', 'localhost')
  .option('-p, --port <port>', 'Local port', '3000')
  .option('-s, --server-port <port>', 'Server port', '8080')
  .option('-d, --disabled', 'Create as disabled', false)
  .action(async (id, name, options) => {
    const spinner = ora('Creating tunnel...').start()

    try {
      await initDB()

      const tunnel = await createTunnel({
        id,
        name,
        localHost: options.host,
        localPort: parseInt(options.port),
        serverPort: parseInt(options.serverPort),
        enabled: !options.disabled,
      })

      spinner.succeed('Tunnel created successfully!')
      console.log()
      console.log(chalk.bold('  Tunnel Details:'))
      console.log(`  ${chalk.gray('●')} ID:          ${chalk.cyan(tunnel.id)}`)
      console.log(`  ${chalk.gray('●')} Name:        ${chalk.white(tunnel.name)}`)
      console.log(`  ${chalk.gray('●')} Local:       ${chalk.green(`${tunnel.localHost}:${tunnel.localPort}`)}`)
      console.log(`  ${chalk.gray('●')} Server Port: ${chalk.green(tunnel.serverPort)}`)
      console.log(`  ${chalk.gray('●')} Status:      ${tunnel.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`)
      console.log()
      console.log(chalk.bold('  Connection Command:'))
      console.log(`  ${chalk.gray('$')} ${chalk.cyan(`tunn client 'ws://localhost:7777/tunn?id=${tunnel.id}'`)}`)
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to create tunnel')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('list')
  .alias('ls')
  .description('List all tunnel configurations')
  .option('-a, --all', 'Show all tunnels including disabled', false)
  .action(async (options) => {
    const spinner = ora('Loading tunnels...').start()

    try {
      await initDB()
      let tunnels = await getAllTunnels()

      if (!options.all) {
        tunnels = tunnels.filter((t) => t.enabled)
      }

      spinner.stop()

      if (tunnels.length === 0) {
        console.log(chalk.yellow('  No tunnels found.'))
        console.log()
        console.log(chalk.gray('  Create one with: ') + chalk.cyan('tunn new <id> <name>'))
        console.log()
        return
      }

      console.log()
      console.log(chalk.bold(`  Tunnels (${tunnels.length})`))
      console.log()

      const data = tunnels.map((tunnel) => ({
        Status: tunnel.enabled ? chalk.green('●') : chalk.gray('○'),
        ID: chalk.cyan(tunnel.id),
        Name: chalk.white(tunnel.name),
        Local: chalk.green(`${tunnel.localHost}:${tunnel.localPort}`),
        'Server Port': chalk.green(tunnel.serverPort),
        Created: format(tunnel.createdAt, 'yyyy-MM-dd'),
      }))

      console.log(
        columnify(data, {
          showHeaders: true,
          config: {
            Status: { minWidth: 3 },
            ID: { minWidth: 15 },
            Name: { minWidth: 20 },
          },
        }),
      )
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to load tunnels')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('show')
  .alias('info')
  .description('Show detailed information about a tunnel')
  .argument('<id>', 'Tunnel ID')
  .action(async (id) => {
    const spinner = ora('Loading tunnel...').start()

    try {
      await initDB()
      const tunnel = await getTunnelById(id)

      spinner.stop()

      if (!tunnel) {
        console.log(chalk.yellow(`  Tunnel "${id}" not found.`))
        console.log()
        return
      }

      console.log()
      console.log(chalk.bold(`  Tunnel: ${chalk.cyan(tunnel.id)}`))
      console.log()
      console.log(`  ${chalk.bold('Name:')}         ${tunnel.name}`)
      console.log(`  ${chalk.bold('Status:')}       ${tunnel.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`)
      console.log(`  ${chalk.bold('Local Host:')}   ${tunnel.localHost}`)
      console.log(`  ${chalk.bold('Local Port:')}   ${tunnel.localPort}`)
      console.log(`  ${chalk.bold('Server Port:')}  ${tunnel.serverPort}`)
      console.log(`  ${chalk.bold('Created:')}      ${format(tunnel.createdAt, 'yyyy-MM-dd HH:mm:ss')}`)
      console.log(`  ${chalk.bold('Updated:')}      ${format(tunnel.updatedAt, 'yyyy-MM-dd HH:mm:ss')}`)
      console.log()
      console.log(chalk.bold('  Connection:'))
      console.log(`  ${chalk.gray('$')} ${chalk.cyan(`tunn client 'ws://localhost:7777/tunn?id=${tunnel.id}'`)}`)
      console.log()
      console.log(chalk.bold('  Access URL:'))
      console.log(`  ${chalk.green(`http://localhost:${tunnel.serverPort}`)}`)
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to load tunnel')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('enable')
  .description('Enable a tunnel')
  .argument('<id>', 'Tunnel ID')
  .action(async (id) => {
    const spinner = ora('Enabling tunnel...').start()

    try {
      await initDB()
      const tunnel = await updateTunnel(id, { enabled: true })

      if (!tunnel) {
        spinner.fail(`Tunnel "${id}" not found`)
        process.exit(1)
      }

      spinner.succeed(`Tunnel "${chalk.cyan(id)}" enabled`)
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to enable tunnel')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('disable')
  .description('Disable a tunnel')
  .argument('<id>', 'Tunnel ID')
  .action(async (id) => {
    const spinner = ora('Disabling tunnel...').start()

    try {
      await initDB()
      const tunnel = await updateTunnel(id, { enabled: false })

      if (!tunnel) {
        spinner.fail(`Tunnel "${id}" not found`)
        process.exit(1)
      }

      spinner.succeed(`Tunnel "${chalk.cyan(id)}" disabled`)
      console.log()
    } catch (error: any) {
      spinner.fail('Failed to disable tunnel')
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program
  .command('delete')
  .alias('rm')
  .description('Delete a tunnel configuration')
  .argument('<id>', 'Tunnel ID')
  .option('-f, --force', 'Skip confirmation', false)
  .action(async (id, options) => {
    try {
      await initDB()

      if (!options.force) {
        console.log()
        console.log(chalk.yellow(`  ⚠ Are you sure you want to delete tunnel "${chalk.cyan(id)}"?`))
        console.log(chalk.gray('  Use --force to skip this confirmation'))
        console.log()
        process.exit(0)
      }

      const spinner = ora('Deleting tunnel...').start()

      const success = await deleteTunnel(id)

      if (!success) {
        spinner.fail(`Tunnel "${id}" not found`)
        process.exit(1)
      }

      spinner.succeed(`Tunnel "${chalk.cyan(id)}" deleted`)
      console.log()
    } catch (error: any) {
      console.error(chalk.red(`  Error: ${error?.message || error}`))
      process.exit(1)
    }
  })

program.parse()
