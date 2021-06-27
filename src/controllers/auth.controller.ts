import httpStatus from 'http-status'

import catchAsync from '../utils/catchAsync'
import { Peer8Store } from '../services/peer8.store'
import Peer8API from '../services/api'
import config from '../config/config'

const logout = catchAsync(async (req, res) => {
  config.authStore.clear()
  Peer8Store.tokens = undefined
  Peer8Store.user = undefined
  res.status(httpStatus.OK).send()
})

const info = catchAsync(async (req, res) => {
  const { user, tokens } = Peer8Store
  res.send({ user, tokens })
})

const sync = catchAsync(async (req, res) => {
  const { code } = req.body
  if (!code) res.status(httpStatus.BAD_REQUEST).send()
  const refreshToken = await Peer8API.sync(code)
  return Peer8API.refreshToken(refreshToken)
    .then(res => {
      Peer8Store.tokens = res.data.tokens
      Peer8Store.user = res.data.user
      res.status(httpStatus.OK).send()
    })
})

const authController = {
  logout,
  info,
  sync,
}

export default authController
