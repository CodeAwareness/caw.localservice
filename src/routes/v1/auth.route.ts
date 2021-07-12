import app from '../../app'
import authController from '../../controllers/auth.controller'

const router = {
  init: (): void => {
    const socket = (app as any).rootSocket
    socket.on('auth:info', () => {
      // TODO:
    })
    socket.on('auth:logout', () => {
      authController.logout()
    })
    socket.on('local:auth:sync', (code: string) => {
      console.log('LOCAL auth:sync', code)
      authController.sync(code)
    })
  },
}

export default router
