import type { CΩExpress } from '@/app'
import app from '@/app'
import repoController from '@/controllers/repo.controller'

const router = {
  init: (): void => {
    const socket = (app as CΩExpress).apiSocket
    socket.on('repo:add', repoController.add)
    socket.on('repo:remove', repoController.remove)
    socket.on('repo:add-submodules', repoController.addSubmodules)
    socket.on('repo:remove-submodules', repoController.removeSubmodules)
  },
}

export default router
