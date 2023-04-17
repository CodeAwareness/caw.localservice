import threadController from '@/controllers/thread.controller'

const router = {
  init: (socket): void => {
    socket.on('threads:get', threadController.getThreads)
    socket.on('threads:comment', threadController.comment)
  },
}

export default router
