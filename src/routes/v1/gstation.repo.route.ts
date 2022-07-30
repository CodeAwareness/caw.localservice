import type { Socket } from 'socket.io'
import repoController from '@/controllers/repo.controller'

const router = {
  init: (socket: Socket): void => {
    socket.on('repo:add', repoController.add)
    socket.on('repo:remove', repoController.remove)
    socket.on('repo:add-submodules', repoController.addSubmodules)
    socket.on('repo:remove-submodules', repoController.removeSubmodules)
  },
}

export default router
