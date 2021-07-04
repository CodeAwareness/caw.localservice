import app from '../../app'
import shareController from '../../controllers/share.controller'

const router = {
  init: (): void => {
    const socket = (app as any).rootSocket
    socket.on('share:start', groups => {
      shareController.startSharing(groups)
    })
    socket.on('share:uploadOriginal', data => {
      // data = { fpath, origin }
      shareController.startSharing(data)
    })
    socket.on('share:accept', origin => {
      shareController.acceptShare(origin)
    })
  },
}

export default router
