import type { CΩExpress } from '@/app'
import app from '@/app'
import userController from '@/controllers/user.controller'

const router = {
  init: (): void => {
    const socket = (app as CΩExpress).gardenerSocket
    socket.on('users:get', userController.getUsers)
  },
}

export default router
