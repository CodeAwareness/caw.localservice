import logger from '@/logger'

const getThreads: any = data => {
  logger.log('getThreads') // TODO
}

const comment: any = data => {
  logger.log('comment') // TODO
}

const threadController = {
  comment,
  getThreads,
}

export default threadController
