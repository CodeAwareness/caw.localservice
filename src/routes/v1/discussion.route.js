/* @flow */

const express = require('express')
const discussionController = require('@/controllers/discussion.controller')

const router: any = express.Router()

router
  .route('/')
  .get(discussionController.getDiscussions)
  .post(discussionController.comment)

module.exports = router
