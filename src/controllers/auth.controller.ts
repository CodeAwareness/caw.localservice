import root from '../app'
import { Peer8Store } from '../services/peer8.store'
import Peer8API from '../services/api'
import config from '../config/config'

const logout = () => {
  config.authStore.clear()
  Peer8Store.tokens = undefined
  Peer8Store.user = undefined
}

const info = () => {
  const { user, tokens } = Peer8Store
  root.rootSocket.emit('info:load', { user, tokens })
}

const sync = code => {
  if (!code) root.rootSocket.emit('badRequest', 'sync')
  return Peer8API.sync(code)
}

const AUTH_COMPLETE_HTML = `<html><body><h4>Code Awareness local service:</h4><h1>Authentication complete.</h1><p>You may now close this window.</p></body><style>body { text-align: center; padding-top: 4em; }</style></html>`
const AUTH_ERROR_HTML = err => `<html><body><h4>Code Awareness local service:</h4><h1 style="padding-top: 4em; color: #a00">Error trying to authenticate.</h1>${err}</body><style>body { text-align: center; padding-top: 4em; }</style></html>`

const httpSync = (req, res) => {
  Peer8API
    .sync(req.query.code)
    .then(() => res.send(AUTH_COMPLETE_HTML))
    .catch(err => res.send(AUTH_ERROR_HTML(err)))
}

const authController = {
  logout,
  httpSync,
  info,
  sync,
}

export default authController
