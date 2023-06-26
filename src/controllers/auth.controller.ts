import CAWStore from '@/services/store'
import CAWAPI, { API_AUTH_LOGIN, API_AUTH_SIGNUP } from '@/services/api'
import logger from '@/logger'

type TLoginReq = {
  email: string
  password: string
  cid: string
}

function login({ email, password }: TLoginReq) {
  CAWAPI
    .post(API_AUTH_LOGIN, { email, password }, 'auth:login', this)
    .then(data => CAWStore.setAuth(data))
    .catch(() => {
      logger.log('auth error')
    })
}

async function logout({ cid }) {
  return CAWStore.reset(cid)
}

function info(cid: string) {
  const { user, tokens } = CAWStore
  logger.log('AUTH: checking auth info')
  if (tokens?.refresh?.expires < new Date().toISOString()) {
    logger.log('AUTH: Not logged in or Refresh token expired.')
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
      this.emit('res:auth:info', { user, tokens })
    })
    .catch(err => {
      CAWStore.reset(cid)
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
