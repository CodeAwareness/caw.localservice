import app from './app'
import https from 'https'
import fs from 'node:fs'
import wsStation from './middlewares/wsio.grandstation'
import wsGardener from './middlewares/wsio.gardener'
import config from './config/config'
import logger from './config/logger'
import { CΩStore } from './services/store'
import os from 'os'

// restoreAuthInfo() // TODO: this is not resolving async, but it should be ok

async function restoreAuthInfo() {
  CΩStore.user = await config.authStore.get('user')
  CΩStore.tokens = await config.authStore.get('tokens')
}

const homedir = os.homedir()
// Nice addin that creates a localhost cert. Thank you Microsoft.
const server = https.createServer(
  {
    key:  fs.readFileSync(`${homedir}/.office-addin-dev-certs/localhost.key`),
    cert: fs.readFileSync(`${homedir}/.office-addin-dev-certs/localhost.crt`),
    ca:   fs.readFileSync(`${homedir}/.office-addin-dev-certs/ca.crt`),
  },
  app as unknown as any,
)

server.listen(config.port, config.host, () => {
  logger.info(`Listening on HTTPS ${config.host}:${config.port}`)
})

// Note: for MacOS / Linux we can use unix pipes: ws+unix:///absolute/path/to/uds_socket
// For Electron based applications we are restricted to using ws://
/* GrandStation websockets listen for request coming from local editors, e.g. VSCode, vim, emacs, etc */
wsStation.init(server)

/* Gardener websocket connects to api.codeawareness.com */
wsGardener.connect({ url: config.SERVER_WSS })

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed')
      process.exit(1)
    })
  } else {
    process.exit(1)
  }
}

const unexpectedErrorHandler = (error: any) => {
  logger.error(error)
  exitHandler()
}

process.on('uncaughtException', unexpectedErrorHandler)
process.on('unhandledRejection', unexpectedErrorHandler)

process.on('SIGTERM', () => {
  logger.info('SIGTERM received')
  if (server) {
    server.close()
  }
})

export default server
