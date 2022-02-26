import type { Socket } from 'socket.io'
import shareController from '@/controllers/share.controller'

const router = {
  init: (socket: Socket): void => {
    socket.on('share:accept', shareController.acceptShare)
    socket.on('share:start', shareController.startSharing)
    socket.on('share:uploadOriginal', shareController.startSharing)
    socket.on('share:willOpenPPT', shareController.willOpenPPT)
  },
}

export default router
