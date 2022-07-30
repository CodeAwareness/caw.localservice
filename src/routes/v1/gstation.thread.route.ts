import type { Socket } from 'socket.io'
import threadController from '@/controllers/thread.controller'

const router = {
  init: (socket: Socket): void => {
    socket.on('threads:get', threadController.getThreads)
    socket.on('threads:comment', threadController.comment)
  },
}

export default router
