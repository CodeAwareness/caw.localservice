import type { CΩExpress } from '@/app'
import app from '@/app'
import shareController from '@/controllers/share.controller'

const router = {
  init: (): void => {
    const socket = (app as CΩExpress).gardenerSocket
    socket.on('share:start', shareController.startSharing)
    socket.on('share:uploadOriginal', shareController.startSharing)
    socket.on('share:accept', shareController.acceptShare)
  },
}

export default router
