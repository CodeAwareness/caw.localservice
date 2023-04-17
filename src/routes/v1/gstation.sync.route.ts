import type EventEmitter from 'events'
import syncController from '@/controllers/sync.controller'

const router = {
  init: (socket: EventEmitter): void => {
    socket.on('sync:setup', syncController.setup)
  },
}

export default router
