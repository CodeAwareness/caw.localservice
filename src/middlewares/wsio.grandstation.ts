import ipcFactory from 'node-ipc'

import EventEmitter from 'events'

import logger from '@/logger'

import gstationRouter from '@/routes/v1/x-grand-station'

const clients = []

const ipcCatalog = new ipcFactory.IPC()
ipcCatalog.config.socketRoot = '/var/tmp/'
ipcCatalog.config.appspace = 'cΩ.'
ipcCatalog.config.id = 'catalog'
ipcCatalog.config.retry = 1500
ipcCatalog.config.maxConnections = 20 // max 20 app clients (text editors, PowerPoint, etc)

const actions = []

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

class cΩClient {
  public guid
  private ipcClient
  private wsocket
  private actions
  private socket

  constructor (id) {
    this.guid = id
    /* Event names will be pushed to this instance's `actions` */
    this.actions = []
    const wsocket = this.wsocket = new EventEmitter()
    gstationRouter.init(wsocket)
    const ipcClient = this.ipcClient = new ipcFactory.IPC()
    ipcClient.config.socketRoot = '/var/tmp/'
    ipcClient.config.appspace = 'cΩ.'
    ipcClient.config.id = this.guid
    ipcClient.config.retry = 1500
    ipcClient.serve(() => { console.log('New IPC Client connected', this.guid) })

    const handler = (action: string, body: any) => {
      console.info('WSS: Client: resolved action', action)
      ipcClient.server.emit(this.socket, 'message', { action: `res:${action}`, body })
    }

    const errHandler = (action: string, err: any) => {
      console.error('WSS: wsocket error', action, err)
      ipcClient.server.emit(this.socket, 'message', { action: `err:${action}`, err })
    }

    ipcClient.server.on('connect', (socket) => {
      this.socket = socket
      console.log('IPC Client fifo IN socket connected.', this.guid)
      ipcClient.server.emit(this.socket, 'message', { action: 'connected' })
    })

    ipcClient.server.on('socket.disconnected', (socket, isSocketDestroyed) => {
      console.log('IPC Client fifo OUT socket disconnected.', this.guid)
    })

    ipcClient.server.on('message', (message, socket) => {
      console.log('IPC Client message: ', message)
      const { action, data } = JSON.parse(message)
      // avoid trying to create duplicate listeners for the same action
      if (this.actions.indexOf(action) === -1) {
        this.actions.push(action)
        wsocket.on(`res:${action}`, body => handler(action, body))
        wsocket.on(`error:${action}`, err => errHandler(action, err))
      }
      // originally I wrote this IPC using WebSockets, only to find out at the end of my toil that VSCode has WebSockets in dev mode only
      wsocket.emit(action, data)
    })

    ipcClient.server.start()
  }

  dispose () {
    this.wsocket.removeAllListeners()
    this.ipcClient.stop()
  }
}

function setupIPC() {
  ipcCatalog.server.on('error', (err, socket) => {
    console.error('Error starting Catalog IPC', err)
  })

  ipcCatalog.server.on('connect', (socket) => {
    console.log('New client connected to Catalog IPC')
  })

  ipcCatalog.server.on('clientId', id => {
    clients.push(new cΩClient(id))
  })

  ipcCatalog.server.on('socket.disconnected', (socket, isSocketDestroyed) => {
    console.log('client has disconnected!', isSocketDestroyed && 'Socket destroyed')
  })
}

function initPipe() {
  logger.info('initializing pipe IPC')
  ipcCatalog.serve(setupIPC)
  ipcCatalog.server.start()
}

function dispose() {
  console.log('IPC Client cleanup')
  clients.map(c => c.dispose())
}

const wsGStation = {
  init,
  dispose,
}

export default wsGStation
