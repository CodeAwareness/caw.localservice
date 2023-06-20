import type EventEmitter from 'events'
import repoController from '@/controllers/repo.controller'

const router = {
  init: (socket: EventEmitter): void => {
    /* repo:active-path: received whenever VSCode active text editor has changed (switched to a different file) */
    socket.on('repo:active-path', repoController.activatePath)

    /* repo:add: received when the user has added a new workspace folder to VSCode */
    socket.on('repo:add', repoController.add)

    /* repo:add: received when the user has added a new workspace folder to VSCode, a git repo with submodules */
    socket.on('repo:add-submodules', repoController.addSubmodules)

    /* repo:cycle-block: received when the user is cycling a block of code through every peer change */
    socket.on('repo:cycle-block', repoController.cycleBlock)

    /* repo:diff-branch: requesting a diff between active file and the same file in another branch */
    socket.on('repo:diff-branch', repoController.diffWithBranch)

    /* repo:diff-peer: requesting a diff between active file and a selected peer */
    socket.on('repo:diff-peer', repoController.diffWithPeer)

    /* repo:file-saved: received whenever VSCode has saved the active file */
    socket.on('repo:file-saved', repoController.sendDiffs)

    /* repo:get-tmp-dir: endpoint to retrieve the temporary folder used to unpack git repos and diffs */
    socket.on('repo:get-tmp-dir', repoController.getTmpDir)

    /* repo:read-file: read file contents and transmit back */
    socket.on('repo:read-file', repoController.readFile)

    /* repo:remove: received when the user has removed a workspace folder from VSCode */
    socket.on('repo:remove', repoController.remove)

    /* repo:vscode-diff: check if a file exists, and return the info required by VSCode to create a diff */
    socket.on('repo:vscode-diff', repoController.vscodeDiff)
  },
}

export default router
