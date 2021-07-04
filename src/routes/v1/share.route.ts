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

router
  .route('/accept')
  .post(shareController.acceptShare)

router
  .route('/setupReceived')
  .post(shareController.setupReceived)

router
  .route('/getFileOrigin')
  .get(shareController.getFileOrigin)

router
  .route('/getOriginInfo')
  .get(shareController.getOriginInfo)

router
  .route('/diffs')
  .post(shareController.getDiffs)

router
  .route('/willOpenPPT')
  .post(shareController.willOpenPPT)

router
  .route('/checkReceived')
  .get(shareController.checkReceived)

router
  .route('/updateFilename')
  .post(shareController.updateFilename)

router
  .route('/pptContributors')
  .get(shareController.pptContributors)

export default router
