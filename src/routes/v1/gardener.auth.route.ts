import type { CΩExpress } from '@/app'
import app from '@/app'
import authController from '@/controllers/auth.controller'

const router = {
  init: (): void => {
    const socket = app.gStationSocket
    socket.on('auth:info', () => {
      // TODO:
    })
    socket.on('auth:logout', authController.logout)
    // TODO: direct sync (without roundtrip to API)
    // socket.on('local:auth:sync', authController.sync)
  },
}

export default router
