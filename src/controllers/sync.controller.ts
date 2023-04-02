import CAWStore from '@/services/store'
import logger from '@/logger'

function setup(data) {
  logger.log('Seting up sync process for client', data.cid)
  this.emit('res:sync:setup')
  CAWStore.wsStation[data.cid] = this
}

const syncController = {
  setup,
}

export default syncController

