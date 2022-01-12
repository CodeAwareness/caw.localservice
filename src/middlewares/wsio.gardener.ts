import http from 'http'
import { Server } from 'socket.io'

import app from '@/app'
import gardenerRouter from '@/routes/v1/x-gardener'
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
    if (!app.gardenerSocket) {
      console.log('While trying to transmit', action)
      return reject(new Error('no socket connection'))
    }
    resetDelay()
    const pendingConnection = () => {
      console.log('pendingConnection', _delay, app.gardenerSocket.connected)
      if (!app.gardenerSocket.connected) return setTimeout(pendingConnection, expDelay())
      resetDelay()
      console.log('Will emit (action, data)', action, data)
      app.gardenerSocket.emit(action, data)
      app.gardenerSocket.on(`res:${action}`, resolve)
      app.gardenerSocket.on(`error:${action}`, reject)
    }

    pendingConnection()
  })
}

/*
 * STUDY: auth required, to prevent unauthorized local applications trying to perform actions on CodeAwareness account
 */
function auth(socket) {
  const token = socket.handshake.auth?.token
  console.log('AUTH SOCKET with token', token)
  if (!token) return
  // TODO: SECURITY: compare token with local storage (saved token from a successful login with CodeAwareness)
  console.log('WSS LOGIN SUCCESSFULL')
  // const room = data._id.toString()
  const ns = socket.nsp.name.substr(1)
  app.gardenerSocket = socket // webSocket, svcSocket, etc
  console.log(`Created ${ns}Socket on app.`)
  // socket.join(room)
  gardenerRouter.init()
}

const init = (httpServer: http.Server): void => {
  const wsServer = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    }
  })

  httpServer.on('error', console.error)
  httpServer.on('listening', () => console.info('socket.io listening'))
  httpServer.on('disconnect', () => console.info('socket.io disconnected'))

  console.log('initializing websockets', wsServer.engine.cors /*, wsServer.eio.opts, wsServer.eio.corsMiddleware */)
  app.gardenerWS = wsServer
  app.gardenerNS = {
    v1: wsServer.of('/v1'),
    users: wsServer.of('/users'),
    repos: wsServer.of('/repos'),
  }
  app.gardenerNS.v1.on('connection', auth)
}

const wsGardener = {
  init,
  transmit,

  reqHandler: (req: any, res: any, next: any): void => {
    next()
  },
}

export default wsGardener
