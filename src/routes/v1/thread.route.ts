import express from 'express'
import threadController from '@/controllers/thread.controller'

const router = express.Router()

router
  .route('/')
  .get(threadController.getThreads)
  .post(threadController.comment)

export default router
