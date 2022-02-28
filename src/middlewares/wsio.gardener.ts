import logger from '@/logger'

function auth() {
  // tcClient.setToken(CΩStore.tokens?.access?.token)
}

function connect(options) {
  logger.log('Gardener connect. Options: ', options)
}

function transmit(cmd: string, data?: any) {
  logger.log('Gardener transmit', cmd, data)
}

const tcClient = {
  auth,
  connect,
  transmit,
}

export default tcClient
