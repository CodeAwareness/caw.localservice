import type { CΩExpress } from '@/app'
import app from '@/app'
import userController from '@/controllers/user.controller'

// Sends request to the API on the cloud.
// Uses both Sockets and HTTP.
const router = {
  init: (): void => {
    const socket = (app as CΩExpress).gardenerSocket
    socket.on('users:get', userController.getUsers)
  },
}

export default router
