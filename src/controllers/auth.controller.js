/* @flow */

const path = require('path')
const httpStatus = require('http-status')
const catchAsync = require('@/utils/catchAsync')
const { Peer8Store } = require('@/services/peer8.store')
const { authStore } = require('@/config/config')

const register: any = catchAsync(async (req, res) => {
})

// TODO: use the stored auth for future requests (newly open PPT, etc)
const login: any = catchAsync(async (req, res) => {
  const { user, tokens } = req.body
  Peer8Store.tokens = tokens
  Peer8Store.user = user
  await authStore.set('user', user)
  await authStore.set('tokens', tokens)
  res.status(httpStatus.OK).send()
})

const logout: any = catchAsync(async (req, res) => {
  authStore.clear()
})

const refreshTokens: any = catchAsync(async (req, res) => {
})

const forgotPassword: any = catchAsync(async (req, res) => {
})

const resetPassword: any = catchAsync(async (req, res) => {
})

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
}
