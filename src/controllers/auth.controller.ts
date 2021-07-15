import app from '../app'
import { Peer8Store } from '../services/peer8.store'
import Peer8API from '../services/api'
import config from '../config/config'
import wsEngine from '../middlewares/wsio'

const logout = () => {
  config.authStore.clear()
  Peer8Store.tokens = undefined
  Peer8Store.user = undefined
}

const info = () => {
  const { user, tokens } = Peer8Store
  wsEngine.transmit('info:load', { user, tokens })
}

/* cA syncing between PPT web and cA local service */
const sync = code => {
  console.log('AUTH:SYNC controller')
  if (!code) wsEngine.transmit('error:auth:sync', 'sync code invalid')
  return Peer8API
    .sync(code)
    .then(() => {
      wsEngine.transmit('res:auth:sync')
    })
    .catch(_ => wsEngine.transmit('error:auth:sync', 'could not sync with the code provided.'))
}

const AUTH_COMPLETE_HTML = `<html><body><h4>Code Awareness local service:</h4><h1>Authentication complete.</h1><p>You may now close this window.</p></body><style>body { text-align: center; padding-top: 4em; }</style></html>`
const AUTH_ERROR_HTML = err => `<html><body><h4>Code Awareness local service:</h4><h1 style="padding-top: 4em; color: #a00">Error trying to authenticate.</h1>${err}</body><style>body { text-align: center; padding-top: 4em; }</style></html>`

/* cA Portal will use this for immediate authentication (when not using Safari) */
const httpSync = (req, res) => {
  console.log('AUTH:HTTPSYNC controller')
  Peer8API
    .sync(req.query.code)
    .then(wsEngine.init)
    .then(() => {
      wsEngine.transmit('auth:sync:complete')
      res.send(AUTH_COMPLETE_HTML)
    })
    .catch(err => res.send(AUTH_ERROR_HTML(err)))
}

const authController = {
  logout,
  httpSync,
  info,
  sync,
}

export default authController
