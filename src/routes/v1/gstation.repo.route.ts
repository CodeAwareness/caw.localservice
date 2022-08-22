import type { Socket } from 'socket.io'
import repoController from '@/controllers/repo.controller'

const router = {
  init: (socket: Socket): void => {
    /* repo:active-path: received whenever VSCode active text editor has changed (switched to a different file) */
    socket.on('repo:active-path', repoController.activatePath)

    /* repo:add: received when the user has added a new workspace folder to VSCode */
    socket.on('repo:add', repoController.add)

    /* repo:add: received when the user has added a new workspace folder to VSCode, a git repo with submodules */
    socket.on('repo:add-submodules', repoController.addSubmodules)

    /* repo:get-tmp-dir: endpoint to retrieve the temporary folder used to unpack git repos and diffs */
    socket.on('repo:get-tmp-dir', repoController.getTmpDir)

    /* repo:remove: received when the user has removed a workspace folder from VSCode */
    socket.on('repo:remove', repoController.remove)

    /* repo:remove: received when the user has removed a workspace folder from VSCode, that included git submodules */
    socket.on('repo:remove-submodules', repoController.removeSubmodules)
  },
}

export default router
