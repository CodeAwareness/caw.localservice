/* @flow */

const express = require('express')

const shareController = require('@/controllers/share.controller')

const router: any = express.Router()

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
  .route('/pptContributors')
  .post(shareController.pptContributors)

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
  .get(shareController.updateFilename)

module.exports = router
