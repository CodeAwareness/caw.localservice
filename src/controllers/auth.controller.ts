import httpStatus from 'http-status'

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

const authController = {
  logout,
  info,
  sync,
}

export default authController
