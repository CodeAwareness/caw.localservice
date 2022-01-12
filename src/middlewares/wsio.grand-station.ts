import io from 'socket.io-client'

import app from '@/app'
import gStationRouter from '@/routes/v1/x-grand-station'
import config from '@/config/config'
import { CΩStore } from '@/services/cA.store'

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
    if (!app.gStationSocket) {
      console.log('While trying to transmit', action)
      return reject(new Error('no socket connection'))
    }
    resetDelay()
    const pendingConnection = () => {
      console.log('pendingConnection', _delay, app.gStationSocket.connected)
      if (!app.gStationSocket.connected) return setTimeout(pendingConnection, expDelay())
      resetDelay()
      console.log('Will emit (action, data)', action, data)
      app.gStationSocket.emit(action, data)
      app.gStationSocket.on(`res:${action}`, resolve)
      app.gStationSocket.on(`error:${action}`, reject)
    }

    pendingConnection()
  })
}

const init = (): Promise<void> => {
  const gStationSocket = app.gStationSocket || wsGStation.reconnect()

  return new Promise((resolve, reject) => {
    let connected
    setTimeout(() => {
      if (!connected) reject(new Error('Could not connect to websocket for 5 seconds'))
    }, 5000)

    gStationSocket.on('connect', () => {
      console.log('Websocket CONNECT. Assigning to gStationSocket', gStationSocket.auth)
      // auth(socket) // TODO: SECURITY
      gStationRouter.init()
      connected = true
      resolve()
    })

    gStationSocket.on('disconnect', reason => {
      console.log('WSIO gStationSocket DISCONNECT', reason)
      return wsGStation.reconnect()
    })

    gStationSocket.onAny(ev => console.log('SOCKET DATA', ev))
    gStationSocket.prependAny(ev => console.log('SOCKET WILL EMIT', ev))

    gStationSocket.on('CΩ', e => console.log('CODE_AWARENESS EVENT', e))
    gStationSocket.on('error', err => console.error(err.description?.message))
    gStationSocket.on('connect_error', e => console.log('WSIO ERROR gStationSocket', e))
  })
}

const reconnect = (): any => {
  console.log('WSIO RECONNECT')
  // TODO: SECURITY: origin: [config.SERVER_WSS],
  const gStationSocket = io(config.SERVER_WSS, {
    reconnectionDelayMax: 10000,
    forceNew: true,
    transports: ['websocket'],
    // @ts-ignore: No overload matches this call.
    origins: ['*'],
    withCredentials: true,
    timestampRequests: true,
    auth: { token: CΩStore.tokens?.access?.token },
  })

  app.gStationSocket = gStationSocket
  return gStationSocket
}

const wsGStation = {
  init,
  reconnect,
  transmit,

  reqHandler: (req: any, res: any, next: any): void => {
    next()
  },
}

export default wsGStation
