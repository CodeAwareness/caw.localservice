import type { CΩExpress } from '@/app'
import app from '@/app'
import threadController from '@/controllers/thread.controller'

const router = {
  init: (): void => {
    const socket = (app as CΩExpress).apiSocket
    socket.on('threads:get', threadController.getThreads)
    socket.on('threads:comment', threadController.comment)
  },
}

export default router
