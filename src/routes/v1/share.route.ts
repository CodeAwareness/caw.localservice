import app from '../../app'
import shareController from '../../controllers/share.controller'

const router = {
  init: (): void => {
    const socket = (app as any).rootSocket
    socket.on('share:start', shareController.startSharing)
    socket.on('share:uploadOriginal', shareController.startSharing)
    socket.on('share:accept', shareController.acceptShare)
  },
}

export default router
