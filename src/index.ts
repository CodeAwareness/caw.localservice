import app from './app'
import wsEngine from './middlewares/wsio'
import config from './config/config'
import logger from './config/logger'
import { Peer8Store } from './services/peer8.store'

restoreAuthInfo()

async function restoreAuthInfo() {
  const user = await config.authStore.get('user')
  const tokens = await config.authStore.get('tokens')
  Peer8Store.tokens = tokens
  Peer8Store.user = user
}

const server = app.listen(config.port, config.host, () => {
  logger.info(`Listening on HTTP ${config.host}:${config.port}`)
})

wsEngine.init(app)

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

const unexpectedErrorHandler = (error) => {
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
