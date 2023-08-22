import wsStation from './middlewares/wsio.grandstation'
import wsGardener from './middlewares/wsio.gardener'
import config from './config/config'
import logger from './logger'

/* Uncomment this block if you wish to keep auth info between service restarts
restoreAuthInfo() // TODO: this is not resolving async, but it should be ok

async function restoreAuthInfo() {
  CAWStore.user = config.localStore.auth.user
  CAWStore.tokens = config.localStore.auth.tokens
}
*/

// Note: for MacOS / Linux we can use unix pipes: ws+unix:///absolute/path/to/uds_socket
// For Electron based applications we are restricted to using ws://
/* GrandStation websockets listen for request coming from local editors, e.g. VSCode, vim, emacs, etc */
wsStation.init()

/* Gardener websocket connects to api.codeawareness.com */
wsGardener.connect({ url: config.SERVER_WSS })

const unexpectedErrorHandler = (...args) => {
  console.log('unexpected error (global)')
  if (args[0]?.request) {
    const req = args[0]
    const axiosErr = {
      code: req.code,
      config: {
        baseURL: req.config.baseURL,
        method: req.config.method,
        url: req.config.url,
      },
      response: {
        status: req.response.status,
        statusText: req.response.statusText,
        data: req.response.data,
      }
    }
    console.error(axiosErr)
  } else {
    console.error(args)
  }
}

process.on('uncaughtException', unexpectedErrorHandler)
process.on('unhandledRejection', unexpectedErrorHandler)

process.on('SIGTERM', () => {
  logger.info('SIGTERM received')
})
