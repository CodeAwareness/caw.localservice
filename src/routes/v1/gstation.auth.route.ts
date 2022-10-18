import type EventEmitter from 'events'
import authController from '@/controllers/auth.controller'

const router = {
  init: (socket: EventEmitter): void => {
    socket.on('auth:info', authController.info)
    socket.on('auth:login', authController.login)
    socket.on('auth:signup', authController.signup)
    socket.on('auth:logout', authController.logout)
  },
}

export default router
