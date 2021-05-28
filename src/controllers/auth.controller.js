/* @flow */

const path = require('path')
const httpStatus = require('http-status')
const catchAsync = require('@/utils/catchAsync')
const Keyv = require('keyv')
const { Peer8Store } = require('../services/peer8.store')

const dbpath = path.join(process.cwd(), 'storage.sqlite')
const keyv = new Keyv(`sqlite://${dbpath}`, { namespace: 'auth' })
keyv.on('error', err => console.error('SQLite storage: connection error', err))

const register: any = catchAsync(async (req, res) => {
})

const login: any = catchAsync(async (req, res) => {
  const { user, tokens } = req.body
  Peer8Store.tokens = tokens
  Peer8Store.user = user
  await keyv.set('uid', user?._id)
  await keyv.set('email', user?.email)
  await keyv.set('lang', user?.lang)
  await keyv.set('accessToken', tokens?.access?.token)
  await keyv.set('accessExpires', tokens?.access?.expires)
  await keyv.set('refreshToken', tokens?.refresh?.token)
  await keyv.set('refreshExpires', tokens?.refresh?.expires)
  res.status(httpStatus.OK).send()
})

const logout: any = catchAsync(async (req, res) => {
  keyv.clear()
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
