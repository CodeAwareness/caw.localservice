import http from 'http'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'

import app from '@/app'
import gstationRouter from '@/routes/v1/x-grand-station'

interface Error {
  error: string
  errorDetails?: any
}

interface Success<T> {
  data: T
}

export type Response<T> = Error | Success<T>

/*
 * STUDY: auth required, to prevent unauthorized local applications trying to perform actions on CodeAwareness account
 */
function auth(socket: Socket) {
  const ns = socket.nsp.name.substr(1)
  const token = socket.handshake.auth?.token
  console.log(`AUTH ${ns} socket with ${token}`)
  // socket.join(room)
  // const room = data._id.toString()
  // if (!token) return
  gstationRouter.init(socket)
}

const init = (httpServer: http.Server): void => {
  const wsServer = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    }
  })

  wsServer.on('error', console.error)
  wsServer.on('listening', () => console.info('socket.io listening'))
  wsServer.on('disconnect', () => console.info('socket.io disconnected'))

  /* See https://github.com/socketio/socket.io/blob/master/examples/private-messaging/server/index.js */
  /*
  wsServer.use(async (socket, next) => {
    const sessionID = socket.handshake.auth.sessionID
    if (sessionID) {
      const session = await sessionStore.findSession(sessionID)
      if (session) {
        socket.sessionID = sessionID
        socket.userID = session.userID
        socket.username = session.username
        return next()
      }
    }
    const username = socket.handshake.auth.username
    if (!username) {
      return next(new Error("invalid username"))
    }
    socket.sessionID = randomId()
    socket.userID = randomId()
    socket.username = username
    next()
  })
  */

  console.log(`initializing GStation websockets (CORS: ${wsServer.engine.cors})`/*, wsServer.eio.opts, wsServer.eio.corsMiddleware */)
  app.gstationWS = wsServer
  app.gstationNS = {
    users: wsServer.of('/users'),
    repos: wsServer.of('/repos'),
  }
  app.gstationNS.users.on('connection', auth)
  app.gstationNS.repos.on('connection', auth)
}

const wsGStation = {
  init,
}

export default wsGStation
