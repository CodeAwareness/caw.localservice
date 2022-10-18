import type EventEmitter from 'events'
import shareController from '@/controllers/share.controller'

const router = {
  init: (socket: EventEmitter): void => {
    socket.on('share:accept', shareController.acceptShare)
    socket.on('share:getFileOrigin', shareController.getFileOrigin)
    socket.on('share:downloadPPT', shareController.downloadPPT)
    socket.on('share:start', shareController.startSharing)
    socket.on('share:willOpenPPT', shareController.willOpenPPT)
  },
}

export default router
