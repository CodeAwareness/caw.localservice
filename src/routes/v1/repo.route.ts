import app from '../../app'
import repoController from '../../controllers/repo.controller'

const router = {
  init: (): void => {
    const socket = (app as any).rootSocket
    socket.on('repo:add', folder => {
      repoController.add(folder)
    })
    socket.on('repo:remove', folder => {
      repoController.remove(folder)
    })
    socket.on('repo:add-submodules', fpath => {
      repoController.addSubmodules(fpath)
    })
    socket.on('repo:remove-submodules', fpath => {
      repoController.removeSubmodules(fpath)
    })
  },
}

export default router
