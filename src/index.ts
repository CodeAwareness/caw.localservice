import displayRoutes from 'express-routemap'

import app from './app'
import config from './config/config'
import logger from './config/logger'

console.log('STARTING')

const server = app.listen(config.port, config.host, () => {
  displayRoutes(app)
  logger.info(`Listening on ${config.host}:${config.port}`)
})

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
