/* @flow */

const httpStatus = require('http-status')
const catchAsync = require('@/utils/catchAsync')

const register: any = catchAsync(async (req, res) => {
})

const login: any = catchAsync(async (req, res) => {
})

const logout: any = catchAsync(async (req, res) => {
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
