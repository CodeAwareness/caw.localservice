import http from 'http'
import { Server } from 'socket.io'

import app from '@/app'
import gstationRouter from '@/routes/v1/x-grand-station'

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
    if (!app.gstationSocket) {
      console.log('While trying to transmit', action)
      return reject(new Error('no socket connection'))
    }
    resetDelay()
    const pendingConnection = () => {
      console.log('pendingConnection', _delay, app.gstationSocket.connected)
      if (!app.gstationSocket.connected) return setTimeout(pendingConnection, expDelay())
      resetDelay()
      console.log('Will emit (action, data)', action, data)
      app.gstationSocket.emit(action, data)
      app.gstationSocket.on(`res:${action}`, resolve)
      app.gstationSocket.on(`error:${action}`, reject)
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
  app.gstationSocket = socket // webSocket, svcSocket, etc
  console.log(`Created ${ns}Socket on app.`)
  // socket.join(room)
  gstationRouter.init()
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

  console.log(`initializing GStation websockets (CORS: ${wsServer.engine.cors})`/*, wsServer.eio.opts, wsServer.eio.corsMiddleware */)
  app.gstationWS = wsServer
  app.gstationNS = {
    v1: wsServer.of('/v1'),
    users: wsServer.of('/users'),
    repos: wsServer.of('/repos'),
  }
  app.gstationNS.v1.on('connection', auth)
}

const wsGStation = {
  init,
  transmit,

  reqHandler: (req: any, res: any, next: any): void => {
    next()
  },
}

export default wsGStation
