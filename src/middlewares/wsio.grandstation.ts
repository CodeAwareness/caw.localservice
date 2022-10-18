import http from 'http'
import * as fs from 'node:fs'
import net from 'node:net'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'

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

/*
 * STUDY: auth required, to prevent unauthorized local applications trying to perform actions on CodeAwareness account
 */
function auth(socket: Socket) {
  const ns = socket.nsp.name.substr(1)
  const token = socket.handshake.auth?.token
  logger.log(`AUTH ${ns} socket with ${token}`)
  // socket.join(room)
  // const room = data._id.toString()
  // if (!token) return
  gstationRouter.init(socket)
}

function init(): void {
  initPipe()
}

const catalog = config.PIPE_CLIENTS
let clients

function initPipe() {
  // TODO: cleanup unused ids; when VSCode shuts down it may fail to clear its pipe.
  // probably best to use stream pipeline: https://nodejs.org/api/stream.html#stream_stream_pipeline_source_transforms_destination_callback
  fs.writeFile(catalog, '', err => {
    fs.watch(catalog, (eventType, filename) => {
      if (!filename) return
      const ids = fs.readFileSync(catalog, { encoding: 'utf8' })
      clients = ids.split('\n').filter(a => a).map(Client)
    })
  })
}

// Note: this effectively replaces the need to send cΩ with every request
// TODO: cleanup unused pipes; perhaps scan and delete ones older than one week
function Client(id) {
  const wsocket = new EventEmitter()
  let fifoOut: net.Socket

  const pipeIncoming = `/var/tmp/cΩ/${id}.out.sock`
  const pipeOutgoing = `/var/tmp/cΩ/${id}.in.sock`
  gstationRouter.init(wsocket)

  // using nodejs net Sockets to enable communication with potentially tens of applications
  // (createReadStream is limited to the number of threads in the thread-pool)
  fs.open(pipeIncoming, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK, (err, fd) => {
    if (err) {
      logger.error('LS: could not read from pipe', pipeIncoming, err)
      return
    }
    const pipe = new net.Socket({ fd })
    pipe.on('data', text => {
      console.log('----- Received packet -----')
      console.log(text.toString())
      const { action, data } = JSON.parse(text.toString())
      const handler = (body: any) => {
        console.log('WSS: resolved action', action, body)
        wsocket.removeListener(`res:${action}`, handler)
        fifoOut.write(JSON.stringify({ action: `res:${action}`, data }))
      }
      const errHandler = (err: any) => {
        logger.log('WSS: wsocket error', action, err)
        wsocket.removeListener(`err:{action}`, handler)
        fifoOut.write(JSON.stringify({ action: `err:${action}`, data }))
      }
      console.log(`WILL SETUP res:${action}`)
      wsocket.on(`res:${action}`, handler)
      wsocket.on(`error:${action}`, errHandler)
      wsocket.emit(action, data)
    })
  })

  try {
    fs.accessSync(pipeOutgoing)
    openOutput()
  } catch (err) {
    const fifo = spawn('mkfifo', [pipeOutgoing])
    fifo.on('exit', openOutput)
  }

  function openOutput() {
    fs.open(pipeOutgoing, fs.constants.O_RDWR | fs.constants.O_NONBLOCK, (err, fd) => {
      if (err) {
        logger.error('LS: could not write to pipe', pipeOutgoing, err)
        return
      }
      fifoOut = new net.Socket({ fd, readable: false})
    })
  }

  return { transmit }

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
          console.log('WSS: resolved action', action, body)
          wsocket.removeListener(action, handler)
          resolve(body)
        }
        errHandler = (err: any) => {
          logger.log('WSS: wsocket error', action, err)
          wsocket.removeListener(action, errHandler)
          reject(err)
        }
        return fifoOut.write(JSON.stringify({ action, data }))
      })
      .then(shouldContinue => {
        // Backpressure if buffer is full
        if (!shouldContinue) {
          return EventEmitter.once(fifoOut, 'drain')
        }
        return
      })
      .then(() => {
        wsocket.on(`res:${action}`, handler)
        wsocket.on(`error:${action}`, errHandler)
      })
  }
}

const wsGStation = {
  init,
}

export default wsGStation
