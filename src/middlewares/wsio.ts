import io from 'socket.io-client'

import app from '../app'
import router from '../routes/v1'
import config from '../config/config'
import { Peer8Store } from '../services/peer8.store'

let _delay
const expDelay = () => {
  _delay = _delay * 2
  return _delay
}

const resetDelay = () => {
  _delay = 200
}

const transmit = (action, data = undefined) => {
  return new Promise((resolve, reject) => {
    if (!app.rootSocket) {
      console.log('While trying to transmit', action)
      return reject(new Error('no socket connection'))
    }
    resetDelay()
    const pendingConnection = () => {
      console.log('pendingConnection', _delay, app.rootSocket.connected)
      if (!app.rootSocket.connected) return setTimeout(pendingConnection, expDelay())
      resetDelay()
      console.log('Will emit (action, data)', action, data)
      app.rootSocket.emit(action, data)
      app.rootSocket.on(`res:${action}`, resolve)
      app.rootSocket.on(`error:${action}`, reject)
    }

    pendingConnection()
  })
}

const wsEngine = {
  init: (): Promise<void> => {
    const rootSocket = app.rootSocket || wsEngine.reconnect()

    return new Promise((resolve, reject) => {
      let connected
      setTimeout(() => {
        if (!connected) reject(new Error('Could not connect to websocket for 5 seconds'))
      }, 5000)

      rootSocket.on('connect', () => {
        console.log('Websocket CONNECT. Assigning to rootSocket', rootSocket.auth)
        // auth(socket) // TODO: secure this server connection a bit more than just CORS
        router.init()
        connected = true
        resolve()
      })

      rootSocket.on('disconnect', reason => {
        console.log('WSIO rootSocket DISCONNECT', reason)
        return wsEngine.reconnect()
      })

      rootSocket.onAny(ev => console.log('SOCKET DATA', ev))
      rootSocket.prependAny(ev => console.log('SOCKET WILL EMIT', ev))

      rootSocket.on('peer8', e => console.log('PEER8 EVENT', e))
      rootSocket.on('error', err => console.error(err.description?.message))
      rootSocket.on('connect_error', e => console.log('WSIO ERROR rootSocket', e))
    })
  },

  reconnect: (): any => {
    console.log('WSIO RECONNECT')
    // TODO: SECURITY: origin: [config.SERVER_WSS],
    const rootSocket = io(config.SERVER_WSS, {
      reconnectionDelayMax: 10000,
      forceNew: true,
      transports: ['websocket'],
      // @ts-ignore: No overload matches this call.
      origins: ['*'],
      withCredentials: true,
      timestampRequests: true,
      auth: { token: Peer8Store.tokens?.access?.token },
    })

    app.rootSocket = rootSocket
    return rootSocket
  },

  reqHandler: (req: any, res: any, next: any): void => {
    next()
  },

  transmit,
}

export default wsEngine
