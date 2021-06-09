import express from 'express'

import authController from '../../controllers/auth.controller'

const router = express.Router()

router.get('/info', authController.info)
router.post('/login', authController.login)
router.post('/logout', authController.logout)
router.post('/refresh-tokens', authController.refreshTokens)

export default router
