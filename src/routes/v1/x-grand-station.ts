import type { Socket } from 'socket.io'
import authRoute from './gstation.auth.route'
/*
import repoRoute from './gstation.repo.route'
import shareRoute from './gstation.share.route'
*/

const router = {
  init: (socket: Socket): void => {
    authRoute.init(socket) // TODO: how do we take care of each socket, because each app has their own socket connection.
    /*
    repoRoute.init()
    shareRoute.init()
    */
  },
}

export default router
