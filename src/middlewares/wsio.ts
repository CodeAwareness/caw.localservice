import io from 'socket.io-client'

import router from '../routes/v1'
import config from '../config/config'

const wsEngine = {
  init: (app: any, server: any) => {
    // TODO: SECURITY: origin: [config.SERVER_WSS],
    const rootSocket = io(config.SERVER_WSS, {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
      origins: ['*'],
      withCredentials: true,
      timestampRequests: true,
    })

    console.log('INIT WSIO', config.SERVER_WSS)
    rootSocket.on('connect', () => {
      console.log('Websocket CONNECT. Assigning to rootSocket')
      // auth(socket) // TODO: secure this server connection a bit more than just CORS
      router.init()
    })

    app.rootSocket = rootSocket
  },

  reqHandler: (req: any, res: any, next: any) => {
    next()
  },
}

export default wsEngine
