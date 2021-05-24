/* @flow */

const express = require('express')

const authRoute       = require('./auth.route')
const userRoute       = require('./user.route')
const repoRoute       = require('./repo.route')
const shareRoute      = require('./share.route')

const router: any = express.Router()

router.use('/auth',        authRoute)
router.use('/repos',       repoRoute)
router.use('/share',       shareRoute)
router.use('/users',       userRoute)

module.exports = router
