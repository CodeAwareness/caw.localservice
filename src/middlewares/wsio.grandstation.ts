import ipc from 'node-ipc'

import EventEmitter from 'events'

import logger from '@/logger'

import gstationRouter from '@/routes/v1/x-grand-station'

interface Error {
  error: string
  errorDetails?: any
}

interface Success<T> {
  data: T
}

export type Response<T> = Error | Success<T>

ipc.config.id = 'CΩ'
ipc.config.retry = 1500

const actions = []
const wsocket = new EventEmitter()

/*
 * TODO: auth for all sockets or at least for TCP sockets
 * STUDY: auth required, to prevent unauthorized local applications trying to perform actions on CodeAwareness account
 */
function auth(socket) {
  const ns = socket.nsp.name.substr(1)
  const token = socket.handshake.auth?.token
  logger.info(`AUTH ${ns} socket with ${token}`)
  // socket.join(room)
  // const room = data._id.toString()
  // if (!token) return
  gstationRouter.init(socket)
}

function init(): void {
  initPipe()
}

const cleanup = () => {
  // TODO: cleanup sockets
  process.exit()
}

process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGUSR2', cleanup)

function setupIPC() {
  gstationRouter.init(wsocket)

  const handler = (socket: any, action: string, body: any) => {
    console.info('WSS: Client: resolved action', action, body)
    ipc.server.emit(socket, 'message', { action: `res:${action}`, body })
  }

  const errHandler = (socket: any, action: string, err: any) => {
    console.error('WSS: wsocket error', action, err)
    ipc.server.emit(socket, 'message', { action: `err:${action}`, err })
  }

  ipc.server.on('message', (message, socket) => {
    ipc.log('IPC Message: ', message)
    const { action, data } = JSON.parse(message)
    // avoid trying to create duplicate listeners for the same action
    if (actions.indexOf(action) === -1) {
      actions.push(action)
      wsocket.on(`res:${action}`, body => handler(socket, action, body))
      wsocket.on(`error:${action}`, err => errHandler(socket, action, err))
    }
    // originally I wrote this IPC using WebSockets, only to find out at the end of my toil that VSCode has WebSockets in dev mode only
    wsocket.emit(action, data)
  })

  ipc.server.on('socket.disconnected', (socket, isSocketDestroyed) => {
    console.log('client has disconnected!', isSocketDestroyed && 'Socket destroyed')
  })
}

function initPipe() {
  logger.info('initializing pipe IPC')
  ipc.serve(setupIPC)
  ipc.server.start()
}

/**
 * Push an action and data to the Editor (outside the normal req/res loop).
 * Recommend a namespacing format for the action, something like `<domain>:<action>`, e.g. `auth:login` or `users:query`.
 *
 * @param Socket
 * @param String action (e.g. 'users:online')
 * @param Object data
 * @param Object options for TCP sockets
 */
function transmit(socket: any, action: string, data?: any) {
  let handler, errHandler
  return new Promise(
    (resolve, reject) => {
      logger.info(`WSS: will emit action: ${action}`)
      handler = (body: any) => {
        // console.log('WSS: Transmit: resolved action', action, body)
        wsocket.removeListener(action, handler)
        resolve(body)
      }
      errHandler = (err: any) => {
        logger.error('WSS: wsocket error', action, err)
        wsocket.removeListener(action, errHandler)
        reject(err)
      }
      return ipc.server.emit(socket, 'message', JSON.stringify({ action, data }))
    })
    .then(() => {
      wsocket.on(`res:${action}`, handler)
      wsocket.on(`error:${action}`, errHandler)
    })
}

function dispose() {
  console.log('IPC Client cleanup')
  wsocket.removeAllListeners()
}

const wsGStation = {
  init,
  transmit,
  dispose,
}

export default wsGStation
