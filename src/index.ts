import app from './app'
import wsGStation from './middlewares/wsio.grand-station'
import wsGardener from './middlewares/wsio.gardener'
import config from './config/config'
import logger from './config/logger'
import { CΩStore } from './services/cA.store'

restoreAuthInfo()

async function restoreAuthInfo() {
  const user = await config.authStore.get('user')
  const tokens = await config.authStore.get('tokens')
  CΩStore.tokens = tokens
  CΩStore.user = user
}

const server = app.listen(config.port, config.host, () => {
  logger.info(`Listening on HTTP ${config.host}:${config.port}`)
})

/* Grand Station websockets connect to api.codeawareness.com */
// wsGStation.init()

/* Gardner websockets listen for request coming from local editors, e.g. VSCode, vim, emacs, etc */
wsGardener.init(server)

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
