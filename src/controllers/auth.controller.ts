import type { TCredentials } from '@/services/api'

import { CΩStore } from '@/services/cA.store'
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
  console.info('LC: login', email, password)
  CΩAPI
    .post(API_AUTH_LOGIN, { email, password }, 'auth:login', this)
    .then(data => CΩStore.setAuth(data))
    .catch(err => logger.log('auth error', err))
}

async function logout({ cΩ }) {
  await CΩStore.reset()
  lastAuthorization = {}
}

function info() {
  const { user, tokens } = CΩStore
  if (tokens?.refresh?.expires < new Date().toISOString()) {
    this.emit('res:auth:info')
    return
  }
  if (tokens?.access?.expires < new Date().toISOString()) {
    CΩAPI.refreshToken(tokens?.refresh.token)
      .then(() => {
        this.emit('res:auth:info', { user, tokens })
      })
      .catch(err => {
        console.log('ERROR IN REFRESH TOKEN', err.code, err.response.statusText, err.response.data)
      })
  }
}

function signup({ email, password, cΩ }) {
  CΩAPI.post(API_AUTH_SIGNUP, { email, password }, 'auth:signup', this)
}

type TReauthReq = {
  text: string
  cΩ: string
}

/**
 * reAuthorize: fetch and send the latest SHA
 */
function reAuthorize({ text, cΩ }: TReauthReq) {
  const { origin, branch, commitDate } = JSON.parse(text)
  if (Object.keys(lastAuthorization).length && (new Date()).valueOf() - lastAuthorization[origin] < 60000) return // TODO: optimize / configure
  lastAuthorization[origin] = (new Date()).valueOf()
  const project = CΩStore.projects.filter(p => p.origin === origin)[0]
  if (!project) return
  const wsFolder = project.root
  if (!commitDate) return sendLatestSHA({ wsFolder, origin, cΩ })
  return git.command(wsFolder, 'git fetch')
    .then(() => {
      const cd = new Date(commitDate)
      // TODO: thoroughly test this one with time-zones (vscode official repo is ideal for this)
      /*
      cd.setMinute(cd.getMinute() - 5)
      const start = cd.toISOString()
      cd.setMinute(cd.getMinute() + 11)
      const end = cd.toISOString()
      const options = start ? `--since=${start} --until=${end}` : '-n5'
      */
      const options = `--since=${cd.toISOString()} --until=${cd.toISOString()}`
      return git.command(wsFolder, `git log --pretty="%cd %H" ${options} --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const [_a, d, h] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, branch, sha: h, commitDate: d })
    })
}

type TLatestShaReq = {
  wsFolder: string
  origin: string
  cΩ: string
}

/* TODO: throttle; when starting up VSCode we may get several such requests in quick succession */
function sendLatestSHA({ wsFolder, origin, cΩ }: TLatestShaReq) {
  let branch: string
  return git.command(wsFolder, 'git fetch')
    .then(() => {
      return git.command(wsFolder, 'git for-each-ref --sort="-committerdate" --count=1 refs/remotes')
    })
    .then(out => {
      const line = /(\t|\s)([^\s]+)$/.exec(out.trim())
      branch = line[2].replace('refs/remotes/', '')
      return git.command(wsFolder, `git log --pretty="%cd %H" -n1 --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const [_a, commitDate, sha] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(logger.error)
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
  reAuthorize,
  sendLatestSHA,
  signup,
}

export default authController
