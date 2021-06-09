import express from 'express'

import shareController from '../../controllers/share.controller'

const router = express.Router()

router
  .route('/start')
  .post(shareController.startSharing)

router
  .route('/uploadOriginal')
  .post(shareController.uploadOriginal)

router
  .route('/accept')
  .post(shareController.receiveShared)

router
  .route('/setupReceived')
  .post(shareController.setupReceived)

router
  .route('/fileInfo')
  .get(shareController.fileInfo)

router
  .route('/originInfo')
  .get(shareController.originInfo)

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
