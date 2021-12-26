import express from 'express'
import authController from '../../controllers/auth.controller'

const router: any = express.Router()

router.get('/auth/sync', authController.httpSync)

export default router
