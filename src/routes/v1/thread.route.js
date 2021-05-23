/* @flow */

const express = require('express')
const threadController = require('@/controllers/thread.controller')

const router: any = express.Router()

router
  .route('/')
  .get(threadController.getThreads)
  .post(threadController.comment)

module.exports = router
