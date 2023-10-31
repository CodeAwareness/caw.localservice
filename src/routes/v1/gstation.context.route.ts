import type EventEmitter from 'events'
import contextController from '@/controllers/context.controller'

const router = {
  init: (socket: EventEmitter): void => {
    /* repo:select-lines: received whenever VSCode has a new cursor position in the active file */
    socket.on('context:select-lines', contextController.selectLines)

    /* repo:select-lines: received new context for a line selection in VSCode */
    socket.on('context:apply', contextController.applyContext)
  },
}

export default router
