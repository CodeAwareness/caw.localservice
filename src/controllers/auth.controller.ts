import type { TCredentials } from '@/services/api'

import { CΩStore } from '@/services/store'
import CΩAPI, { API_AUTH_LOGIN, API_AUTH_SIGNUP } from '@/services/api'
import git from '@/services/git'
import config from '@/config/config'
import logger from '@/logger'

let lastAuthorization: Record<string, number> = {}

type TLoginReq = {
  email: string
  password: string
  cΩ: string
}

function login({ email, password, cΩ }: TLoginReq) {
  CΩAPI
    .login({ email, password, socket: this })
    .then(data => CΩStore.setAuth(data))
    .catch(err => logger.log('auth error', err))
}

async function logout({ cΩ }) {
  await CΩStore.reset(cΩ)
  lastAuthorization = {}
}

function info(cΩ: string) {
  const { user, tokens } = CΩStore
  logger.log('AUTH: checking auth info')
  if (tokens?.refresh?.expires < new Date().toISOString()) {
    logger.log('AUTH: Refresh token expired')
    this.emit('res:auth:info')
    return
  }

  logger.log('AUTH: Access token expired. Refreshing.')
  if (!tokens?.refresh?.token) {
    this.emit('res:auth:info')
    return
  }

  CΩAPI.refreshToken(tokens?.refresh.token)
    .then(() => {
      logger.log('AUTH: token refreshed', { user })
      this.emit('res:auth:info', { user, tokens })
    })
    .catch(err => {
      console.log('ERROR IN REFRESH TOKEN', err.code, err.response.statusText, err.response.data)
      CΩStore.reset(cΩ)
      this.emit('res:auth:info', {})
    })
}

function signup({ email, password, cΩ }) {
  const socket = this
  CΩAPI.signup({ email, password, socket })
}

type TPassAssistReq = {
  email: string
  cΩ: string
}

function passwordAssist({ email, cΩ }: TPassAssistReq) {
  // return CΩAPI.post(`${SERVER_URL}/auth/forgot-password`, { email })
}

const authController = {
  login,
  logout,
  info,
  passwordAssist,
  signup,
}

export default authController
