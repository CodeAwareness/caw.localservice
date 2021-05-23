/* @flow */

const express = require('express')

const shareController = require('@/controllers/share.controller')

const router: any = express.Router()

router
  .route('/start')
  .post(shareController.splitIntoGroups)

router
  .route('/accept')
  .post(shareController.receiveShared)

module.exports = router
