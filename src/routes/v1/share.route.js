/* @flow */

const express = require('express')

const shareController = require('@/controllers/share.controller')

const router: any = express.Router()

router
  .route('/split')
  .post(shareController.splitIntoGroups)

module.exports = router
