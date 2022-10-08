import logger from '@/logger'

const getThreads: any = () => {
  logger.log('getThreads') // TODO
}

const comment: any = () => {
  logger.log('comment') // TODO
}

const threadController = {
  comment,
  getThreads,
}

export default threadController
