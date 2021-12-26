import io from 'socket.io-client'

import app from '../app'
import router from '../routes/v1'
import config from '../config/config'
import { CΩStore } from '../services/cA.store'

/*
 * Exponential wait for connection ready
 */
let _delay
const expDelay = () => {
  _delay = _delay * 2
  return _delay
}

const resetDelay = () => {
  _delay = 200
}

/*
 * Transmit an action, and perhaps some data, to CodeAwareness API
 * The response from the API comes in the form of `res:<action>` with the `action` being the same as the transmitted one.
 */
const transmit = (action, data = undefined) => {
  return new Promise((resolve, reject) => {
    if (!app.apiSocket) {
      console.log('While trying to transmit', action)
      return reject(new Error('no socket connection'))
    }
    resetDelay()
    const pendingConnection = () => {
      console.log('pendingConnection', _delay, app.apiSocket.connected)
      if (!app.apiSocket.connected) return setTimeout(pendingConnection, expDelay())
      resetDelay()
      console.log('Will emit (action, data)', action, data)
      app.apiSocket.emit(action, data)
      app.apiSocket.on(`res:${action}`, resolve)
      app.apiSocket.on(`error:${action}`, reject)
    }

    pendingConnection()
  })
}

const init = (): Promise<void> => {
  const apiSocket = app.apiSocket || wsEngine.reconnect()

  return new Promise((resolve, reject) => {
    let connected
    setTimeout(() => {
      if (!connected) reject(new Error('Could not connect to websocket for 5 seconds'))
    }, 5000)

    apiSocket.on('connect', () => {
      console.log('Websocket CONNECT. Assigning to apiSocket', apiSocket.auth)
      // auth(socket) // TODO: secure this server connection a bit more than just CORS
      router.init()
      connected = true
      resolve()
    })

    apiSocket.on('disconnect', reason => {
      console.log('WSIO apiSocket DISCONNECT', reason)
      return wsEngine.reconnect()
    })

    apiSocket.onAny(ev => console.log('SOCKET DATA', ev))
    apiSocket.prependAny(ev => console.log('SOCKET WILL EMIT', ev))

    apiSocket.on('CΩ', e => console.log('CODE_AWARENESS EVENT', e))
    apiSocket.on('error', err => console.error(err.description?.message))
    apiSocket.on('connect_error', e => console.log('WSIO ERROR apiSocket', e))
  })
}

const reconnect = (): any => {
  console.log('WSIO RECONNECT')
  // TODO: SECURITY: origin: [config.SERVER_WSS],
  const apiSocket = io(config.SERVER_WSS, {
    reconnectionDelayMax: 10000,
    forceNew: true,
    transports: ['websocket'],
    // @ts-ignore: No overload matches this call.
    origins: ['*'],
    withCredentials: true,
    timestampRequests: true,
    auth: { token: CΩStore.tokens?.access?.token },
  })

  app.apiSocket = apiSocket
  return apiSocket
}

const wsEngine = {
  init,
  reconnect,
  transmit,

  reqHandler: (req: any, res: any, next: any): void => {
    next()
  },
}

export default wsEngine
