import type EventEmitter from 'events'
import authRoute from './gstation.auth.route'
import contextRoute from './gstation.context.route'
import repoRoute from './gstation.repo.route'
import syncRoute from './gstation.sync.route'

const router = {
  init: (socket: EventEmitter): void => {
    authRoute.init(socket)
    contextRoute.init(socket)
    repoRoute.init(socket)
    syncRoute.init(socket)
  },
}

export default router
