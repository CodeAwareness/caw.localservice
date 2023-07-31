import os from 'os'
import fs from 'fs'
import net, { Socket } from 'net'
import { EventEmitter } from 'node:events'

import CAWStore from '@/services/store'
import logger from '@/logger'

const delimiter = '\f'
const isWindows = !!process.env.ProgramFiles

class IPC {
  public appspace = 'caw.'
  public socketRoot = isWindows ? '\\\\.\\pipe\\' : '/var/tmp/'
  public path = ''
  public cid = ''
  public pubsub = new EventEmitter()
  public server = null as net.Server || null

  private ipcBuffer = ''
  private socket = null as Socket | null
  private id = os.hostname()
  private handlers = {}
  private errHandlers = {}

  constructor(guid: string) {
    if (guid) this.path = this.socketRoot + this.appspace + guid
    this.cid = guid
    logger.log('IPC: New IPC', this.path)
  }

  setup() {
    try {
      fs.unlinkSync(this.path)
    } catch (err) {
      logger.log('IPC: Pipe does not exist. Initializing.', this.path)
    }
    this.server = net.createServer((socket: Socket) => {
      this.socket = socket
      socket.setEncoding('utf8')
      socket.on('end', () => {
        const timers = CAWStore.timers[this.cid]
        if (timers) {
          logger.log(`IPC: Client disconnected: ${this.path}. Cleaning up active projects (${Object.keys(timers).length} projects).`)
          Object.keys(timers).map(p => {
            if (timers[p]) clearInterval(timers[p])
          })
          delete CAWStore.timers[this.cid]
        }
      })
      socket.on('error', err => { logger.log('IPC: Socket error: ', this.path, err) })
      socket.on('data', data => this.onData(data))
    })
    this.server.on('error', (err) => { logger.log('IPC: server error', this.path, err) })
  }

  start() {
    logger.log('IPC: starting server on ', this.path)
    this.server.listen(this.path)
  }

  stop() {
    logger.log('IPC: closing server on ', this.path)
    this.server.close()
  }

  emit(message: string) {
    if (!this.socket) {
      logger.log('IPC: Cannot dispatch event. No socket for', this.id)
      return
    }
    logger.log('IPC: Dispatching event to ', this.id, this.path, ' : ', JSON.parse(message))
    this.socket.write(message + delimiter)
  }

  onData(data: any) {
    this.ipcBuffer += data.toString()

    if (this.ipcBuffer.indexOf(delimiter) === -1) {
      logger.log('IPC: Messages are pretty large, is this really necessary?')
      return
    }

    const handler = (action: string, body: any) => {
      logger.info('IPC: Client: resolved action', action)
      this.emit(JSON.stringify({ action: `res:${action}`, body }))
    }

    const errHandler = (action: string, err: any) => {
      logger.error('IPC: socket error', action, err)
      this.emit(JSON.stringify({ action: `err:${action}`, err }))
    }

    const events = this.ipcBuffer.split(delimiter)
    events.pop()
    events.map(event => {
      const { action, data /*, err */ } = JSON.parse(event)
      logger.log('IPC: Detected event', action, this.handlers)
      if (!this.handlers[`res:${action}`]) {
        this.pubsub.on(`res:${action}`, body => handler(action, body))
        this.handlers[`res:${action}`] = true
      }
      if (!this.errHandlers[`res:${action}`]) {
        this.pubsub.on(`error:${action}`, err => errHandler(action, err))
        this.errHandlers[`res:${action}`] = true
      }
      this.pubsub.emit(action, data)
    })

    this.ipcBuffer = ''
  }
}

export default IPC
