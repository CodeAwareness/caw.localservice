import httpStatus from 'http-status'

import catchAsync from '../utils/catchAsync'
import { Peer8Store } from '../services/peer8.store'
import Peer8API from '../services/api'
import config from '../config/config'

// TODO: use the stored auth for future requests (newly open PPT, etc)
const login = catchAsync(async (req, res) => {
  const { user, tokens } = req.body
  Peer8Store.tokens = tokens
  Peer8Store.user = user
  await config.authStore.set('user', user)
  await config.authStore.set('tokens', tokens)
  res.status(httpStatus.OK).send()
})

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
  await Peer8API.sync(code)
  res.status(httpStatus.OK).send()
})

const authController = {
  login,
  logout,
  info,
  sync,
}

export default authController
