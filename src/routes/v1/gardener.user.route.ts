import type { CAWExpress } from '@/app'
import app from '@/app'
import userController from '@/controllers/user.controller'

const router = {
  init: (): void => {
    const socket = (app as CAWExpress).gardenerSocket
    socket.on('users:online', userController.cameOnline)
  },
}

export default router
