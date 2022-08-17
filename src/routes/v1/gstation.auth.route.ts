import type { Socket } from 'socket.io'
import authController from '@/controllers/auth.controller'

// this is where all applications on the OS will submit request to.
// All are socket requests.

const router = {
  init: (socket: Socket): void => {
    socket.on('auth:info', authController.info)
    socket.on('auth:login', authController.login)
    socket.on('auth:signup', authController.signup)
    socket.on('auth:logout', authController.logout)
    socket.on('auth:passwordAssist', authController.passwordAssist)
  },
}

export default router
