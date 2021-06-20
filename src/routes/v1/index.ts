import express from 'express'

import authRoute from './auth.route'
import userRoute from './user.route'
import repoRoute from './repo.route'
import shareRoute from './share.route'

const router = express.Router()

router.use('/auth',  authRoute)
router.use('/repos', repoRoute)
router.use('/share', shareRoute)
router.use('/users', userRoute)

export default router
