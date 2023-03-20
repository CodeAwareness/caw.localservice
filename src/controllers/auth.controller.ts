import { CAWStore } from '@/services/store'
import CAWAPI, { API_AUTH_LOGIN, API_AUTH_SIGNUP } from '@/services/api'
import logger from '@/logger'

type TLoginReq = {
  email: string
  password: string
  caw: string
}

function login({ email, password }: TLoginReq) {
  CAWAPI
    .post(API_AUTH_LOGIN, { email, password }, 'auth:login', this)
    .then(data => CAWStore.setAuth(data))
    .catch(err => {
      logger.log('auth error', err)
    })
}

async function logout({ caw }) {
  return CAWStore.reset(caw)
}

function info(caw: string) {
  const { user, tokens } = CAWStore
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

  CAWAPI.refreshToken(tokens?.refresh.token)
    .then(() => {
      logger.log('AUTH: token refreshed', { user })
      this.emit('res:auth:info', { user, tokens })
    })
    .catch(err => {
      CAWStore.reset(caw)
      this.emit('res:auth:info', { err: err.message })
    })
}

function signup({ email, password }) {
  /* eslint-disable-next-line @typescript-eslint/no-this-alias */
  CAWAPI.post(API_AUTH_SIGNUP, { email, password }, 'auth:signup', this)
}

const authController = {
  login,
  logout,
  info,
  signup,
}

export default authController
