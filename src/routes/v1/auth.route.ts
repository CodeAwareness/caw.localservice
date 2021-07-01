import app from '../../app'
import authController from '../../controllers/auth.controller'

const router = {
  init: (): void => {
    const socket = (app as any).rootSocket
    socket.on('auth:info', () => {
      // socket.to(socketId).emit('auth:info:load', data)
    })
    socket.on('auth:logout', () => {
      authController.logout()
    })
    socket.on('auth:sync', (code: string) => {
      authController.sync(code)
    })
  },
}

export default router
