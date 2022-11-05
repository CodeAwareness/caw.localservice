import http from 'node:http'
import * as fs from 'node:fs'
import net from 'node:net'

import EventEmitter from 'events'
import { mkdirSync, openSync } from 'fs'
import { spawn } from 'child_process'

import logger from '@/logger'
import config from '@/config/config'

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

const PACKET_SEPARATOR = 'Ωstdin endΩ'
const catalog = config.PIPE_CLIENTS
const clients = []

/*
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

const getClientName = c => c.pipeIncoming.substr(c.pipeIncoming.lastIndexOf('/') + 1).replace(/.(out|in).sock/, '')

const cleanup = () => {
  clients.map(c => c.dispose())
  fs.writeFile(catalog, '', () => {
    process.exit()
  })
}

process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGUSR2', cleanup)

function initPipe() {
  // TODO: cleanup unused ids; when VSCode shuts down it may fail to clear its pipe.
  // probably best to use stream pipeline: https://nodejs.org/api/stream.html#stream_stream_pipeline_source_transforms_destination_callback
  logger.info('initializing pipe IPC')
  try {
    fs.accessSync(catalog, fs.constants.W_OK)
    setupCatalog()
  } catch (err) {
    fs.writeFile(catalog, '', setupCatalog)
  }

  function setupCatalog() {
    refreshClients()
    fs.watch(catalog, (eventType, filename) => {
      if (!filename) {
        logger.error('Could not setup pipe IPC')
        return
      }
      refreshClients()
    })
  }
}

function refreshClients() {
  const ids = fs.readFileSync(catalog, { encoding: 'utf8' })
  const existing = clients.map(getClientName) || []
  const newClients = ids.split('\n').filter(a => a).filter(a => !existing.includes(a)).map(Client)
  newClients.map(c => clients.push(c))
  logger.info('new IPC clients', existing, clients.map(c => c.pipeIncoming))
}

// Note: this effectively replaces the need to send cΩ with every request
// TODO: cleanup unused pipes; perhaps scan and delete ones older than one week
function Client(id) {
  const pipeIncoming = `/var/tmp/cΩ/${id}.out.sock`
  const pipeOutgoing = `/var/tmp/cΩ/${id}.in.sock`
  const actions = []

  const wsocket = new EventEmitter()
  let fifoOut: net.Socket
  let fifoIn: net.Socket
  let serverIn: net.Server
  let serverOut: net.Server

  init()

  return { dispose, pipeIncoming, pipeOutgoing, transmit }

  function init() {
    const handler = (action: string, body: any) => {
      // logger.info('WSS: Client: resolved action', action, body)
      fifoOut.write(JSON.stringify({ action: `res:${action}`, body: JSON.stringify(body) }))
    }

    const errHandler = (action: string, err: any) => {
      logger.error('WSS: wsocket error', action, err)
      fifoOut.write(JSON.stringify({ action: `err:${action}`, err: JSON.stringify(err) }))
    }

    /* @ts-ignore */
    serverIn = net.createServer({ keepAlive: true }, socket => {
      logger.info('IPC Client fifo IN created.', pipeOutgoing)
      fifoIn = socket
      let buffer: string = ''
      socket.on('data', buf => {
        const text = String(buf)
        if (!text?.length) return
        buffer += text
        if (!text.includes(PACKET_SEPARATOR)) {
          return
        }
        processBuffer(buffer)
      })

      socket.on('end', () => {
        logger.info('IPC Client disconnected', pipeIncoming)
      })

      function processBuffer(buffer) {
        if (!buffer.length) return
        const index = buffer.indexOf(PACKET_SEPARATOR)
        if (index === -1) return // still gathering chunks

        // Packet complete
        const packet = buffer.substr(0, index)
        console.log('----- Received packet -----')
        console.log(packet)

        const { action, data } = JSON.parse(packet)
        // avoid trying to create duplicate listeners for the same action
        if (actions.indexOf(action) === -1) {
          actions.push(action)
          wsocket.on(`res:${action}`, body => handler(action, body))
          wsocket.on(`error:${action}`, err => errHandler(action, err))
        }
        // originally I wrote this IPC using WebSockets, only to find out at the end of my toil that VSCode has WebSockets in dev mode only
        wsocket.emit(action, data)

        // Process remaining bits in the buffer
        processBuffer(buffer.substr(index + PACKET_SEPARATOR.length))
      }
    })

    serverIn.on('error', (err) => {
      logger.error(err)
    })

    gstationRouter.init(wsocket)
    serverIn.listen(pipeIncoming)

    /* @ts-ignore */
    serverOut = net.createServer({ keepAlive: true }, socket => {
      fifoOut = socket

      socket.on('end', () => {
        logger.info('IPC Client output disconnected', pipeOutgoing)
      })
    })

    serverOut.on('error', err => {
      console.error(err)
    })

    serverOut.listen(pipeOutgoing)
  }

  /**
   * Push an action and data to the Editor (outside the normal req/res loop).
   * Recommend a namespacing format for the action, something like `<domain>:<action>`, e.g. `auth:login` or `users:query`.
   */
  function transmit(action: string, data?: any, options?: any) {
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
        return fifoOut.write(JSON.stringify({ action, data }))
      })
      .then(shouldContinue => {
        // Backpressure if buffer is full
        if (!shouldContinue) {
          console.log('IPC Client drained.', pipeOutgoing)
          return EventEmitter.once(fifoOut, 'drain')
        }
        return
      })
      .then(() => {
        wsocket.on(`res:${action}`, handler)
        wsocket.on(`error:${action}`, errHandler)
      })
  }

  function dispose() {
    console.log('IPC Client cleanup', pipeIncoming)
    serverIn?.close()
    serverOut?.close()
    wsocket.removeAllListeners()
  }
}

const wsGStation = {
  init,
}

export default wsGStation
