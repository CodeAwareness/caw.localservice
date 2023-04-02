import os from 'os'
import fs from 'fs'
import net, { Socket } from 'net'
import { EventEmitter } from 'node:events'

import CAWStore from '@/services/store'

const delimiter = '\f'

class IPC {
  public appspace = 'caw.'
  public socketRoot = '/var/tmp/'
  public path = ''
  public cid = ''
  public pubsub = new EventEmitter()
  public server = null as net.Server || null

  private ipcBuffer = ''
  private socket = null as Socket | null
  private id = os.hostname()

  constructor(guid: string) {
    if (guid) this.path = this.socketRoot + this.appspace + guid
    this.cid = guid
    console.log('New IPC', this.path)
    /* TODO: Windows pipe path
    if (process.platform === 'win32' && !path.startsWith('\\\\.\\pipe\\')) {
      path = path.replace(/^\//, '')
      path = path.replace(/\//g, '-')
      path = `\\\\.\\pipe\\${options.path}`
    }
    */
  }

  setup() {
    try {
      fs.unlinkSync(this.path)
    } catch (err) {
      console.log('Pipe does not exist. Initializing.', this.path)
    }
    this.server = net.createServer((socket: Socket) => {
      this.socket = socket
      socket.setEncoding('utf8')
      socket.on('end', () => {
        console.log('Client disconnected: ', this.path)
        CAWStore.activeProjects[this.cid]?.map(p => {
          if (CAWStore.timers[p.root]) clearInterval(CAWStore.timers[p.root])
        })

      })
      socket.on('error', err => { console.log('Socket error: ', this.path, err) })
      socket.on('data', data => this.onData(data))
    })
    this.server.on('error', (err) => { console.log('server error', this.path, err) })
  }

  start() {
    console.log('starting server on ', this.path)
    this.server.listen(this.path)
  }

  stop() {
    console.log('closing server on ', this.path)
    this.server.close()
  }

  emit(message: string) {
    if (!this.socket) {
      console.log('Cannot dispatch event. No socket for', this.id)
      return
    }
    console.log('Dispatching event to ', this.id, this.path, ' : ', message.substring(0, 100))
    this.socket.write(message + delimiter)
  }

  onData(data: any) {
    this.ipcBuffer += data.toString()

    if (this.ipcBuffer.indexOf(delimiter) === -1) {
      console.log('Messages are pretty large, is this really necessary?')
      return
    }

    const handler = (action: string, body: any) => {
      console.info('IPC: Client: resolved action', action)
      this.emit(JSON.stringify({ action: `res:${action}`, body }))
    }

    const errHandler = (action: string, err: any) => {
      console.error('IPC: socket error', action, err)
      this.emit(JSON.stringify({ action: `err:${action}`, err }))
    }

    const events = this.ipcBuffer.split(delimiter)
    events.pop()
    events.map(event => {
      const { action, data, err } = JSON.parse(event)
      console.log('Detected event', action)
      this.pubsub.on(`res:${action}`, body => handler(action, body))
      this.pubsub.on(`error:${action}`, err => errHandler(action, err))
      this.pubsub.emit(action, data)
    })

    this.ipcBuffer = ''
  }
}

export default IPC
