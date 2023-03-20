import EventEmitter from 'events'

import logger from '@/logger'

import { Socket } from 'net'
import IPC from '@/services/ipc'
import gstationRouter from '@/routes/v1/x-grand-station'

const clients = []

const ipcCatalog = new IPC('catalog')

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

class CAWClient {
  public guid: string
  private ipcClient: IPC
  private actions: Array<string>
  private socket: Socket

  constructor(id: string) {
    this.guid = id
    /* Event names will be pushed to this instance's `actions` */
    this.actions = []
    this.ipcClient = new IPC(this.guid)
    this.ipcClient.setup()
    gstationRouter.init(this.ipcClient.pubsub)
    console.log('Client setup complete')
    this.ipcClient.start()
  }

  dispose() {
    this.ipcClient.stop()
  }
}

function initPipe() {
  logger.info('Initializing pipe IPC')
  ipcCatalog.setup()
  ipcCatalog.pubsub.on('clientId', (guid: string) => {
    console.log('New client registered', guid)
    clients.push(new CAWClient(guid))
  })

  ipcCatalog.start()
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
