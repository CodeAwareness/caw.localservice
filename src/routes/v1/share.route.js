/* @flow */

const express = require('express')

const shareController = require('@/controllers/share.controller')

const router: any = express.Router()

router
  .route('/start')
  .post(shareController.startSharing)

router
  .route('/accept')
  .post(shareController.receiveShared)

router
  .route('/pptContributors')
  .post(shareController.pptContributors)

router
  .route('/diffs')
  .post(shareController.getDiffs)

module.exports = router