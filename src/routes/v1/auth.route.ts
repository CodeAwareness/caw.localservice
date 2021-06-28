import express from 'express'

import authController from '../../controllers/auth.controller'

const router = express.Router()

router.get('/info', authController.info)
router.post('/logout', authController.logout)
router.get('/sync', authController.sync)

export default router
