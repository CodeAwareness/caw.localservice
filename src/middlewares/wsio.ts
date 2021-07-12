import io from 'socket.io-client'

import router from '../routes/v1'
import config from '../config/config'
import { Peer8Store } from '..//services/peer8.store'

let _app, manager, _server

const wsEngine = {
  init: (app: any, server: any) => {
    _app = app
    _server = server

    return wsEngine.reconnect()
  },

  reconnect: () => {
    if (_app.rootSocket) _app.rootSocket.close()
    return new Promise((resolve, reject) => {
      // TODO: SECURITY: origin: [config.SERVER_WSS],
      const rootSocket = io(config.SERVER_WSS, {
        reconnectionDelayMax: 10000,
        forceNew: true,
        transports: ['websocket'],
        origins: ['*'],
        withCredentials: true,
        timestampRequests: true,
        auth: { token: Peer8Store.tokens?.access?.token },
      })

      _app.rootSocket = rootSocket

      rootSocket.on('connect', () => {
        console.log('Websocket CONNECT. Assigning to rootSocket, with token', Peer8Store.tokens?.access?.token)
        // auth(socket) // TODO: secure this server connection a bit more than just CORS
        router.init()
        resolve()
      })
    })
  },

  reqHandler: (req: any, res: any, next: any) => {
    next()
  },
}

export default wsEngine
