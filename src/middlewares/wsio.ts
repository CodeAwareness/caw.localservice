import io from 'socket.io-client'

import router from '../routes/v1'
import config from '../config/config'
import { Peer8Store } from '..//services/peer8.store'

let _app
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
    if (!_app.rootSocket) {
      console.log('While trying to transmit', action)
      return reject(new Error('no socket connection'))
    }
    resetDelay()
    const pendingConnection = () => {
      console.log('pendingConnection', _delay, _app.rootSocket.connected)
      if (!_app.rootSocket.connected) return setTimeout(pendingConnection, expDelay())
      resetDelay()
      console.log('Will emit (action, data)', action, data)
      _app.rootSocket.emit(action, data)
      _app.rootSocket.on(`res:${action}`, resolve)
      _app.rootSocket.on(`error:${action}`, reject)
    }

    pendingConnection()
  })
}

const wsEngine = {
  init: (app: any): void => {
    _app = app

    const rootSocket = _app.rootSocket || wsEngine.reconnect()

    rootSocket.on('connect', () => {
      console.log('Websocket CONNECT. Assigning to rootSocket', rootSocket.auth)
      // auth(socket) // TODO: secure this server connection a bit more than just CORS
      router.init()
    })

    rootSocket.on('disconnect', reason => {
      console.log('WSIO rootSocket DISCONNECT', reason)
      return wsEngine.reconnect()
    })

    rootSocket.on('error', err => console.error(err.description?.message))
    rootSocket.on('connect_error', e => console.log('WSIO ERROR rootSocket', e))

    wsEngine.reconnect()
  },

  reconnect: (): any => {
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

    _app.rootSocket = rootSocket
    return rootSocket
  },

  reqHandler: (req: any, res: any, next: any): void => {
    next()
  },

  transmit,
}

export default wsEngine
