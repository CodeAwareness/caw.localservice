import type { Socket } from 'socket.io'
import authRoute from './gstation.auth.route'
import shareRoute from './gstation.share.route'

const router = {
  init: (ns: string, socket: Socket): void => {
    if (ns === 'users') {
      authRoute.init(socket) // TODO: how do we take care of each socket, because each app has their own socket connection.
    }

    if (ns === 'repos') {
      shareRoute.init(socket)
    }
  },
}

export default router
