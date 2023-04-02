import type EventEmitter from 'events'
import authRoute from './gstation.auth.route'
import repoRoute from './gstation.repo.route'
import shareRoute from './gstation.share.route'
import syncRoute from './gstation.sync.route'

const router = {
  init: (socket: EventEmitter): void => {
    authRoute.init(socket)
    shareRoute.init(socket)
    repoRoute.init(socket)
    syncRoute.init(socket)
  },
}

export default router
