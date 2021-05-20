/* @flow */

const express = require('express')

const authRoute       = require('./auth.route')
const userRoute       = require('./user.route')
const repoRoute       = require('./repo.route')
const discussionRoute = require('./discussion.route')

const router: any = express.Router()

router.use('/auth',        authRoute)
router.use('/discussions', discussionRoute)
router.use('/repos',       repoRoute)
router.use('/users',       userRoute)

module.exports = router
