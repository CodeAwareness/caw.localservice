/* @flow */

const express = require('express')
const userController = require('@/controllers/user.controller')

const router: any = express.Router()

router
  .route('/')
  .post(userController.createUser)
  .get(userController.getUsers)

module.exports = router
